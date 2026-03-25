const fs = require("fs/promises");
const fsSync = require("fs");
const os = require("os");
const path = require("path");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const { normalizeTextForTts } = require("../utils");

const execFileAsync = promisify(execFile);

class PiperLocalTTS {
  constructor() {
    this.mimeType = "audio/wav";
    this.voice = this.#voiceForCurrentPlatform();
    this.piperBinary = this.#resolvePiperBinary();
    this.piperModelPath = this.#resolvePiperModelPath();
  }

  #voiceForCurrentPlatform() {
    if (process.platform !== "darwin") return null;

    const preferred = process.env.TTS_PIPER_NATIVE_VOICE?.trim();
    if (preferred) return preferred;

    const piperModel = (process.env.TTS_PIPER_VOICE_MODEL || "").toLowerCase();
    if (piperModel.includes("lessac")) return "Samantha";
    if (piperModel.includes("british")) return "Daniel";
    if (piperModel.includes("female")) return "Samantha";

    return "Samantha";
  }

  #resolvePiperBinary() {
    const configured = process.env.TTS_PIPER_BIN?.trim();
    const candidates = [
      configured,
      "/opt/homebrew/bin/piper",
      "/usr/local/bin/piper",
      "piper",
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (!candidate) continue;
      if (!path.isAbsolute(candidate)) return candidate;
      if (fsSync.existsSync(candidate)) return candidate;
    }

    return null;
  }

  #resolvePiperModelPath() {
    const configuredModel = (
      process.env.TTS_PIPER_VOICE_MODEL || "en_US-lessac-medium"
    ).trim();
    if (!configuredModel) return null;

    const modelCandidates =
      configuredModel.includes("/") || configuredModel.endsWith(".onnx")
        ? [configuredModel]
        : [
            path.join(os.homedir(), "piper-voices", `${configuredModel}.onnx`),
            path.join("/Users/Shared", "piper-voices", `${configuredModel}.onnx`),
          ];

    for (const candidate of modelCandidates) {
      if (fsSync.existsSync(candidate)) return candidate;
    }

    return modelCandidates[0] ?? null;
  }

  async #ttsWithNativePiper(text, outputPath) {
    if (!this.piperBinary || !this.piperModelPath) return false;

    await new Promise((resolve, reject) => {
      const child = spawn(
        this.piperBinary,
        ["--model", this.piperModelPath, "--output_file", outputPath],
        {
          stdio: ["pipe", "ignore", "pipe"],
        }
      );

      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) return resolve();
        reject(new Error(stderr || `Piper exited with code ${code}.`));
      });
      child.stdin.write(text, "utf8");
      child.stdin.end();
    });

    return true;
  }

  async ttsBuffer(textInput = "") {
    const text = normalizeTextForTts(textInput);
    if (!text) return null;

    if (process.platform !== "darwin") {
      throw new Error(
        "Local desktop TTS is only configured for macOS in this build."
      );
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prismai-tts-"));
    const inputPath = path.join(tempDir, "speech.txt");
    const outputPath = path.join(tempDir, "speech.wav");

    try {
      await fs.writeFile(inputPath, text, "utf8");

      try {
        const usedPiper = await this.#ttsWithNativePiper(text, outputPath);
        if (!usedPiper) throw new Error("Native Piper unavailable.");
      } catch (error) {
        console.warn(
          `[PiperLocalTTS] Falling back to macOS say(): ${error.message}`
        );
        await execFileAsync("say", [
          "-v",
          this.voice,
          "-f",
          inputPath,
          "-o",
          outputPath,
          "--file-format=WAVE",
          "--data-format=LEI16@22050",
        ]);
      }

      return await fs.readFile(outputPath);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}

module.exports = {
  PiperLocalTTS,
};
