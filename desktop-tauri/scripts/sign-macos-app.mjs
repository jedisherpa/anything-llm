#!/usr/bin/env node

import { readdirSync, statSync, existsSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [, , appArg, identityArg] = process.argv;

if (!appArg || !identityArg) {
  console.error(
    "Usage: node ./scripts/sign-macos-app.mjs <path-to-app> <developer-id-identity>"
  );
  process.exit(1);
}

const appPath = resolve(appArg);
const identity = identityArg.trim();
const scriptDir = dirname(fileURLToPath(import.meta.url));
const nodeEntitlements = resolve(scriptDir, "../src-tauri/entitlements.node.plist");

if (!existsSync(appPath)) {
  console.error(`App bundle not found: ${appPath}`);
  process.exit(1);
}

if (!existsSync(nodeEntitlements)) {
  console.error(`Node entitlements file not found: ${nodeEntitlements}`);
  process.exit(1);
}

const binaryExtensions = new Set([".dylib", ".node", ".bare", ".so"]);
const signTargets = [];

function run(command, args, options = {}) {
  const rendered = `${command} ${args.join(" ")}`;
  console.log(`\n> ${rendered}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${rendered}`);
  }
}

function inspectFileType(filePath) {
  const result = spawnSync("file", ["-b", filePath], {
    encoding: "utf8",
  });

  if (result.error || result.status !== 0) return "";
  return result.stdout.trim();
}

function isCandidate(filePath, stat) {
  if (!stat.isFile()) return false;
  const ext = extname(filePath).toLowerCase();
  if (binaryExtensions.has(ext)) return true;
  return (stat.mode & 0o111) !== 0;
}

function isMachOBinary(filePath) {
  return inspectFileType(filePath).includes("Mach-O");
}

function walk(dirPath) {
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = resolve(dirPath, entry.name);

    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      walk(entryPath);
      continue;
    }

    const stat = statSync(entryPath);
    if (!isCandidate(entryPath, stat)) continue;
    if (!isMachOBinary(entryPath)) continue;
    signTargets.push(entryPath);
  }
}

function pathDepth(filePath) {
  return filePath.split("/").length;
}

function signingArgsForTarget(target) {
  const args = ["--force", "--timestamp", "--options", "runtime", "--sign", identity];

  if (basename(target) === "node") {
    args.push("--entitlements", nodeEntitlements);
  }

  args.push(target);
  return args;
}

walk(appPath);

signTargets.sort((a, b) => pathDepth(b) - pathDepth(a) || a.localeCompare(b));

console.log(
  `Found ${signTargets.length} nested Mach-O binaries inside ${basename(appPath)}`
);

for (const target of signTargets) {
  run("codesign", signingArgsForTarget(target));
}

// Remove any existing bundle-level signature before sealing the final app.
spawnSync("codesign", ["--remove-signature", appPath], {
  stdio: "ignore",
});

run("codesign", [
  "--force",
  "--timestamp",
  "--options",
  "runtime",
  "--sign",
  identity,
  appPath,
]);

run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);

console.log(`\nSuccessfully signed ${appPath}`);
