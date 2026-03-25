import * as TTS from "@mintplex-labs/piper-tts-web";

const HF_BASE = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main";
const LOCAL_VOICE_ASSETS = {
  "en_US-lessac-medium": {
    remotePath: "en/en_US/lessac/medium",
    model: "/piper/voices/en_US-lessac-medium.onnx",
    config: "/piper/voices/en_US-lessac-medium.onnx.json",
  },
  "en_US-ryan-high": {
    remotePath: "en/en_US/ryan/high",
    model: "/piper/voices/en_US-ryan-high.onnx",
    config: "/piper/voices/en_US-ryan-high.onnx.json",
  },
};
const DEFAULT_LOCAL_VOICE_ID = "en_US-lessac-medium";

let LOCAL_FETCH_PATCHED = false;
let LOCAL_CACHE_FLUSHED = false;
let ACTIVE_VOICE_ID = null;

function withBase(baseUrl = "", assetPath = "") {
  if (!baseUrl) return assetPath;
  return `${String(baseUrl).replace(/\/$/, "")}${assetPath}`;
}

function installLocalPiperFetch(baseUrl = "") {
  if (LOCAL_FETCH_PATCHED || typeof fetch !== "function") return;

  const originalFetch = fetch.bind(self);
  self.fetch = (input, init) => {
    const requestUrl = typeof input === "string" ? input : input?.url;
    if (typeof requestUrl === "string") {
      const localVoice = Object.entries(LOCAL_VOICE_ASSETS).find(
        ([voiceId, asset]) =>
          requestUrl === `${HF_BASE}/${asset.remotePath}/${voiceId}.onnx` ||
          requestUrl === `${HF_BASE}/${asset.remotePath}/${voiceId}.onnx.json`
      );

      if (localVoice) {
        const [, asset] = localVoice;
        const localUrl = requestUrl.endsWith(".json")
          ? withBase(baseUrl, asset.config)
          : withBase(baseUrl, asset.model);
        return originalFetch(localUrl, init);
      }
    }

    return originalFetch(input, init);
  };

  LOCAL_FETCH_PATCHED = true;
}

function normalizeLocalVoiceId(voiceId = "") {
  if (voiceId && LOCAL_VOICE_ASSETS[voiceId]) return voiceId;
  return DEFAULT_LOCAL_VOICE_ID;
}

function sanitizePiperText(text = "") {
  return String(text)
    .normalize("NFKC")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[|<>]/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[\u200B-\u200D\uFE0F]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, ", ")
    .replace(/[…]/g, "...")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{L}\p{N}\s.,!?;:'"()/%&+\-]/gu, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function simplifyPiperText(text = "") {
  return String(text)
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function createSession({ requestedVoiceId, baseUrl }) {
  return new TTS.TtsSession({
    voiceId: requestedVoiceId,
    progress: (e) => self.postMessage(JSON.stringify(e)),
    logger: (msg) => self.postMessage(msg),
    ...(!!baseUrl
      ? {
          wasmPaths: {
            onnxWasm: withBase(baseUrl, "/piper/ort/"),
            piperData: withBase(baseUrl, "/piper/piper_phonemize.data"),
            piperWasm: withBase(baseUrl, "/piper/piper_phonemize.wasm"),
          },
        }
      : {}),
  });
}

/** @type {import("@mintplexlabs/piper-web-tts").TtsSession | null} */
let PIPER_SESSION = null;

/**
 * @typedef PredictionRequest
 * @property {('init')} type
 * @property {string} text - the text to inference on
 * @property {import('@mintplexlabs/piper-web-tts').VoiceId} voiceId - the voiceID key to use.
 * @property {string|null} baseUrl - the base URL to fetch WASMs from.
 */
/**
 * @typedef PredictionRequestResponse
 * @property {('result')} type
 * @property {Blob} audio - the text to inference on
 */

/**
 * @typedef VoicesRequest
 * @property {('voices')} type
 * @property {string|null} baseUrl - the base URL to fetch WASMs from.
 */
/**
 * @typedef VoicesRequestResponse
 * @property {('voices')} type
 * @property {[import("@mintplex-labs/piper-tts-web/dist/types")['Voice']]} voices - available voices in array
 */

/**
 * @typedef FlushRequest
 * @property {('flush')} type
 */
/**
 * @typedef FlushRequestResponse
 * @property {('flush')} type
 * @property {true} flushed
 */

/**
 * Web worker for generating client-side PiperTTS predictions
 * @param {MessageEvent<PredictionRequest | VoicesRequest | FlushRequest>} event - The event object containing the prediction request
 * @returns {Promise<PredictionRequestResponse|VoicesRequestResponse|FlushRequestResponse>}
 */
async function main(event) {
  const baseUrl = event?.data?.baseUrl || self.location?.origin || "";
  installLocalPiperFetch(baseUrl);

  if (event.data.type === "voices") {
    const voices = (await TTS.voices()).filter(
      (voice) => !!LOCAL_VOICE_ASSETS[voice.key]
    );
    voices.forEach((voice) => {
      voice.is_stored = true;
    });

    self.postMessage({ type: "voices", voices });
    return;
  }

  if (event.data.type === "flush") {
    await TTS.flush();
    PIPER_SESSION = null;
    ACTIVE_VOICE_ID = null;
    LOCAL_CACHE_FLUSHED = false;
    self.postMessage({ type: "flush", flushed: true });
    return;
  }

  if (event.data?.type !== "init") return;
  const requestedVoiceId = normalizeLocalVoiceId(event.data?.voiceId);
  if (LOCAL_VOICE_ASSETS[requestedVoiceId] && !LOCAL_CACHE_FLUSHED) {
    await TTS.flush().catch(() => {});
    LOCAL_CACHE_FLUSHED = true;
  }

  if (!PIPER_SESSION || ACTIVE_VOICE_ID !== requestedVoiceId) {
    PIPER_SESSION = null;
    PIPER_SESSION = await createSession({ requestedVoiceId, baseUrl });
    ACTIVE_VOICE_ID = requestedVoiceId;
  }
  const rawText = String(event.data.text ?? "");
  const normalizedText = sanitizePiperText(rawText);
  const fallbackText = simplifyPiperText(normalizedText);
  const primaryText = normalizedText || fallbackText || rawText.trim();

  try {
    const result =
      (primaryText ? await PIPER_SESSION.predict(primaryText) : null) ||
      (fallbackText && fallbackText !== primaryText
        ? await PIPER_SESSION.predict(fallbackText)
        : null);

    if (result instanceof Blob) {
      self.postMessage({ type: "result", audio: result });
      return;
    }
  } catch (error) {
    const needsSanitizedRetry =
      error?.message?.includes("Unexpected EOF") ||
      error?.message?.includes("JSON Parse error") ||
      error?.message?.includes("Piper phoneme parse failed");

    if (needsSanitizedRetry && fallbackText) {
      try {
        PIPER_SESSION = await createSession({ requestedVoiceId, baseUrl });
        ACTIVE_VOICE_ID = requestedVoiceId;
        const retried = await PIPER_SESSION.predict(fallbackText);
        if (retried instanceof Blob) {
          self.postMessage({ type: "result", audio: retried });
          return;
        }
      } catch (retryError) {
        self.postMessage({
          type: "error",
          message: retryError.message,
          error: retryError,
        });
        return;
      }
    }

    self.postMessage({ type: "error", message: error.message, error });
  }
}

self.addEventListener("message", main);
