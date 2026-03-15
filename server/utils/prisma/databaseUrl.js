const fs = require("fs");
const path = require("path");

function normalizeSqlitePath(filePath = "") {
  return String(filePath).split(path.sep).join("/");
}

function toAbsoluteSqliteUrl(filePath = "") {
  const normalized = normalizeSqlitePath(filePath);
  if (normalized.startsWith("/")) return `file://${normalized}`;
  return `file:///${normalized}`;
}

function resolvePrismaDatasourceUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!process.env.STORAGE_DIR) return null;

  const storageDir = path.resolve(process.env.STORAGE_DIR);
  fs.mkdirSync(storageDir, { recursive: true });
  const dbPath = path.join(storageDir, "anythingllm.db");
  return toAbsoluteSqliteUrl(dbPath);
}

module.exports = { resolvePrismaDatasourceUrl };
