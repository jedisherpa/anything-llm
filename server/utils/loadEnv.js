const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function resolveRuntimeEnvPath() {
  if (process.env.ANYTHINGLLM_ENV_PATH) return process.env.ANYTHINGLLM_ENV_PATH;
  if (!process.env.STORAGE_DIR) return null;
  return path.resolve(process.env.STORAGE_DIR, "..", ".env");
}

function loadEnv() {
  const runtimeEnvPath = resolveRuntimeEnvPath();

  if (process.env.NODE_ENV === "development") {
    dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
    return;
  }

  if (runtimeEnvPath && fs.existsSync(runtimeEnvPath)) {
    dotenv.config({ path: runtimeEnvPath });
    return;
  }

  dotenv.config();
}

module.exports = {
  loadEnv,
  resolveRuntimeEnvPath,
};
