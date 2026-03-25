const DEFAULT_MAX_TTS_CHARS = 3000;

function normalizeTextForTts(text = "") {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}

function splitOversizedSegment(segment = "", maxChars = DEFAULT_MAX_TTS_CHARS) {
  const chunks = [];
  const words = segment.split(/\s+/).filter(Boolean);
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);

    if (word.length <= maxChars) {
      current = word;
      continue;
    }

    for (let index = 0; index < word.length; index += maxChars) {
      chunks.push(word.slice(index, index + maxChars));
    }
    current = "";
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitTextForTts(text = "", maxChars = DEFAULT_MAX_TTS_CHARS) {
  const normalized = normalizeTextForTts(text);
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const segments = normalized
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) return splitOversizedSegment(normalized, maxChars);

  const chunks = [];
  let current = "";

  for (const segment of segments) {
    if (segment.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitOversizedSegment(segment, maxChars));
      continue;
    }

    const next = current ? `${current} ${segment}` : segment;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) chunks.push(current);
    current = segment;
  }

  if (current) chunks.push(current);
  return chunks;
}

async function ttsBufferFromChunks(textInput = "", renderChunk, maxChars) {
  const chunks = splitTextForTts(textInput, maxChars);
  if (chunks.length === 0) return null;

  const buffers = [];
  for (const chunk of chunks) {
    const buffer = await renderChunk(chunk);
    if (!buffer) return null;
    buffers.push(buffer);
  }

  return Buffer.concat(buffers);
}

module.exports = {
  DEFAULT_MAX_TTS_CHARS,
  normalizeTextForTts,
  splitTextForTts,
  ttsBufferFromChunks,
};
