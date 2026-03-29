import showToast from "../toast";
import { API_BASE } from "../constants";

export default class PiperTTSClient {
  static _instance;
  voiceId = "en_US-lessac-medium";
  worker = null;
  prewarmedVoiceId = null;
  prewarmPromise = null;

  constructor({ voiceId } = { voiceId: null }) {
    if (PiperTTSClient._instance) {
      this.voiceId = voiceId !== null ? voiceId : this.voiceId;
      return PiperTTSClient._instance;
    }

    this.voiceId = voiceId !== null ? voiceId : this.voiceId;
    PiperTTSClient._instance = this;
    return this;
  }

  #getWorker() {
    if (!this.worker)
      this.worker = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
    return this.worker;
  }

  #logWorkerEvent(event) {
    if (!event?.data) return;

    if (event.data.type === "debug") {
      console.debug("[PiperTTSWorker]", event.data);
      return;
    }

    if (event.data.type === "progress") {
      console.debug("[PiperTTSWorker progress]", event.data);
      return;
    }

    if (typeof event.data === "string") {
      console.debug("[PiperTTSWorker]", event.data);
    }
  }

  waitForWorkerMessage(expectedType, timeoutMs = 30_000) {
    return new Promise((resolve) => {
      const worker = this.#getWorker();
      let timeout = null;

      const handleMessage = (event) => {
        if (event.data?.type === "error") {
          worker.removeEventListener("message", handleMessage);
          timeout && clearTimeout(timeout);
          console.error("[PiperTTSWorker error]", event.data);
          return resolve({ ok: false, error: event.data.message, data: null });
        }

        if (event.data?.type === expectedType) {
          worker.removeEventListener("message", handleMessage);
          timeout && clearTimeout(timeout);
          return resolve({ ok: true, error: null, data: event.data });
        }

        this.#logWorkerEvent(event);
      };

      timeout = setTimeout(() => {
        worker.removeEventListener("message", handleMessage);
        resolve({
          ok: false,
          error: `PiperTTSWorker timed out waiting for ${expectedType}.`,
          data: null,
        });
      }, timeoutMs);

      worker.addEventListener("message", handleMessage);
    });
  }

  /**
   * Get all available voices for a client
   * @returns {Promise<import("@mintplex-labs/piper-tts-web/dist/types").Voice[]}>}
   */
  static async voices() {
    const tmpWorker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    tmpWorker.postMessage({ type: "voices" });
    return new Promise((resolve, reject) => {
      let timeout = null;
      const handleMessage = (event) => {
        if (event.data.type !== "voices") {
          console.log("PiperTTSWorker debug event:", event.data);
          return;
        }
        resolve(event.data.voices);
        tmpWorker.removeEventListener("message", handleMessage);
        timeout && clearTimeout(timeout);
        tmpWorker.terminate();
      };

      timeout = setTimeout(() => {
        reject("TTS Worker timed out.");
      }, 30_000);
      tmpWorker.addEventListener("message", handleMessage);
    });
  }

  static async flush() {
    const tmpWorker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    tmpWorker.postMessage({ type: "flush" });
    return new Promise((resolve, reject) => {
      let timeout = null;
      const handleMessage = (event) => {
        if (event.data.type !== "flush") {
          console.log("PiperTTSWorker debug event:", event.data);
          return;
        }
        resolve(event.data.flushed);
        tmpWorker.removeEventListener("message", handleMessage);
        timeout && clearTimeout(timeout);
        tmpWorker.terminate();
      };

      timeout = setTimeout(() => {
        reject("TTS Worker timed out.");
      }, 30_000);
      tmpWorker.addEventListener("message", handleMessage);
    });
  }

  /**
   * Runs prediction via webworker so we can get an audio blob back.
   * @returns {Promise<{blobURL: string|null, error: string|null}>} objectURL blob: type.
   */
  async waitForBlobResponse(timeoutMs = 30_000) {
    const { ok, error, data } = await this.waitForWorkerMessage(
      "result",
      timeoutMs
    );

    if (!ok || !data?.audio) {
      return {
        blobURL: null,
        error: error ?? "PiperTTSWorker Worker timed out.",
      };
    }

    return {
      blobURL: URL.createObjectURL(data.audio),
      error: null,
    };
  }

  async prewarm(voiceId = null, timeoutMs = 90_000) {
    const requestedVoiceId = voiceId ?? this.voiceId;
    if (this.prewarmedVoiceId === requestedVoiceId) return true;

    if (this.prewarmPromise) return this.prewarmPromise;

    const worker = this.#getWorker();
    const apiOrigin = new URL(API_BASE, window.location.origin).origin;
    worker.postMessage({
      type: "warmup",
      voiceId: requestedVoiceId,
      baseUrl: `${apiOrigin}/static`,
    });

    this.prewarmPromise = this.waitForWorkerMessage("warmup", timeoutMs)
      .then(({ ok, error, data }) => {
        if (!ok) {
          console.error("[PiperTTSWorker warmup failed]", error);
          return false;
        }

        this.prewarmedVoiceId = data?.voiceId ?? requestedVoiceId;
        console.debug("[PiperTTSWorker warmup ready]", {
          voiceId: this.prewarmedVoiceId,
        });
        return true;
      })
      .finally(() => {
        this.prewarmPromise = null;
      });

    return this.prewarmPromise;
  }

  async getAudioBlobForText(textToSpeak, voiceId = null, timeoutMs = 30_000) {
    const primaryWorker = this.#getWorker();
    const apiOrigin = new URL(API_BASE, window.location.origin).origin;
    primaryWorker.postMessage({
      type: "init",
      text: String(textToSpeak),
      voiceId: voiceId ?? this.voiceId,
      baseUrl: `${apiOrigin}/static`,
      // Don't reference WASM because in the docker image
      // the user will be connected to internet (mostly)
      // and it bloats the app size on the frontend or app significantly
      // and running the docker image fully offline is not an intended use-case unlike the app.
    });

    const { blobURL, error } = await this.waitForBlobResponse(timeoutMs);
    if (!!error) {
      showToast(
        `Could not generate voice prediction. Error: ${error}`,
        "error",
        { clear: true }
      );
      return;
    }

    this.prewarmedVoiceId = voiceId ?? this.voiceId;
    return blobURL;
  }
}
