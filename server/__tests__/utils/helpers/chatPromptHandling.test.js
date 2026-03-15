/* eslint-env jest */
const {
  buildMessagesWithPromptHandling,
} = require("../../../utils/helpers/chat");

describe("buildMessagesWithPromptHandling", () => {
  test("uses the existing compression path by default", async () => {
    const llm = {
      model: "gpt-4o",
      compressMessages: jest.fn().mockResolvedValue(["compressed"]),
      constructPrompt: jest.fn(),
      promptWindowLimit: jest.fn().mockReturnValue(4096),
    };

    const result = await buildMessagesWithPromptHandling({
      llm,
      promptArgs: { userPrompt: "hello" },
      rawHistory: [],
    });

    expect(result.abort).toBeNull();
    expect(result.messages).toEqual(["compressed"]);
    expect(llm.compressMessages).toHaveBeenCalledWith(
      { userPrompt: "hello" },
      []
    );
    expect(llm.constructPrompt).not.toHaveBeenCalled();
  });

  test("returns the full prompt unchanged when precision mode fits", async () => {
    const fullPrompt = [
      { role: "system", content: "system instructions" },
      { role: "user", content: "hello there" },
    ];
    const llm = {
      model: "gpt-4o",
      compressMessages: jest.fn(),
      constructPrompt: jest.fn().mockReturnValue(fullPrompt),
      promptWindowLimit: jest.fn().mockResolvedValue(5000),
    };

    const result = await buildMessagesWithPromptHandling({
      llm,
      promptArgs: { userPrompt: "hello there" },
      promptHandling: "precision",
    });

    expect(result.abort).toBeNull();
    expect(result.messages).toEqual(fullPrompt);
    expect(result.promptHandling).toBe("precision");
    expect(result.metrics).toEqual(
      expect.objectContaining({
        prompt_handling: "precision",
        estimated_prompt_tokens: expect.any(Number),
      })
    );
    expect(llm.compressMessages).not.toHaveBeenCalled();
  });

  test("fails clearly when the full precision prompt would overflow", async () => {
    const llm = {
      model: "gpt-4o",
      compressMessages: jest.fn(),
      constructPrompt: jest.fn().mockReturnValue([
        { role: "system", content: "system instructions" },
        { role: "user", content: "overflow ".repeat(500) },
      ]),
      promptWindowLimit: jest.fn().mockResolvedValue(700),
    };

    const result = await buildMessagesWithPromptHandling({
      llm,
      promptArgs: { userPrompt: "overflow ".repeat(500) },
      precisionMode: true,
    });

    expect(result.messages).toBeNull();
    expect(result.abort).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Precision mode rejected this request"),
        metrics: expect.objectContaining({
          prompt_handling: "precision",
          overflow_tokens: expect.any(Number),
          estimated_prompt_tokens: expect.any(Number),
        }),
      })
    );
    expect(result.abort.metrics.overflow_tokens).toBeGreaterThan(0);
  });

  test("fails clearly for image attachments in precision mode", async () => {
    const llm = {
      model: "gpt-4o",
      compressMessages: jest.fn(),
      constructPrompt: jest.fn().mockReturnValue([
        { role: "system", content: "system instructions" },
        {
          role: "user",
          content: "hello",
          images: ["abc123"],
        },
      ]),
      promptWindowLimit: jest.fn().mockReturnValue(5000),
    };

    const result = await buildMessagesWithPromptHandling({
      llm,
      promptArgs: { userPrompt: "hello" },
      promptHandling: "precision",
    });

    expect(result.messages).toBeNull();
    expect(result.abort).toEqual(
      expect.objectContaining({
        error: expect.stringContaining("image attachments"),
        metrics: expect.objectContaining({
          prompt_handling: "precision",
          unsupported_reason: expect.any(String),
        }),
      })
    );
  });
});
