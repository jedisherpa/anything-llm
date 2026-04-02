import { useEffect, useCallback, useRef, useState } from "react";
import { Microphone } from "@phosphor-icons/react/dist/csr/Microphone";

import { Tooltip } from "react-tooltip";
import "regenerator-runtime";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { PROMPT_INPUT_EVENT } from "../constants";
import { useTranslation } from "react-i18next";
import Appearance from "@/models/appearance";
import showToast from "@/utils/toast";
import System from "@/models/system";

const SILENCE_INTERVAL = 3_200;
const WHISPER_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

function shouldPreferWhisperWavCapture() {
  if (typeof window === "undefined") return false;
  return Boolean(window.__TAURI__);
}

export default function SpeechToText({ sendCommand }) {
  const previousTranscriptRef = useRef("");
  const silenceTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [provider, setProvider] = useState("whisper");
  const [isWhisperRecording, setIsWhisperRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    browserSupportsContinuousListening,
    isMicrophoneAvailable,
  } = useSpeechRecognition({
    clearTranscriptOnListen: true,
  });
  const { t } = useTranslation();
  const isWhisperProvider = provider === "whisper";
  const isListening = isWhisperProvider ? isWhisperRecording : listening;
  const isBusy = isListening || isTranscribing;

  function stopWhisperTracks() {
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function resetWhisperAudioGraph() {
    audioProcessorRef.current?.disconnect?.();
    audioSourceRef.current?.disconnect?.();
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
  }

  async function closeWhisperAudioContext() {
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (!audioContext) return;
    try {
      await audioContext.close();
    } catch {
      // Ignore context teardown issues during cleanup.
    }
  }

  function selectedWhisperMimeType() {
    if (typeof window === "undefined" || !window.MediaRecorder) return null;
    if (typeof window.MediaRecorder.isTypeSupported !== "function")
      return WHISPER_MIME_TYPES[0];
    return (
      WHISPER_MIME_TYPES.find((mimeType) =>
        window.MediaRecorder.isTypeSupported(mimeType)
      ) || ""
    );
  }

  function whisperFileName(mimeType = "") {
    if (mimeType.includes("mp4")) return "speech-to-text.m4a";
    if (mimeType.includes("wav")) return "speech-to-text.wav";
    return "speech-to-text.webm";
  }

  function encodeWavFromFloat32(chunks, sampleRate) {
    const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const pcmData = new Int16Array(totalSamples);
    let offset = 0;

    for (const chunk of chunks) {
      for (let i = 0; i < chunk.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, chunk[i]));
        pcmData[offset] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        offset += 1;
      }
    }

    const buffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(buffer);
    const writeString = (position, value) => {
      for (let i = 0; i < value.length; i += 1) {
        view.setUint8(position + i, value.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + pcmData.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, pcmData.length * 2, true);

    for (let i = 0; i < pcmData.length; i += 1) {
      view.setInt16(44 + i * 2, pcmData[i], true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  async function startWhisperAudioContextSession(stream) {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext || null;

    if (!AudioContextClass) {
      throw new Error("AudioContextUnavailable");
    }

    const audioContext = new AudioContextClass();
    await audioContext.resume?.();

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    recordedChunksRef.current = [];
    mediaStreamRef.current = stream;
    audioContextRef.current = audioContext;
    audioSourceRef.current = source;
    audioProcessorRef.current = processor;

    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer?.getChannelData?.(0);
      if (!input) return;
      recordedChunksRef.current.push(new Float32Array(input));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);
    setIsWhisperRecording(true);
  }

  async function transcribeWhisperAudio(blob, mimeType = "") {
    const file = new File([blob], whisperFileName(mimeType), {
      type: mimeType || blob.type || "audio/webm",
    });
    const { text, error } = await System.transcribeAudio(file);

    if (error) {
      showToast(error, "error");
      return;
    }

    if (!text) return;
    sendCommand({ text, writeMode: "append" });

    if (Appearance.get("autoSubmitSttInput")) {
      sendCommand({
        text: "",
        autoSubmit: true,
        writeMode: "append",
      });
    }
  }

  async function startWhisperSession() {
    if (!navigator?.mediaDevices?.getUserMedia) {
      showToast(
        "Whisper speech-to-text needs microphone recording support in this browser.",
        "error"
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (window?.MediaRecorder && !shouldPreferWhisperWavCapture()) {
        const mimeType = selectedWhisperMimeType();
        const recorder = mimeType
          ? new window.MediaRecorder(stream, { mimeType })
          : new window.MediaRecorder(stream);

        recordedChunksRef.current = [];
        mediaStreamRef.current = stream;
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data?.size) recordedChunksRef.current.push(event.data);
        };
        recorder.onstop = async () => {
          const chunks = recordedChunksRef.current;
          recordedChunksRef.current = [];
          setIsWhisperRecording(false);
          stopWhisperTracks();

          if (chunks.length === 0) return;

          setIsTranscribing(true);
          try {
            const audioBlob = new Blob(chunks, {
              type: mimeType || recorder.mimeType || "audio/webm",
            });
            await transcribeWhisperAudio(
              audioBlob,
              mimeType || recorder.mimeType || "audio/webm"
            );
          } finally {
            setIsTranscribing(false);
          }
        };

        recorder.start();
        setIsWhisperRecording(true);
        return;
      }

      await startWhisperAudioContextSession(stream);
    } catch {
      showToast(
        "AnythingLLM does not have access to the microphone. Enable microphone permission to use speech-to-text.",
        "error"
      );
    }
  }

  async function endWhisperSession() {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
      return;
    }

    const audioContext = audioContextRef.current;
    if (audioContext) {
      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      setIsWhisperRecording(false);
      resetWhisperAudioGraph();
      stopWhisperTracks();
      await closeWhisperAudioContext();

      if (chunks.length === 0) return;

      setIsTranscribing(true);
      try {
        const audioBlob = encodeWavFromFloat32(chunks, audioContext.sampleRate);
        await transcribeWhisperAudio(audioBlob, "audio/wav");
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    setIsWhisperRecording(false);
    stopWhisperTracks();
  }

  function startSTTSession() {
    if (isWhisperProvider) {
      startWhisperSession();
      return;
    }

    if (!isMicrophoneAvailable) {
      showToast(
        "AnythingLLM does not have access to the microphone. Enable microphone permission to use speech-to-text.",
        "error"
      );
      return;
    }

    resetTranscript();
    previousTranscriptRef.current = "";
    clearTimeout(silenceTimeoutRef.current);
    SpeechRecognition.startListening({
      continuous: browserSupportsContinuousListening,
      language: window?.navigator?.language ?? "en-US",
    });
  }

  function endSTTSession() {
    if (isWhisperProvider) {
      endWhisperSession();
      return;
    }

    SpeechRecognition.stopListening();

    if (Appearance.get("autoSubmitSttInput")) {
      sendCommand({
        text: "",
        autoSubmit: true,
        writeMode: "append",
      });
    }

    resetTranscript();
    previousTranscriptRef.current = "";
    clearTimeout(silenceTimeoutRef.current);
  }

  const handleKeyPress = useCallback(
    (event) => {
      if (event.ctrlKey && event.keyCode === 77) {
        if (isListening) {
          endSTTSession();
        } else {
          startSTTSession();
        }
      }
    },
    [isListening, provider]
  );

  function handlePromptUpdate(e) {
    if (!e?.detail && silenceTimeoutRef.current) {
      endSTTSession();
      clearTimeout(silenceTimeoutRef.current);
    }
  }

  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [handleKeyPress]);

  useEffect(() => {
    if (!!window)
      window.addEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
    return () =>
      window?.removeEventListener(PROMPT_INPUT_EVENT, handlePromptUpdate);
  }, []);

  useEffect(() => {
    async function fetchSttProvider() {
      const settings = await System.keys();
      setProvider(settings?.SpeechToTextProvider || "whisper");
    }
    fetchSttProvider();
  }, []);

  useEffect(() => {
    if (transcript?.length > 0 && listening) {
      const previousTranscript = previousTranscriptRef.current;
      const newContent = transcript.slice(previousTranscript.length);

      if (newContent.length > 0)
        sendCommand({ text: newContent, writeMode: "append" });

      previousTranscriptRef.current = transcript;
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = setTimeout(() => {
        endSTTSession();
      }, SILENCE_INTERVAL);
    }
  }, [transcript, listening]);

  useEffect(() => {
    return () => {
      clearTimeout(silenceTimeoutRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      resetWhisperAudioGraph();
      closeWhisperAudioContext();
      stopWhisperTracks();
    };
  }, []);

  if (!isWhisperProvider && !browserSupportsSpeechRecognition) return null;

  const statusLabel = isTranscribing ? "Transcribing" : "Recording";

  return (
    <div
      data-tooltip-id="tooltip-microphone-btn"
      data-tooltip-content={`${t("chat_window.microphone")} (CTRL + M)`}
      aria-label={t("chat_window.microphone")}
      aria-pressed={isListening}
      onClick={
        isTranscribing
          ? undefined
          : isListening
            ? endSTTSession
            : startSTTSession
      }
      className={`group border-none relative flex justify-center items-center w-8 h-8 rounded-full transition-all duration-150 hover:bg-zinc-700 light:hover:bg-slate-200 ${
        isTranscribing ? "cursor-wait" : "cursor-pointer"
      } ${
        isBusy
          ? "bg-rose-500/20 ring-2 ring-rose-400/70 shadow-[0_0_0_8px_rgba(251,113,133,0.12)]"
          : ""
      }`}
    >
      {isBusy && (
        <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-full border border-rose-400/45 bg-[#2a0f16]/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-100 shadow-lg">
          <span
            className={`h-2 w-2 rounded-full ${isTranscribing ? "bg-amber-300" : "bg-rose-400 animate-pulse"}`}
          />
          {statusLabel}
        </div>
      )}
      <Microphone
        weight="regular"
        size={18}
        className={`pointer-events-none text-zinc-300 light:text-slate-600 group-hover:text-white light:group-hover:text-slate-600 shrink-0 ${isBusy ? "animate-pulse-glow !text-rose-100" : ""}`}
      />

      <Tooltip
        id="tooltip-microphone-btn"
        place="top"
        delayShow={300}
        className="tooltip !text-xs z-99"
      />
    </div>
  );
}
