function getTTSProvider() {
  const provider = process.env.TTS_PROVIDER || "piper_local";
  switch (provider) {
    case "piper_local":
      const { PiperLocalTTS } = require("./piperLocal");
      return new PiperLocalTTS();
    case "openai":
      const { OpenAiTTS } = require("./openAi");
      return new OpenAiTTS();
    case "elevenlabs":
      const { ElevenLabsTTS } = require("./elevenLabs");
      return new ElevenLabsTTS();
    case "generic-openai":
      const { GenericOpenAiTTS } = require("./openAiGeneric");
      return new GenericOpenAiTTS();
    default:
      throw new Error("ENV: No TTS_PROVIDER value found in environment!");
  }
}

module.exports = { getTTSProvider };
