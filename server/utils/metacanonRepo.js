const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_OPEN_FILE = "frontend/src/pages/MetacanonAI/index.jsx";
const MAX_TEXT_FILE_BYTES = 3 * 1024 * 1024;
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "storage",
  "target",
]);

function normalizeRelativePath(inputPath = "") {
  const normalized = path.posix.normalize(
    String(inputPath || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
  );

  if (normalized === "." || normalized === "/") return "";
  if (normalized.startsWith("../")) {
    throw new Error("Invalid path. Must remain within the repo root.");
  }

  return normalized;
}

function resolveRepoPath(relativePath = "") {
  const normalized = normalizeRelativePath(relativePath);
  const absolutePath = path.resolve(REPO_ROOT, normalized);
  const rootWithSep = `${REPO_ROOT}${path.sep}`;

  if (absolutePath !== REPO_ROOT && !absolutePath.startsWith(rootWithSep)) {
    throw new Error("Invalid path. Must remain within the repo root.");
  }

  return { normalized, absolutePath };
}

function shouldIgnoreEntry(entry) {
  return entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name);
}

function isBinaryBuffer(buffer) {
  const sample = buffer.subarray(0, 4096);
  let suspiciousBytes = 0;

  for (const byte of sample) {
    if (byte === 0) return true;
    if (byte < 7 || (byte > 13 && byte < 32)) suspiciousBytes += 1;
  }

  return sample.length > 0 && suspiciousBytes / sample.length > 0.2;
}

async function statSafe(absolutePath) {
  try {
    return await fs.promises.stat(absolutePath);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function getRepoInfo() {
  return {
    root: REPO_ROOT,
    defaultOpenFile: DEFAULT_OPEN_FILE,
    maxTextFileBytes: MAX_TEXT_FILE_BYTES,
  };
}

async function listDirectory(relativeDir = "") {
  const { normalized, absolutePath } = resolveRepoPath(relativeDir);
  const stats = await statSafe(absolutePath);

  if (!stats) throw new Error("Directory not found.");
  if (!stats.isDirectory()) throw new Error("Path is not a directory.");

  const entries = await fs.promises.readdir(absolutePath, {
    withFileTypes: true,
  });

  const children = await Promise.all(
    entries
      .filter((entry) => !shouldIgnoreEntry(entry))
      .map(async (entry) => {
        const childRelativePath = normalizeRelativePath(
          path.posix.join(normalized, entry.name)
        );
        const childAbsolutePath = path.resolve(absolutePath, entry.name);
        const childStats = await fs.promises.stat(childAbsolutePath);

        return {
          name: entry.name,
          relativePath: childRelativePath,
          isDirectory: entry.isDirectory(),
          size: entry.isDirectory() ? null : childStats.size,
          updatedAt: childStats.mtime.toISOString(),
        };
      })
  );

  children.sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) {
      return left.isDirectory ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

  return {
    relativePath: normalized,
    entries: children,
  };
}

async function buildFileIndex() {
  const files = [];

  async function walk(relativeDir = "") {
    const { absolutePath } = resolveRepoPath(relativeDir);
    const entries = await fs.promises.readdir(absolutePath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (shouldIgnoreEntry(entry)) continue;

      const nextRelativePath = normalizeRelativePath(
        path.posix.join(relativeDir, entry.name)
      );

      if (entry.isDirectory()) {
        await walk(nextRelativePath);
        continue;
      }

      files.push(nextRelativePath);
    }
  }

  await walk("");
  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function detectLineEnding(text = "") {
  const hasCrlf = text.includes("\r\n");
  const hasBareLf = /(^|[^\r])\n/.test(text);
  if (hasCrlf && !hasBareLf) return "\r\n";
  return "\n";
}

async function readFile(relativePath = "") {
  const { normalized, absolutePath } = resolveRepoPath(relativePath);
  const stats = await statSafe(absolutePath);

  if (!stats) throw new Error("File not found.");
  if (!stats.isFile()) throw new Error("Path is not a file.");

  const buffer = await fs.promises.readFile(absolutePath);
  const binary = isBinaryBuffer(buffer);
  const tooLarge = buffer.length > MAX_TEXT_FILE_BYTES;
  const content = !binary && !tooLarge ? buffer.toString("utf8") : null;

  return {
    relativePath: normalized,
    absolutePath,
    size: buffer.length,
    updatedAt: stats.mtime.toISOString(),
    isBinary: binary,
    tooLarge,
    maxTextFileBytes: MAX_TEXT_FILE_BYTES,
    lineEnding: content !== null ? detectLineEnding(content) : "\n",
    content,
  };
}

async function writeFile(relativePath = "", nextContent = "") {
  const { normalized, absolutePath } = resolveRepoPath(relativePath);
  const stats = await statSafe(absolutePath);

  if (!stats) throw new Error("File not found.");
  if (!stats.isFile()) throw new Error("Path is not a file.");

  const currentBuffer = await fs.promises.readFile(absolutePath);
  if (isBinaryBuffer(currentBuffer)) {
    throw new Error("Binary files cannot be edited from Repo Lab.");
  }

  const currentContent = currentBuffer.toString("utf8");
  const lineEnding = detectLineEnding(currentContent);
  const contentToWrite =
    lineEnding === "\r\n"
      ? String(nextContent).replace(/\r?\n/g, "\r\n")
      : String(nextContent);

  await fs.promises.writeFile(absolutePath, contentToWrite, "utf8");
  return readFile(normalized);
}

module.exports = {
  getRepoInfo,
  listDirectory,
  buildFileIndex,
  readFile,
  writeFile,
  normalizeRelativePath,
};
