const {
  splitTextForTts,
  ttsBufferFromChunks,
} = require("../../../../server/utils/TextToSpeech/utils");

describe("TextToSpeech utils", () => {
  it("returns a single chunk for short text", () => {
    expect(splitTextForTts("Short response.", 50)).toEqual(["Short response."]);
  });

  it("splits long text into bounded chunks", () => {
    const text = [
      "Sentence one is long enough to matter.",
      "Sentence two is also long enough to require chunking.",
      "Sentence three finishes the thought cleanly.",
    ].join(" ");

    const chunks = splitTextForTts(text, 55);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 55)).toBe(true);
    expect(chunks.join(" ")).toContain("Sentence one");
    expect(chunks.join(" ")).toContain("Sentence three");
  });

  it("concatenates provider buffers for multi-chunk input", async () => {
    const rendered = [];
    const buffer = await ttsBufferFromChunks(
      "Alpha. Beta. Gamma. Delta.",
      async (chunk) => {
        rendered.push(chunk);
        return Buffer.from(chunk);
      },
      8
    );

    expect(rendered.length).toBeGreaterThan(1);
    expect(buffer.toString()).toBe(rendered.join(""));
  });
});
