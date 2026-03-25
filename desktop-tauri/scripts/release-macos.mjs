#!/usr/bin/env node

import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { auditAppBundle, auditDmg, DEFAULT_BUDGETS } from "./audit-macos-artifact.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, "..");
const repoRoot = resolve(desktopDir, "..");
const srcTauriDir = resolve(desktopDir, "src-tauri");
const tauriConfigPath = resolve(srcTauriDir, "tauri.conf.json");
const rootPackagePath = resolve(repoRoot, "package.json");
const dmgBuilderPath = resolve(scriptDir, "build-installer-dmg.sh");
const DEFAULT_NOTARY_TIMEOUT_MINUTES = 180;
const TARGET_TRIPLE = "macos-arm64";

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    skipBuild: false,
    identity: "",
    teamId: "",
    notaryProfile: "",
    version: "",
    outputDir: resolve(desktopDir, "release-artifacts"),
    adHoc: false,
    notaryTimeoutMinutes: DEFAULT_NOTARY_TIMEOUT_MINUTES,
    maxAppBytes: DEFAULT_BUDGETS.maxAppBytes,
    maxDmgBytes: DEFAULT_BUDGETS.maxDmgBytes,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--skip-build":
        options.skipBuild = true;
        break;
      case "--identity":
        options.identity = argv[++index] || "";
        break;
      case "--team-id":
        options.teamId = argv[++index] || "";
        break;
      case "--notary-profile":
        options.notaryProfile = argv[++index] || "";
        break;
      case "--version":
        options.version = argv[++index] || "";
        break;
      case "--output-dir":
      case "--out-dir":
        options.outputDir = resolve(argv[++index] || options.outputDir);
        break;
      case "--ad-hoc":
        options.adHoc = true;
        break;
      case "--notary-timeout-minutes":
        options.notaryTimeoutMinutes = Number(
          argv[++index] || options.notaryTimeoutMinutes
        );
        break;
      case "--max-app-bytes":
        options.maxAppBytes = Number(argv[++index] || options.maxAppBytes);
        break;
      case "--max-dmg-bytes":
        options.maxDmgBytes = Number(argv[++index] || options.maxDmgBytes);
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        fail(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node ./scripts/release-macos.mjs [options]

Options:
  --skip-build                    Reuse the current built app instead of running prepare/build
  --identity "<Developer ID>"    Sign with the given Developer ID Application identity
  --team-id "<TEAMID>"           Record the Apple team identifier in the release manifest
  --notary-profile "<name>"      Notarize using the named notarytool keychain profile
  --version "<version>"          Require the built app version to match this explicit release version
  --output-dir "<path>"          Write release artifacts and manifest to this directory
  --ad-hoc                        Ad-hoc sign the staged build for local verification only
  --notary-timeout-minutes <n>    Poll Apple notarization up to this many minutes before marking pending
  --max-app-bytes <n>             Override the .app audit budget
  --max-dmg-bytes <n>             Override the .dmg audit budget
  --help                          Show this help
`);
}

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

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runJson(command, args, options = {}) {
  const rendered = `${command} ${args.join(" ")}`;
  console.log(`\n> ${rendered}`);
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false,
    ...options,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${rendered}`);
  }

  try {
    return JSON.parse(result.stdout || "{}");
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${rendered}: ${error.message}`);
  }
}

function verifySpctlSignature(appPath) {
  const args = ["-a", "-t", "exec", "-vv", appPath];
  const rendered = `spctl ${args.join(" ")}`;
  console.log(`\n> ${rendered}`);
  const result = spawnSync("spctl", args, {
    encoding: "utf8",
    shell: false,
  });

  const combined = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;

  if (typeof result.status === "number" && result.status !== 0) {
    if (combined.includes("source=Unnotarized Developer ID")) {
      return {
        accepted: false,
        expectedBeforeNotarization: true,
      };
    }

    throw new Error(`Command failed (${result.status}): ${rendered}`);
  }

  return {
    accepted: true,
    expectedBeforeNotarization: false,
  };
}

function stage(name, detail) {
  console.log(`\n=== ${name} ===`);
  if (detail) console.log(detail);
}

function loadTauriConfig() {
  return JSON.parse(readFileSync(tauriConfigPath, "utf8"));
}

function appPaths(config) {
  const productName = config.package.productName;
  const version = config.package.version;
  return {
    productName,
    version,
    appName: `${productName}.app`,
    builtApp: resolve(srcTauriDir, "target", "release", "bundle", "macos", `${productName}.app`),
  };
}

function ensureBuiltApp(path) {
  if (!existsSync(path)) {
    fail(`Built app not found: ${path}`);
  }
}

function parseTeamId(identity) {
  const match = String(identity).match(/\(([A-Z0-9]+)\)/i);
  return match ? match[1] : "";
}

function loadSourceMetadata() {
  const pkg = JSON.parse(readFileSync(rootPackagePath, "utf8"));
  let gitSha = "unknown";
  let gitDirty = false;

  try {
    gitSha = runCapture("git", ["-C", repoRoot, "rev-parse", "HEAD"]);
    gitDirty = captureGitDirtyState();
  } catch {
    // Keep defaults if git metadata is unavailable.
  }

  return {
    upstreamVersion: pkg.version,
    upstreamRepositoryUrl: pkg.repository?.url || "https://github.com/mintplex-labs/anything-llm",
    gitSha,
    gitDirty,
  };
}

function captureGitDirtyState() {
  const result = spawnSync("git", ["-C", repoRoot, "status", "--porcelain"], {
    encoding: "utf8",
    shell: false,
    timeout: 5_000,
  });

  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      console.warn("Skipping git dirty-state capture: git status timed out.");
      return false;
    }
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "").trim() || "git status failed");
  }

  return (result.stdout || "").trim().length > 0;
}

function runCapture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "").trim() || `${command} failed`);
  }
  return (result.stdout || "").trim();
}

function createCleanStage(productName) {
  const root = resolve(tmpdir(), `prismai-release-${productName}-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function copyCleanApp(sourceApp, stageRoot, appName) {
  const targetApp = join(stageRoot, appName);
  run("/bin/sh", [
    "-lc",
    [
      `mkdir -p ${shellEscape(stageRoot)}`,
      `COPYFILE_DISABLE=1 tar -C ${shellEscape(dirname(sourceApp))} -cf - ${shellEscape(
        basename(sourceApp)
      )} | (cd ${shellEscape(stageRoot)} && COPYFILE_DISABLE=1 tar -xf -)`,
    ].join(" && "),
  ]);
  run("xattr", ["-cr", targetApp]);
  return targetApp;
}

function signApp(appPath, options) {
  if (options.adHoc) {
    run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
    run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
    return {
      mode: "ad-hoc",
      identity: "ad-hoc",
      teamId: "",
    };
  }

  if (!options.identity) {
    return {
      mode: "unsigned",
      identity: "",
      teamId: options.teamId || "",
    };
  }

  run("node", [resolve(scriptDir, "sign-macos-app.mjs"), appPath, options.identity]);
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  verifySpctlSignature(appPath);

  return {
    mode: "developer-id",
    identity: options.identity,
    teamId: options.teamId || parseTeamId(options.identity),
  };
}

function buildZip(appPath, zipPath) {
  rmSync(zipPath, { force: true });
  run("ditto", ["-c", "-k", "--keepParent", appPath, zipPath]);
}

function buildStyledDmg(appPath, dmgPath, volumeName, productName) {
  rmSync(dmgPath, { force: true });
  run("/bin/zsh", [dmgBuilderPath, appPath, dmgPath, volumeName, productName]);
}

function verifyDmgLayout(dmgPath, appName) {
  const attach = spawnSync(
    "hdiutil",
    ["attach", "-readonly", "-noverify", "-nobrowse", dmgPath],
    { encoding: "utf8" }
  );

  if (attach.error) throw attach.error;
  if (attach.status !== 0) {
    throw new Error(`Failed to mount DMG for verification: ${attach.stderr || attach.stdout}`);
  }

  const lines = `${attach.stdout || ""}${attach.stderr || ""}`.split("\n");
  const mountPoint = lines
    .find((line) => line.includes("/Volumes/"))
    ?.split("\t")
    .pop()
    ?.trim();

  if (!mountPoint) {
    throw new Error("Unable to determine mounted DMG volume path.");
  }

  try {
    const visible = readdirSync(mountPoint)
      .filter((entry) => !entry.startsWith("."))
      .sort((left, right) => left.localeCompare(right));
    const expected = ["Applications", appName].sort((left, right) => left.localeCompare(right));
    if (JSON.stringify(visible) !== JSON.stringify(expected)) {
      throw new Error(
        `Mounted DMG contents were ${visible.join(", ")} instead of ${expected.join(", ")}`
      );
    }
  } finally {
    run("hdiutil", ["detach", mountPoint]);
  }
}

function verifyMountedDmgSignature(dmgPath, appName) {
  const attach = spawnSync(
    "hdiutil",
    ["attach", "-readonly", "-noverify", "-nobrowse", dmgPath],
    { encoding: "utf8" }
  );

  if (attach.error) throw attach.error;
  if (attach.status !== 0) {
    throw new Error(`Failed to mount DMG for signature verification: ${attach.stderr || attach.stdout}`);
  }

  const lines = `${attach.stdout || ""}${attach.stderr || ""}`.split("\n");
  const mountPoint = lines
    .find((line) => line.includes("/Volumes/"))
    ?.split("\t")
    .pop()
    ?.trim();

  if (!mountPoint) {
    throw new Error("Unable to determine mounted DMG volume path for signature verification.");
  }

  try {
    run("codesign", [
      "--verify",
      "--deep",
      "--strict",
      "--verbose=2",
      join(mountPoint, appName),
    ]);
  } finally {
    run("hdiutil", ["detach", mountPoint]);
  }
}

async function sha256(filePath) {
  return await new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolvePromise(hash.digest("hex")));
  });
}

function artifactInfo(path, type) {
  const stat = statSync(path);
  return {
    type,
    path,
    fileName: basename(path),
    sizeBytes: stat.size,
  };
}

function buildChecksumsFile(artifacts) {
  return artifacts.map((artifact) => `${artifact.sha256}  ${artifact.fileName}`).join("\n") + "\n";
}

function releaseStatusForManifest(manifest) {
  if (manifest.error) return "error";
  if (manifest.notarization.dmg?.status === "pending") return "pending-dmg-notarization";
  if (manifest.notarization.zip?.status === "pending") return "pending-zip-notarization";
  if (manifest.notarization.dmg?.status === "accepted") return "complete-notarized";
  if (manifest.signing?.mode === "developer-id") return "complete-signed";
  if (manifest.signing?.mode === "ad-hoc") return "complete-ad-hoc";
  return "complete-unsigned";
}

function publishReleaseOutputs(outputDir, files) {
  mkdirSync(outputDir, { recursive: true });

  for (const file of files) {
    if (!file || !existsSync(file.sourcePath)) continue;
    rmSync(file.destinationPath, { force: true });
  }

  for (const file of files) {
    if (!file || !existsSync(file.sourcePath)) continue;
    copyFileSync(file.sourcePath, file.destinationPath);
  }
}

async function notarizeArtifact({
  artifactPath,
  profile,
  label,
  timeoutMinutes,
  logOutputPath,
}) {
  if (!profile) {
    return {
      enabled: false,
      label,
      status: "skipped",
      submissionId: "",
      submittedAt: "",
      completedAt: "",
      logPath: "",
    };
  }

  const submission = runJson("xcrun", [
    "notarytool",
    "submit",
    artifactPath,
    "--keychain-profile",
    profile,
    "--output-format",
    "json",
  ]);

  const submissionId = submission.id || submission.submissionId || "";
  if (!submissionId) {
    throw new Error(`Apple notarization did not return a submission id for ${label}.`);
  }

  const startedAt = new Date().toISOString();
  const timeoutAt = Date.now() + timeoutMinutes * 60 * 1000;

  while (Date.now() <= timeoutAt) {
    await sleep(30_000);
    const info = runJson("xcrun", [
      "notarytool",
      "info",
      submissionId,
      "--keychain-profile",
      profile,
      "--output-format",
      "json",
    ]);

    const status = String(info.status || info.statusSummary || "").trim();
    if (/accepted/i.test(status)) {
      return {
        enabled: true,
        label,
        status: "accepted",
        submissionId,
        submittedAt: startedAt,
        completedAt: new Date().toISOString(),
        logPath: "",
      };
    }

    if (/invalid|rejected/i.test(status)) {
      const log = runJson("xcrun", [
        "notarytool",
        "log",
        submissionId,
        "--keychain-profile",
        profile,
        "--output-format",
        "json",
      ]);
      writeFileSync(logOutputPath, `${JSON.stringify(log, null, 2)}\n`, "utf8");
      return {
        enabled: true,
        label,
        status: "invalid",
        submissionId,
        submittedAt: startedAt,
        completedAt: new Date().toISOString(),
        logPath: logOutputPath,
      };
    }
  }

  return {
    enabled: true,
    label,
    status: "pending",
    submissionId,
    submittedAt: startedAt,
    completedAt: "",
    logPath: "",
  };
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function stapleApp(appPath) {
  run("xcrun", ["stapler", "staple", appPath]);
  run("xcrun", ["stapler", "validate", appPath]);
}

function stapleDmg(dmgPath) {
  run("xcrun", ["stapler", "staple", dmgPath]);
  run("xcrun", ["stapler", "validate", dmgPath]);
}

function assertVersion(requestedVersion, actualVersion) {
  if (requestedVersion && requestedVersion !== actualVersion) {
    throw new Error(
      `Requested version ${requestedVersion} does not match the built app version ${actualVersion}. Update tauri.conf.json before releasing.`
    );
  }
}

function writeManifest(path, manifest) {
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function finalizeArtifactMetadata(artifacts, checksumsPath) {
  for (const artifact of artifacts) {
    artifact.sha256 = await sha256(artifact.path);
  }
  writeFileSync(checksumsPath, buildChecksumsFile(artifacts), "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  if (options.adHoc && options.identity) {
    fail("Use either --ad-hoc or --identity, not both.");
  }

  if (options.notaryProfile && !options.identity) {
    fail("--notary-profile requires a Developer ID signing identity.");
  }

  const config = loadTauriConfig();
  const { productName, version: configVersion, appName, builtApp } = appPaths(config);
  assertVersion(options.version, configVersion);
  const version = options.version || configVersion;
  const artifactBase = `${productName}-${version}-${TARGET_TRIPLE}`;
  const stageRoot = createCleanStage(productName);
  const publishRoot = join(stageRoot, "publish");
  mkdirSync(publishRoot, { recursive: true });
  const dmgPath = join(publishRoot, `${artifactBase}.dmg`);
  const zipPath = join(publishRoot, `${artifactBase}.zip`);
  const checksumsPath = join(publishRoot, `${productName}-${version}-checksums.txt`);
  const manifestPath = join(publishRoot, `${productName}-${version}-manifest.json`);
  const zipNotaryLogPath = join(publishRoot, `${artifactBase}-zip-notary-log.json`);
  const dmgNotaryLogPath = join(publishRoot, `${artifactBase}-dmg-notary-log.json`);
  const source = loadSourceMetadata();
  const auditBudgets = {
    maxAppBytes: options.maxAppBytes,
    maxDmgBytes: options.maxDmgBytes,
  };

  const manifest = {
    productName,
    version,
    target: TARGET_TRIPLE,
    createdAt: new Date().toISOString(),
    source,
    signing: null,
    audits: {},
    notarization: {
      zip: null,
      dmg: null,
    },
    artifacts: [],
    checksumsPath,
    stageRoot,
    releaseStatus: "running",
    error: null,
  };

  try {
    if (!options.skipBuild) {
      stage("prepare-runtime", "Building frontend assets, generating template DB, and assembling the production runtime.");
      run("corepack", ["yarn", "prepare:core"], { cwd: desktopDir });

      stage(
        "build-app",
        "Running the Tauri production build for the unsigned PrismAI app bundle only. Final installer packaging is owned by PrismAI scripts."
      );
      run("corepack", ["yarn", "tauri:build"], { cwd: desktopDir });
    }

    ensureBuiltApp(builtApp);

    stage("sign-app", "Copying the unsigned app bundle into a clean /tmp staging area and applying the selected signing policy.");
    const stagedApp = copyCleanApp(builtApp, stageRoot, appName);
    manifest.signing = signApp(stagedApp, options);

    stage("verify-app", "Auditing the staged app bundle against packaging budgets, banned payloads, and arm64-only binary rules.");
    manifest.audits.app = auditAppBundle(stagedApp, auditBudgets);
    if (!manifest.audits.app.passed) {
      throw new Error(`App audit failed: ${manifest.audits.app.failures.join("; ")}`);
    }

    stage("build-zip", "Creating the signed app ZIP fallback artifact.");
    buildZip(stagedApp, zipPath);
    manifest.artifacts.push(artifactInfo(zipPath, "zip"));

    if (options.notaryProfile) {
      stage("notarize-zip", "Submitting the signed ZIP to Apple and polling until it is accepted, rejected, or pending past the timeout.");
      manifest.notarization.zip = await notarizeArtifact({
        artifactPath: zipPath,
        profile: options.notaryProfile,
        label: "zip",
        timeoutMinutes: options.notaryTimeoutMinutes,
        logOutputPath: zipNotaryLogPath,
      });

      if (manifest.notarization.zip.status === "invalid") {
        throw new Error(`ZIP notarization was rejected. See ${zipNotaryLogPath}`);
      }

      if (manifest.notarization.zip.status === "pending") {
        stage(
          "publish-artifacts",
          "ZIP notarization is still pending. Publishing the exact signed ZIP, checksums, logs, and manifest without mutating the notarized artifact."
        );
        await finalizeArtifactMetadata(manifest.artifacts, checksumsPath);
        manifest.artifacts.push(artifactInfo(checksumsPath, "checksums"));
        manifest.artifacts.at(-1).sha256 = await sha256(checksumsPath);
        manifest.releaseStatus = releaseStatusForManifest(manifest);
        writeManifest(manifestPath, manifest);
        publishReleaseOutputs(options.outputDir, [
          { sourcePath: zipPath, destinationPath: join(options.outputDir, `${artifactBase}.zip`) },
          {
            sourcePath: checksumsPath,
            destinationPath: join(options.outputDir, `${productName}-${version}-checksums.txt`),
          },
          {
            sourcePath: manifestPath,
            destinationPath: join(options.outputDir, `${productName}-${version}-manifest.json`),
          },
          {
            sourcePath: zipNotaryLogPath,
            destinationPath: join(options.outputDir, `${artifactBase}-zip-notary-log.json`),
          },
        ]);
        console.log(
          `\nZIP notarization is still pending with Apple. Submission: ${manifest.notarization.zip.submissionId}`
        );
        console.log(`ZIP: ${join(options.outputDir, `${artifactBase}.zip`)}`);
        console.log(
          `Manifest: ${join(options.outputDir, `${productName}-${version}-manifest.json`)}`
        );
        return;
      }

      stage("staple-app", "Stapling Apple’s notarization ticket onto the signed app before building the installer DMG.");
      stapleApp(stagedApp);
    }

    stage("build-dmg", "Generating the styled Finder installer DMG from the final signed app bundle.");
    buildStyledDmg(stagedApp, dmgPath, `${productName} Installer`, productName);
    verifyDmgLayout(dmgPath, appName);
    verifyMountedDmgSignature(dmgPath, appName);
    manifest.artifacts.push(artifactInfo(dmgPath, "dmg"));

    stage("verify-dmg", "Auditing the final DMG against size budgets and verifying the mounted installer contents.");
    manifest.audits.dmg = auditDmg(dmgPath, auditBudgets);
    if (!manifest.audits.dmg.passed) {
      throw new Error(`DMG audit failed: ${manifest.audits.dmg.failures.join("; ")}`);
    }

    if (options.notaryProfile) {
      stage("notarize-dmg", "Submitting the polished installer DMG to Apple for notarization.");
      manifest.notarization.dmg = await notarizeArtifact({
        artifactPath: dmgPath,
        profile: options.notaryProfile,
        label: "dmg",
        timeoutMinutes: options.notaryTimeoutMinutes,
        logOutputPath: dmgNotaryLogPath,
      });

      if (manifest.notarization.dmg.status === "invalid") {
        throw new Error(`DMG notarization was rejected. See ${dmgNotaryLogPath}`);
      }

      if (manifest.notarization.dmg.status === "pending") {
        stage(
          "publish-artifacts",
          "DMG notarization is still pending. Publishing the exact signed outputs, checksums, logs, and manifest without mutating the notarized artifact."
        );
        await finalizeArtifactMetadata(manifest.artifacts, checksumsPath);
        manifest.artifacts.push(artifactInfo(checksumsPath, "checksums"));
        manifest.artifacts.at(-1).sha256 = await sha256(checksumsPath);
        manifest.releaseStatus = releaseStatusForManifest(manifest);
        writeManifest(manifestPath, manifest);
        publishReleaseOutputs(options.outputDir, [
          { sourcePath: zipPath, destinationPath: join(options.outputDir, `${artifactBase}.zip`) },
          { sourcePath: dmgPath, destinationPath: join(options.outputDir, `${artifactBase}.dmg`) },
          {
            sourcePath: checksumsPath,
            destinationPath: join(options.outputDir, `${productName}-${version}-checksums.txt`),
          },
          {
            sourcePath: manifestPath,
            destinationPath: join(options.outputDir, `${productName}-${version}-manifest.json`),
          },
          {
            sourcePath: zipNotaryLogPath,
            destinationPath: join(options.outputDir, `${artifactBase}-zip-notary-log.json`),
          },
          {
            sourcePath: dmgNotaryLogPath,
            destinationPath: join(options.outputDir, `${artifactBase}-dmg-notary-log.json`),
          },
        ]);
        console.log(
          `\nDMG notarization is still pending with Apple. Submission: ${manifest.notarization.dmg.submissionId}`
        );
        console.log(`DMG: ${join(options.outputDir, `${artifactBase}.dmg`)}`);
        console.log(
          `Manifest: ${join(options.outputDir, `${productName}-${version}-manifest.json`)}`
        );
        return;
      }

      stage("staple-dmg", "Stapling the accepted DMG so Gatekeeper recognizes it offline.");
      stapleDmg(dmgPath);
    }

    stage("publish-artifacts", "Hashing the release outputs and writing the machine-readable release manifest.");
    await finalizeArtifactMetadata(manifest.artifacts, checksumsPath);
    manifest.artifacts.push(artifactInfo(checksumsPath, "checksums"));
    manifest.artifacts.at(-1).sha256 = await sha256(checksumsPath);
    manifest.releaseStatus = releaseStatusForManifest(manifest);
    writeManifest(manifestPath, manifest);
    publishReleaseOutputs(options.outputDir, [
      { sourcePath: zipPath, destinationPath: join(options.outputDir, `${artifactBase}.zip`) },
      { sourcePath: dmgPath, destinationPath: join(options.outputDir, `${artifactBase}.dmg`) },
      {
        sourcePath: checksumsPath,
        destinationPath: join(options.outputDir, `${productName}-${version}-checksums.txt`),
      },
      {
        sourcePath: manifestPath,
        destinationPath: join(options.outputDir, `${productName}-${version}-manifest.json`),
      },
      {
        sourcePath: zipNotaryLogPath,
        destinationPath: join(options.outputDir, `${artifactBase}-zip-notary-log.json`),
      },
      {
        sourcePath: dmgNotaryLogPath,
        destinationPath: join(options.outputDir, `${artifactBase}-dmg-notary-log.json`),
      },
    ]);

    console.log("\nProfessional macOS release complete.");
    console.log(`DMG: ${join(options.outputDir, `${artifactBase}.dmg`)}`);
    console.log(`ZIP: ${join(options.outputDir, `${artifactBase}.zip`)}`);
    console.log(`Checksums: ${join(options.outputDir, `${productName}-${version}-checksums.txt`)}`);
    console.log(`Manifest: ${join(options.outputDir, `${productName}-${version}-manifest.json`)}`);
  } catch (error) {
    manifest.error = error instanceof Error ? error.message : String(error);
    manifest.releaseStatus = releaseStatusForManifest(manifest);

    try {
      if (manifest.artifacts.length > 0) {
        await finalizeArtifactMetadata(manifest.artifacts.filter((artifact) => existsSync(artifact.path)), checksumsPath);
      }
      writeManifest(manifestPath, manifest);
    } catch {
      // Do not mask the original release failure with manifest write issues.
    }

    throw error;
  }
}

await main();
