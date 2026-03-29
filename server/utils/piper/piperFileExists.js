const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const PIPER_ASSETS_PATH =
  process.env.NODE_ENV === "development"
    ? path.resolve(__dirname, "../../storage/models/pipertts")
    : path.resolve(process.env.STORAGE_DIR, "pipertts");

const BUCKET_BASE =
  "https://s3.us-west-1.amazonaws.com/public.useanything.com/support/pipertts";

const AVAILABLE_FILES = [
  "piper_phonemize.data",
  "piper_phonemize.wasm",
  "ort/ort-wasm-simd.wasm",
  "ort/ort-wasm-threaded.wasm",
  "ort/ort-wasm-simd-threaded.wasm",
  "ort/ort-wasm.wasm",
];

async function downloadFromStorage(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed Piper asset download: ${response.status}`);
  }

  const fileStream = fs.createWriteStream(outputPath);
  await pipeline(Readable.fromWeb(response.body), fileStream);
  return true;
}

async function piperFileExists(request, response, next) {
  const filepath = request.url.slice(1);
  if (!AVAILABLE_FILES.includes(filepath)) {
    return response.sendStatus(404).end();
  }

  const fileLocation = path.join(PIPER_ASSETS_PATH, filepath);
  if (fs.existsSync(fileLocation)) return next();

  fs.mkdirSync(path.dirname(fileLocation), { recursive: true });
  const success = await downloadFromStorage(
    `${BUCKET_BASE}/${filepath}`,
    fileLocation
  ).catch(() => false);

  if (!success) return response.sendStatus(404).end();
  next();
}

module.exports = {
  piperFileExists,
  PIPER_ASSETS_PATH,
};
