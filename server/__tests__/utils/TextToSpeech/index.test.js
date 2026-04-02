/* global describe, it, expect, beforeEach, jest, require, process */
describe("getTTSProvider", () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.TTS_PROVIDER;
  });

  it("reuses the same provider instance for repeated requests to the same provider", () => {
    jest.doMock("../../../../server/utils/TextToSpeech/piperLocal", () => {
      return {
        PiperLocalTTS: jest.fn().mockImplementation(() => ({
          mimeType: "audio/wav",
        })),
      };
    });

    const { getTTSProvider } = require("../../../../server/utils/TextToSpeech");

    const first = getTTSProvider();
    const second = getTTSProvider();

    expect(first).toBe(second);
  });

  it("keeps separate cached instances for different providers", () => {
    jest.doMock("../../../../server/utils/TextToSpeech/piperLocal", () => {
      return {
        PiperLocalTTS: jest.fn().mockImplementation(() => ({
          provider: "piper_local",
        })),
      };
    });

    jest.doMock("../../../../server/utils/TextToSpeech/openAi", () => {
      return {
        OpenAiTTS: jest.fn().mockImplementation(() => ({
          provider: "openai",
        })),
      };
    });

    const { getTTSProvider } = require("../../../../server/utils/TextToSpeech");

    process.env.TTS_PROVIDER = "piper_local";
    const localProvider = getTTSProvider();

    process.env.TTS_PROVIDER = "openai";
    const openAiProvider = getTTSProvider();

    process.env.TTS_PROVIDER = "piper_local";
    const localProviderAgain = getTTSProvider();

    expect(localProvider.provider).toBe("piper_local");
    expect(openAiProvider.provider).toBe("openai");
    expect(localProviderAgain).toBe(localProvider);
    expect(openAiProvider).not.toBe(localProvider);
  });
});
