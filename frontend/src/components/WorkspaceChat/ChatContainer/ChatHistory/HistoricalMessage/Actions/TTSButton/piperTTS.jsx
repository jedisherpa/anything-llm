import { useEffect, useRef, useState } from "react";
import { SpeakerHigh } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { PauseCircle } from "@phosphor-icons/react/dist/csr/PauseCircle";
import { CircleNotch } from "@phosphor-icons/react/dist/csr/CircleNotch";

import PiperTTSClient from "@/utils/piperTTS";

const TWO_CHUNK_THRESHOLD = 1600;
const FOUR_CHUNK_THRESHOLD = 3200;
const MAX_CHUNK_LENGTH = 1200;
const MIN_TIMEOUT_MS = 45_000;
const MAX_TIMEOUT_MS = 120_000;

function splitIntoSentences(text = "") {
  return String(text)
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function chunkCountForText(text = "") {
  if (text.length > FOUR_CHUNK_THRESHOLD) return 4;
  if (text.length > TWO_CHUNK_THRESHOLD) return 2;
  return 1;
}

function splitLongSentence(sentence = "", maxLength = MAX_CHUNK_LENGTH) {
  if (sentence.length <= maxLength) return [sentence];

  const parts = [];
  let remaining = sentence.trim();
  while (remaining.length > maxLength) {
    let breakAt = remaining.lastIndexOf(" ", maxLength);
    if (breakAt < maxLength * 0.55) breakAt = maxLength;
    parts.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function createBalancedChunks(text = "") {
  const normalizedText = String(text).trim();
  if (!normalizedText) return [];

  const desiredChunkCount = chunkCountForText(normalizedText);
  const targetLength = Math.max(
    Math.ceil(normalizedText.length / desiredChunkCount),
    1
  );

  const sentences = splitIntoSentences(normalizedText).flatMap((sentence) =>
    splitLongSentence(sentence, MAX_CHUNK_LENGTH)
  );

  if (!sentences.length) return [normalizedText];

  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const nextChunk = currentChunk
      ? `${currentChunk} ${sentence}`.trim()
      : sentence;

    if (
      currentChunk &&
      chunks.length < desiredChunkCount - 1 &&
      nextChunk.length > targetLength
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
      continue;
    }

    currentChunk = nextChunk;
  }

  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks.filter(Boolean);
}

function timeoutForChunk(chunk = "") {
  return Math.min(
    MAX_TIMEOUT_MS,
    Math.max(MIN_TIMEOUT_MS, 20_000 + String(chunk).length * 25)
  );
}

export default function PiperTTS({ chatId, voiceId = null, message }) {
  const playerRef = useRef(null);
  const clientRef = useRef(null);
  const activeBlobUrlRef = useRef(null);
  const chunkTextsRef = useRef([]);
  const requestNonceRef = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  function revokeActiveBlob() {
    if (!activeBlobUrlRef.current) return;
    URL.revokeObjectURL(activeBlobUrlRef.current);
    activeBlobUrlRef.current = null;
  }

  function stopPlayback() {
    requestNonceRef.current += 1;
    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.currentTime = 0;
      playerRef.current.removeAttribute("src");
      playerRef.current.load();
    }
    revokeActiveBlob();
    chunkTextsRef.current = [];
    setSpeaking(false);
    setLoading(false);
    setCurrentChunkIndex(0);
  }

  async function playChunkAtIndex(index, chunks, { showLoader = false } = {}) {
    const chunk = chunks[index];
    if (!chunk) {
      stopPlayback();
      return false;
    }

    const requestNonce = requestNonceRef.current;
    if (!clientRef.current) {
      clientRef.current = new PiperTTSClient({ voiceId });
    }

    if (showLoader) setLoading(true);
    const blobUrl = await clientRef.current.getAudioBlobForText(
      chunk,
      voiceId,
      timeoutForChunk(chunk)
    );
    if (showLoader) setLoading(false);

    if (!blobUrl || requestNonce !== requestNonceRef.current) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return false;
    }

    revokeActiveBlob();
    activeBlobUrlRef.current = blobUrl;
    setCurrentChunkIndex(index);

    if (playerRef.current) {
      playerRef.current.src = blobUrl;
      await playerRef.current.play();
    }
    return true;
  }

  async function speakMessage(e) {
    e.preventDefault();

    if (speaking || loading) {
      stopPlayback();
      return;
    }

    try {
      const chunks = createBalancedChunks(message);
      if (!chunks.length) return;

      requestNonceRef.current += 1;
      chunkTextsRef.current = chunks;
      await playChunkAtIndex(0, chunks, { showLoader: true });
    } catch (error) {
      console.error(error);
      setLoading(false);
      setSpeaking(false);
    }
  }

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handlePlay = () => setSpeaking(true);
    const handlePause = () => {
      if (player.ended) return;
      setSpeaking(false);
    };
    const handleEnded = async () => {
      const nextIndex = currentChunkIndex + 1;
      if (nextIndex >= chunkTextsRef.current.length) {
        stopPlayback();
        return;
      }

      await playChunkAtIndex(nextIndex, chunkTextsRef.current);
    };

    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("ended", handleEnded);

    return () => {
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("ended", handleEnded);
    };
  }, [currentChunkIndex, voiceId]);

  useEffect(() => {
    stopPlayback();
    clientRef.current = new PiperTTSClient({ voiceId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, voiceId, message]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-3 relative">
      <button
        type="button"
        onClick={speakMessage}
        disabled={loading}
        data-auto-play-chat-id={chatId}
        data-tooltip-id="message-to-speech"
        data-tooltip-content={
          speaking ? "Pause TTS speech of message" : "TTS Speak message"
        }
        className="border-none text-[var(--theme-sidebar-footer-icon-fill)]"
        aria-label={speaking ? "Pause speech" : "Speak message"}
      >
        {speaking ? (
          <PauseCircle size={18} className="mb-1" />
        ) : loading ? (
          <CircleNotch size={18} className="mb-1 animate-spin" />
        ) : (
          <SpeakerHigh size={18} className="mb-1" />
        )}

        <audio ref={playerRef} hidden={true} controls={false} />
      </button>
    </div>
  );
}
