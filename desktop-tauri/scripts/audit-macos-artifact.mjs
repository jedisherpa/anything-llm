#!/usr/bin/env node

import { readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const DEFAULT_BUDGETS = {
  maxAppBytes: 1_050_000_000,
  maxDmgBytes: 500_000_000,
};

const BANNED_DIRECTORY_NAMES = new Set([
  "__tests__",
  "__mocks__",
  "test",
  "tests",
  "testing",
  "benchmark",
  "benchmarks",
  "coverage",
  ".nyc_output",
  ".github",
  ".husky",
  ".vscode",
  "docs",
  "doc",
  "website",
  "example",
  "examples",
  "demo",
  "demos",
  "man",
  ".bin",
]);

const BANNED_FILE_NAMES = new Set([
  ".ds_store",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn-error.log",
]);

const LEGAL_DOC_NAMES = /^(license|licence|notice|notices|copying|authors|patents?)(\..+)?$/i;
const DOC_FILE_NAMES = /^(readme|changelog|history|changes|contributing|security|todo|roadmap|release-notes)(\..+)?$/i;
const DOC_TEXT_EXTENSIONS = new Set([
  "",
  ".md",
  ".markdown",
  ".mdx",
  ".txt",
  ".rst",
  ".adoc",
  ".html",
  ".htm",
]);
const NON_MAC_FILE_EXTENSIONS = new Set([
  ".dll",
  ".exe",
  ".lib",
  ".pdb",
  ".bat",
  ".cmd",
]);
const NATIVE_EXTENSIONS = new Set([".dylib", ".node", ".so", ".bare"]);
const NON_MAC_RUNTIME_SEGMENT_RE =
  /\/(linux|win32|windows|android|freebsd|openbsd|sunos)\/(x64|arm64|arm|ia32)\//;

function usage() {
  console.log(`Usage:
  node ./scripts/audit-macos-artifact.mjs --target <path> --type <runtime|app|dmg> [options]

Options:
  --json-out <path>        Write the full audit result to a JSON file
  --max-app-bytes <n>      Override the default .app size budget (${DEFAULT_BUDGETS.maxAppBytes})
  --max-dmg-bytes <n>      Override the default .dmg size budget (${DEFAULT_BUDGETS.maxDmgBytes})
`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    target: "",
    type: "",
    jsonOut: "",
    maxAppBytes: DEFAULT_BUDGETS.maxAppBytes,
    maxDmgBytes: DEFAULT_BUDGETS.maxDmgBytes,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--target":
        options.target = resolve(argv[++index] || "");
        break;
      case "--type":
        options.type = (argv[++index] || "").trim().toLowerCase();
        break;
      case "--json-out":
        options.jsonOut = resolve(argv[++index] || "");
        break;
      case "--max-app-bytes":
        options.maxAppBytes = Number(argv[++index] || options.maxAppBytes);
        break;
      case "--max-dmg-bytes":
        options.maxDmgBytes = Number(argv[++index] || options.maxDmgBytes);
        break;
      case "--help":
      case "-h":
        usage();
        process.exit(0);
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  if (!options.target) fail("Missing required --target");
  if (!["runtime", "app", "dmg"].includes(options.type)) {
    fail("Missing or invalid --type. Use runtime, app, or dmg.");
  }

  return options;
}

function inspectFileType(filePath) {
  const result = spawnSync("file", ["-b", filePath], {
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) return "";
  return result.stdout.trim();
}

function isMachOBinaryDescription(description) {
  return description.includes("Mach-O");
}

function isTextExecutable(description) {
  const normalized = description.toLowerCase();
  return (
    normalized.includes("script text executable") ||
    normalized.includes("text executable") ||
    normalized.includes("shell script") ||
    normalized.includes("python script") ||
    normalized.includes("perl script")
  );
}

function shouldInspectAsBinary(filePath, stat) {
  if (!stat.isFile()) return false;
  const extension = extname(filePath).toLowerCase();
  if (NATIVE_EXTENSIONS.has(extension)) return true;
  return (stat.mode & 0o111) !== 0;
}

function normalizeRelative(root, filePath) {
  return relative(root, filePath).replace(/\\/g, "/");
}

function isBannedRelativePath(relativePath, dirent) {
  const normalized = `/${relativePath.toLowerCase()}/`;
  const baseName = basename(relativePath).toLowerCase();
  const extension = extname(baseName).toLowerCase();
  const isOpenSourceBundleDoc =
    normalized.includes("/opensource/anythingllm/") &&
    (LEGAL_DOC_NAMES.test(baseName) || DOC_FILE_NAMES.test(baseName));

  if (dirent.isDirectory()) {
    if (BANNED_DIRECTORY_NAMES.has(baseName)) return true;
    if (
      /\/prebuilds\/(darwin-x64|linux[^/]*|win32[^/]*|windows[^/]*|android[^/]*|freebsd[^/]*|openbsd[^/]*|sunos[^/]*)\//.test(
        normalized
      )
    ) {
      return true;
    }
    if (/\/napi-v\d+\/darwin\/x64\//.test(normalized)) return true;
    if (/\/napi-v\d+\/(linux|win32|windows|android|freebsd|openbsd|sunos)\//.test(normalized)) {
      return true;
    }
    if (
      /\/vendor\/[^/]+\/(darwin-x64|linux[^/]*|win32[^/]*|windows[^/]*|android[^/]*|freebsd[^/]*|openbsd[^/]*|sunos[^/]*)\//.test(
        normalized
      )
    ) {
      return true;
    }
    return false;
  }

  if (BANNED_FILE_NAMES.has(baseName)) return true;
  if (NON_MAC_FILE_EXTENSIONS.has(extname(baseName).toLowerCase())) return true;
  if (baseName.endsWith(".map") || baseName.endsWith(".tsbuildinfo")) return true;
  if (
    !isOpenSourceBundleDoc &&
    DOC_FILE_NAMES.test(baseName) &&
    DOC_TEXT_EXTENSIONS.has(extension) &&
    !LEGAL_DOC_NAMES.test(baseName)
  ) {
    return true;
  }

  if (/\/darwin\/x64\//.test(normalized)) return true;
  if (NON_MAC_RUNTIME_SEGMENT_RE.test(normalized)) return true;
  if (
    /(darwin-x64|linux-arm|linux-x64|win32-arm|win32-x64|windows-arm|windows-x64|android-arm|android-x64|freebsd-x64|openbsd-x64|sunos-x64)/.test(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

function collectFiles(root, current, result) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolutePath = resolve(current, entry.name);
    const relativePath = normalizeRelative(root, absolutePath);

    if (isBannedRelativePath(relativePath, entry)) {
      result.bannedPaths.push(relativePath);
      continue;
    }

    if (entry.isDirectory()) {
      collectFiles(root, absolutePath, result);
      continue;
    }

    if (!entry.isFile()) continue;

    result.fileCount += 1;
    const stat = statSync(absolutePath);
    result.totalSizeBytes += stat.size;

    if (!shouldInspectAsBinary(absolutePath, stat)) continue;

    const fileType = inspectFileType(absolutePath);
    if (!fileType) return;

    if (isMachOBinaryDescription(fileType)) {
      result.nativeExecutableCount += 1;

      if (/x86_64/.test(fileType)) {
        result.x64Binaries.push({
          path: relativePath,
          description: fileType,
        });
      }

      if (result.type === "app" && !isExpectedAppNative(relativePath)) {
        result.unexpectedNativePaths.push(relativePath);
      }
      return;
    }

    if ((stat.mode & 0o111) !== 0 && !isTextExecutable(fileType)) {
      result.unexpectedExecutablePaths.push({
        path: relativePath,
        description: fileType,
      });
    }
  }
}

function isExpectedAppNative(relativePath) {
  return (
    relativePath.startsWith("Contents/MacOS/") ||
    relativePath.startsWith("Contents/Resources/_up_/runtime/") ||
    relativePath.startsWith("Contents/Resources/runtime/")
  );
}

function summarizeFailures(result, budgets) {
  const failures = [];

  if (result.type === "app" && result.sizeBytes > budgets.maxAppBytes) {
    failures.push(
      `App bundle is ${humanSize(result.sizeBytes)}, above budget ${humanSize(budgets.maxAppBytes)}`
    );
  }

  if (result.type === "dmg" && result.sizeBytes > budgets.maxDmgBytes) {
    failures.push(
      `DMG is ${humanSize(result.sizeBytes)}, above budget ${humanSize(budgets.maxDmgBytes)}`
    );
  }

  if (result.bannedPaths.length > 0) {
    failures.push(`Found banned packaged paths (${result.bannedPaths.length})`);
  }

  if (result.x64Binaries.length > 0) {
    failures.push(`Found ${result.x64Binaries.length} x86_64 native binaries in arm64 release`);
  }

  if (result.unexpectedNativePaths.length > 0) {
    failures.push(
      `Found unexpected native binaries outside approved macOS bundle roots (${result.unexpectedNativePaths.length})`
    );
  }

  if (result.unexpectedExecutablePaths.length > 0) {
    failures.push(
      `Found unexpected executable files that are not Mach-O or script text (${result.unexpectedExecutablePaths.length})`
    );
  }

  return failures;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

export function auditRuntimeTree(targetPath) {
  return auditFilesystemTarget(targetPath, "runtime");
}

export function auditAppBundle(targetPath, budgets = DEFAULT_BUDGETS) {
  return auditFilesystemTarget(targetPath, "app", budgets);
}

export function auditDmg(targetPath, budgets = DEFAULT_BUDGETS) {
  const stat = statSync(targetPath);
  const result = {
    type: "dmg",
    targetPath: resolve(targetPath),
    sizeBytes: stat.size,
    fileCount: 1,
    nativeExecutableCount: 0,
    bannedPaths: [],
    x64Binaries: [],
    unexpectedNativePaths: [],
    unexpectedExecutablePaths: [],
  };
  result.failures = summarizeFailures(result, budgets);
  result.passed = result.failures.length === 0;
  return result;
}

function auditFilesystemTarget(targetPath, type, budgets = DEFAULT_BUDGETS) {
  const resolvedTarget = resolve(targetPath);
  const result = {
    type,
    targetPath: resolvedTarget,
    totalSizeBytes: 0,
    sizeBytes: 0,
    fileCount: 0,
    nativeExecutableCount: 0,
    bannedPaths: [],
    x64Binaries: [],
    unexpectedNativePaths: [],
    unexpectedExecutablePaths: [],
  };

  collectFiles(resolvedTarget, resolvedTarget, result);
  result.sizeBytes = result.totalSizeBytes;
  delete result.totalSizeBytes;
  result.failures = summarizeFailures(result, budgets);
  result.passed = result.failures.length === 0;
  return result;
}

function renderSummary(result) {
  console.log(`Audit target: ${result.targetPath}`);
  console.log(`Type: ${result.type}`);
  console.log(`Size: ${humanSize(result.sizeBytes)}`);
  console.log(`Files: ${result.fileCount}`);
  console.log(`Native executables: ${result.nativeExecutableCount}`);

  if (result.failures.length === 0) {
    console.log("Audit: PASS");
    return;
  }

  console.log("Audit: FAIL");
  for (const failure of result.failures) {
    console.log(`- ${failure}`);
  }

  if (result.x64Binaries.length > 0) {
    console.log("\nFirst x86_64 binaries:");
    for (const entry of result.x64Binaries.slice(0, 10)) {
      console.log(`- ${entry.path} :: ${entry.description}`);
    }
  }

  if (result.bannedPaths.length > 0) {
    console.log("\nFirst banned paths:");
    for (const path of result.bannedPaths.slice(0, 15)) {
      console.log(`- ${path}`);
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  let result;

  if (options.type === "runtime") {
    result = auditRuntimeTree(options.target);
  } else if (options.type === "app") {
    result = auditAppBundle(options.target, options);
  } else {
    result = auditDmg(options.target, options);
  }

  if (options.jsonOut) {
    writeFileSync(options.jsonOut, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  renderSummary(result);
  if (!result.passed) process.exit(1);
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
