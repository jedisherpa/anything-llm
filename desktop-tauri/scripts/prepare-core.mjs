#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditRuntimeTree } from "./audit-macos-artifact.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const coreRoot = resolve(__dirname, "../..");
const packagingDir = join(coreRoot, "desktop-tauri", "packaging");
const runtimeManifestPath = join(packagingDir, "runtime-manifest.json");

const serverDir = join(coreRoot, "server");
const collectorDir = join(coreRoot, "collector");
const frontendDir = join(coreRoot, "frontend");
const governanceDocsDir = join(
  coreRoot,
  "data",
  "metacanon",
  "governance-documents"
);
const rootLicensePath = join(coreRoot, "LICENSE");
const rootReadmePath = join(coreRoot, "README.md");
const rootPackagePath = join(coreRoot, "package.json");
const serverPublicDir = join(serverDir, "public");
const frontendDistDir = join(frontendDir, "dist");
const prismaSchemaPath = join(serverDir, "prisma", "schema.prisma");
const prismaRuntimeSchemaPath = join(serverDir, "prisma", "runtime.prisma");
const runtimeRoot = join(coreRoot, "desktop-tauri", "runtime");
const runtimeCoreDir = join(runtimeRoot, "core");
const runtimeTemplateDir = join(runtimeRoot, "template");
const runtimeTemplateDbPath = join(runtimeTemplateDir, "anythingllm.db");
const runtimeServerDir = join(runtimeCoreDir, "server");
const runtimeCollectorDir = join(runtimeCoreDir, "collector");
const runtimeGovernanceDocsDir = join(
  runtimeCoreDir,
  "data",
  "metacanon",
  "governance-documents"
);
const runtimeBinDir = join(runtimeRoot, "bin");
const runtimeOpenSourceDir = join(runtimeRoot, "OpenSource", "AnythingLLM");
const bundledNodePath = join(runtimeBinDir, "node");
const templateWorkspaceDir = "/tmp/anythingllm-desktop-template";
const templateStorageDir = join(templateWorkspaceDir, "storage");
const prismaCacheDir = join(templateWorkspaceDir, ".cache");
const templateDbPath = join(templateStorageDir, "anythingllm.db");
const defaultTemplateSourceDbPath = process.env.HOME
  ? join(
      process.env.HOME,
      "Library",
      "Application Support",
      "com.sovereign.anythingllm.desktop",
      "storage",
      "anythingllm.db"
    )
  : "";
const shouldSkipInstall = process.argv.includes("--skip-install");
const shouldForceInstall = process.argv.includes("--install");
const shouldSkipRuntimeProdInstall = process.argv.includes(
  "--skip-runtime-prod-install"
);

const PRUNABLE_DIR_NAMES = new Set([
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
]);
const PRUNABLE_FILE_NAMES = new Set([
  ".ds_store",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn-error.log",
  "tsconfig.tsbuildinfo",
]);
const NON_MAC_FILE_EXTENSIONS = new Set([
  ".dll",
  ".exe",
  ".lib",
  ".pdb",
  ".bat",
  ".cmd",
]);
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
const NON_MAC_RUNTIME_SEGMENT_RE =
  /\/(linux|win32|windows|android|freebsd|openbsd|sunos)\/(x64|arm64|arm|ia32)\//;
const LEGAL_DOC_NAMES =
  /^(license|licence|notice|notices|copying|authors|patents?)(\..+)?$/i;
const DOC_FILE_NAMES =
  /^(readme|changelog|history|changes|contributing|security|todo|roadmap|release-notes)(\..+)?$/i;

function run(command, args, cwd) {
  return runWithEnv(command, args, cwd, {});
}

function runWithEnv(command, args, cwd, extraEnv = {}) {
  const rendered = `${command} ${args.join(" ")}`;
  console.log(`\n> (${cwd}) ${rendered}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${rendered}`);
  }
}

function runCapture(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || "").trim() || `${command} failed`
    );
  }

  return (result.stdout || "").trim();
}

function forceRemovePath(target, options = {}) {
  try {
    rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
      ...options,
    });
  } catch (error) {
    if (!["ENOTEMPTY", "EPERM", "EBUSY"].includes(error?.code)) {
      throw error;
    }

    const result = spawnSync("/bin/rm", ["-rf", target], {
      stdio: "inherit",
    });

    if (result.error) {
      throw result.error;
    }

    if (typeof result.status === "number" && result.status !== 0) {
      throw error;
    }
  }
}

function copyTree(source, destination) {
  forceRemovePath(destination);
  const sourceStat = statSync(source);
  if (sourceStat.isDirectory()) {
    try {
      run("cp", ["-cR", source, destination], coreRoot);
    } catch (_error) {
      run("cp", ["-R", source, destination], coreRoot);
    }
    return;
  }

  cpSync(source, destination, { force: true });
}

function ensureCoreLayout() {
  const required = [
    serverDir,
    collectorDir,
    frontendDir,
    governanceDocsDir,
    runtimeManifestPath,
    rootLicensePath,
    rootReadmePath,
    rootPackagePath,
  ];

  for (const target of required) {
    if (!existsSync(target)) {
      throw new Error(`Missing required path: ${target}`);
    }
  }
}

function installIfNeeded(name, dir) {
  const hasNodeModules = existsSync(join(dir, "node_modules"));
  if (shouldSkipInstall) {
    console.log(
      `Skipping source dependency install for ${name} (--skip-install).`
    );
    return;
  }

  if (hasNodeModules && !shouldForceInstall) {
    console.log(
      `Dependencies already present for ${name}; skipping source install.`
    );
    return;
  }

  run(
    "corepack",
    ["yarn", "install", "--frozen-lockfile", "--non-interactive"],
    dir
  );
}

function ensureRuntimeEnvFiles() {
  const serverEnvPath = join(serverDir, ".env");
  const collectorEnvPath = join(collectorDir, ".env");

  if (!existsSync(serverEnvPath)) {
    const serverEnv = [
      "SERVER_PORT=3033",
      "SERVER_PORT_FALLBACKS=3032,3031",
      "JWT_SECRET=local-desktop-jwt-secret-change-me",
      "SIG_KEY=local-desktop-signature-key-change-me-please",
      "SIG_SALT=local-desktop-signature-salt-change-me-please",
      "DISABLE_TELEMETRY=true",
      "",
    ].join("\n");
    writeFileSync(serverEnvPath, serverEnv, "utf8");
    console.log(`Created ${serverEnvPath}`);
  }

  if (!existsSync(collectorEnvPath)) {
    writeFileSync(
      collectorEnvPath,
      "# local collector env for desktop runtime\n",
      "utf8"
    );
    console.log(`Created ${collectorEnvPath}`);
  }
}

function ensureRuntimePrismaSchema() {
  const schema = readFileSync(prismaSchemaPath, "utf8");
  const runtimeSchema = schema.replace(
    /url\s*=\s*"file:\.\.\/storage\/anythingllm\.db"/,
    'url      = env("DATABASE_URL")'
  );

  if (runtimeSchema === schema) {
    throw new Error(
      `Failed to derive runtime Prisma schema from ${prismaSchemaPath}`
    );
  }

  writeFileSync(prismaRuntimeSchemaPath, runtimeSchema, "utf8");
  console.log(`Generated ${prismaRuntimeSchemaPath}`);
}

function prismExperimentalAssetsEnabled() {
  return process.env.VITE_PRISM_EXPERIMENTAL_SURFACES === "enabled";
}

function pruneStableDesktopPublicAssets() {
  if (prismExperimentalAssetsEnabled()) {
    console.log(
      "Keeping experimental Prism public assets in the desktop runtime."
    );
    return;
  }

  const removable = [
    join(serverPublicDir, "music"),
    join(serverPublicDir, "models", "platonic-solids.glb"),
  ];

  removable.forEach((target) => {
    forceRemovePath(target);
  });

  console.log(
    "Removed experimental Prism public assets from the stable desktop runtime bundle."
  );
}

function syncFrontendIntoServerPublic() {
  if (!existsSync(frontendDistDir)) {
    throw new Error(
      `Frontend dist folder missing: ${frontendDistDir}. Frontend build likely failed.`
    );
  }

  forceRemovePath(serverPublicDir);
  mkdirSync(serverPublicDir, { recursive: true });
  cpSync(frontendDistDir, serverPublicDir, { recursive: true });
  pruneStableDesktopPublicAssets();
  console.log(`Synced ${frontendDistDir} -> ${serverPublicDir}`);
}

function collectDirectoryFiles(rootDir, currentDir, entries = []) {
  const dirEntries = readdirSync(currentDir, { withFileTypes: true }).sort(
    (left, right) => left.name.localeCompare(right.name)
  );

  for (const entry of dirEntries) {
    const absolutePath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectDirectoryFiles(rootDir, absolutePath, entries);
      continue;
    }

    if (!entry.isFile()) continue;
    entries.push({
      relativePath: absoluteRuntimePath(rootDir, absolutePath),
      absolutePath,
    });
  }

  return entries;
}

function shouldOmitStableDesktopAsset(relativePath) {
  if (prismExperimentalAssetsEnabled()) {
    return false;
  }

  return (
    relativePath === "models/platonic-solids.glb" ||
    relativePath.startsWith("music/")
  );
}

function hashDirectory(rootDir, options = {}) {
  const hash = createHash("sha256");
  const entries = collectDirectoryFiles(rootDir, rootDir).filter((entry) => {
    if (typeof options.filter === "function") {
      return options.filter(entry);
    }
    return true;
  });

  for (const entry of entries) {
    hash.update(entry.relativePath);
    hash.update("\n");
    hash.update(readFileSync(entry.absolutePath));
    hash.update("\n");
  }

  return {
    fileCount: entries.length,
    digest: hash.digest("hex"),
  };
}

function verifyFrontendSyncParity() {
  const source = hashDirectory(frontendDistDir, {
    filter: (entry) => !shouldOmitStableDesktopAsset(entry.relativePath),
  });
  const target = hashDirectory(serverPublicDir);

  if (
    source.fileCount !== target.fileCount ||
    source.digest !== target.digest
  ) {
    throw new Error(
      `Frontend asset sync mismatch: dist(${source.fileCount}, ${source.digest}) != public(${target.fileCount}, ${target.digest})`
    );
  }

  console.log(
    `Verified frontend parity across ${source.fileCount} files (${source.digest.slice(0, 12)}).`
  );
}

function resetRuntimeDir() {
  forceRemovePath(runtimeRoot);
  mkdirSync(runtimeCoreDir, { recursive: true });
  mkdirSync(runtimeBinDir, { recursive: true });
  mkdirSync(runtimeTemplateDir, { recursive: true });
  mkdirSync(runtimeOpenSourceDir, { recursive: true });
}

function loadRuntimeManifest() {
  return JSON.parse(readFileSync(runtimeManifestPath, "utf8"));
}

function copyRuntimeSubset(name, sourceDir, targetDir, includeEntries) {
  mkdirSync(targetDir, { recursive: true });

  for (const entry of includeEntries) {
    const source = join(sourceDir, entry);
    const destination = join(targetDir, entry);
    if (!existsSync(source)) {
      throw new Error(
        `Runtime manifest for ${name} references missing path: ${source}`
      );
    }
    copyTree(source, destination);
  }

  console.log(`Copied fail-closed ${name} runtime subset into ${targetDir}`);
}

function installRuntimeProductionDependencies(name, dir) {
  if (shouldSkipRuntimeProdInstall) {
    console.log(
      `Skipping production install for ${name} (--skip-runtime-prod-install).`
    );
    return;
  }

  forceRemovePath(join(dir, "node_modules"));
  runWithEnv(
    "corepack",
    [
      "yarn",
      "install",
      "--production=true",
      "--frozen-lockfile",
      "--non-interactive",
    ],
    dir,
    {
      NODE_ENV: "production",
      DISABLE_TELEMETRY: "true",
    }
  );
}

function removeRuntimeSymlinks(dir) {
  let removed = 0;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name);
    const stat = lstatSync(absolutePath);

    if (stat.isSymbolicLink()) {
      forceRemovePath(absolutePath);
      removed += 1;
      continue;
    }

    if (stat.isDirectory()) {
      removed += removeRuntimeSymlinks(absolutePath);
    }
  }

  return removed;
}

function removeRedundantRuntimePrismaArtifacts(serverRuntimeDir) {
  const removablePaths = [
    join(
      serverRuntimeDir,
      "node_modules",
      "@prisma",
      "engines",
      "libquery_engine-darwin-arm64.dylib.node"
    ),
    join(
      serverRuntimeDir,
      "node_modules",
      "prisma",
      "libquery_engine-darwin-arm64.dylib.node"
    ),
  ];

  let removed = 0;
  for (const filePath of removablePaths) {
    if (!existsSync(filePath)) continue;
    rmSync(filePath, { force: true });
    removed += 1;
  }

  return removed;
}

function generateRuntimeServerPrismaClient() {
  const runtimePrismaCli = join(
    runtimeServerDir,
    "node_modules",
    "prisma",
    "build",
    "index.js"
  );
  const runtimeSchemaPath = join(runtimeServerDir, "prisma", "runtime.prisma");

  if (!existsSync(runtimePrismaCli)) {
    throw new Error(`Runtime Prisma CLI missing at ${runtimePrismaCli}`);
  }

  if (!existsSync(runtimeSchemaPath)) {
    throw new Error(`Runtime Prisma schema missing at ${runtimeSchemaPath}`);
  }

  mkdirSync(prismaCacheDir, { recursive: true });

  runWithEnv(
    process.execPath,
    [runtimePrismaCli, "generate", "--schema", runtimeSchemaPath],
    runtimeServerDir,
    {
      DATABASE_URL:
        "file:///tmp/anythingllm-desktop-template/storage/anythingllm.db",
      STORAGE_DIR: templateStorageDir,
      XDG_CACHE_HOME: prismaCacheDir,
      DISABLE_TELEMETRY: "true",
    }
  );
}

function absoluteRuntimePath(rootDir, absolutePath) {
  return absolutePath
    .slice(rootDir.length)
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

function isLegalDocName(name) {
  return LEGAL_DOC_NAMES.test(name);
}

function shouldPruneDirectory(relativePath, name) {
  const loweredName = name.toLowerCase();
  if (PRUNABLE_DIR_NAMES.has(loweredName)) {
    return true;
  }

  if (loweredName.startsWith("dist-test")) {
    return true;
  }

  const normalized = `/${relativePath}/`;

  if (loweredName === ".bin" && normalized.includes("/node_modules/")) {
    return true;
  }

  if (
    /\/prebuilds\/(darwin-x64|linux[^/]*|win32[^/]*|windows[^/]*|android[^/]*|freebsd[^/]*|openbsd[^/]*|sunos[^/]*)\//.test(
      normalized
    )
  ) {
    return true;
  }

  if (/\/napi-v\d+\/darwin\/x64\//.test(normalized)) {
    return true;
  }

  if (
    /\/napi-v\d+\/(linux|win32|windows|android|freebsd|openbsd|sunos)\//.test(
      normalized
    )
  ) {
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

function shouldPruneFile(relativePath, name) {
  const loweredName = name.toLowerCase();
  if (PRUNABLE_FILE_NAMES.has(loweredName)) {
    return true;
  }

  const normalized = `/${relativePath}/`;
  const extension = name.includes(".")
    ? name.slice(name.lastIndexOf(".")).toLowerCase()
    : "";

  if (/\/darwin\/x64\//.test(normalized)) {
    return true;
  }

  if (NON_MAC_RUNTIME_SEGMENT_RE.test(normalized)) {
    return true;
  }

  if (
    /(darwin-x64|linux-arm|linux-x64|win32-arm|win32-x64|windows-arm|windows-x64|android-arm|android-x64|freebsd-x64|openbsd-x64|sunos-x64)/.test(
      normalized
    )
  ) {
    return true;
  }

  if (loweredName.endsWith(".map") || loweredName.endsWith(".tsbuildinfo")) {
    return true;
  }

  if (
    relativePath.includes("/node_modules/") &&
    (loweredName.endsWith(".d.ts") ||
      loweredName.endsWith(".d.cts") ||
      loweredName.endsWith(".d.mts"))
  ) {
    return true;
  }

  if (
    DOC_FILE_NAMES.test(loweredName) &&
    DOC_TEXT_EXTENSIONS.has(extension) &&
    !isLegalDocName(loweredName)
  ) {
    return true;
  }

  return NON_MAC_FILE_EXTENSIONS.has(extension);
}

function collectPrunablePaths(rootDir, currentDir, pendingRemovals) {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(currentDir, entry.name);
    const relativePath = absoluteRuntimePath(rootDir, absolutePath);

    if (entry.isDirectory()) {
      if (shouldPruneDirectory(relativePath, entry.name)) {
        pendingRemovals.push({ path: absolutePath, type: "dir" });
        continue;
      }

      collectPrunablePaths(rootDir, absolutePath, pendingRemovals);
      continue;
    }

    if (entry.isFile() && shouldPruneFile(relativePath, entry.name)) {
      pendingRemovals.push({ path: absolutePath, type: "file" });
    }
  }
}

function pruneRuntimeDir(dir) {
  const removable = [
    ".env",
    ".env.development",
    ".env.production",
    "documents",
    "storage",
    "vector-cache",
    "sslcert",
    "hotdir",
    ".cache",
    "nodemon.json",
    "eslint.config.mjs",
    ".flowconfig",
    ".nvmrc",
    ".gitignore",
    "yarn.lock",
  ];

  removable.forEach((entry) => {
    forceRemovePath(join(dir, entry));
  });

  const summary = {
    directories: 0,
    files: 0,
  };

  const pendingRemovals = [];
  collectPrunablePaths(dir, dir, pendingRemovals);

  pendingRemovals
    .sort((left, right) => right.path.length - left.path.length)
    .forEach(({ path, type }) => {
      forceRemovePath(path);
      if (type === "dir") {
        summary.directories += 1;
      } else {
        summary.files += 1;
      }
    });

  console.log(
    `Pruned ${summary.directories} directories and ${summary.files} files from ${dir}`
  );
}

function inspectFileType(filePath) {
  const result = spawnSync("file", ["-b", filePath], { encoding: "utf8" });
  if (result.error || result.status !== 0) return "";
  return (result.stdout || "").trim();
}

function normalizeExecutablePermissions(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      normalizeExecutablePermissions(absolutePath);
      continue;
    }

    if (!entry.isFile()) continue;
    const stat = statSync(absolutePath);
    if ((stat.mode & 0o111) === 0) continue;

    const fileType = inspectFileType(absolutePath);
    if (fileType.includes("Mach-O")) continue;

    chmodSync(absolutePath, stat.mode & ~0o111);
  }
}

function removeFinderMetadata(dir) {
  if (!existsSync(dir)) {
    return;
  }

  run("/usr/bin/find", [dir, "-name", ".DS_Store", "-delete"], coreRoot);
}

function loadUpstreamMetadata() {
  const pkg = JSON.parse(readFileSync(rootPackagePath, "utf8"));
  let commit = "unknown";
  let dirty = false;

  try {
    commit = runCapture("git", ["-C", coreRoot, "rev-parse", "HEAD"], coreRoot);
    dirty =
      runCapture("git", ["-C", coreRoot, "status", "--porcelain"], coreRoot)
        .length > 0;
  } catch {
    // Keep defaults when git metadata is unavailable.
  }

  return {
    productName: pkg.name,
    version: pkg.version,
    repositoryUrl:
      pkg.repository?.url || "https://github.com/mintplex-labs/anything-llm",
    commit,
    dirty,
  };
}

function bundleOpenSourceMaterials() {
  const upstream = loadUpstreamMetadata();
  const notice = [
    "PrismAI Open Source Notice",
    "",
    `PrismAI is a modified distribution of AnythingLLM (${upstream.version}) made available under the MIT License.`,
    `Upstream project: ${upstream.repositoryUrl}`,
    `Source commit used for this packaged release: ${upstream.commit}${upstream.dirty ? " (dirty working tree)" : ""}`,
    "",
    "The original upstream LICENSE and README are bundled alongside this notice.",
  ].join("\n");

  cpSync(rootLicensePath, join(runtimeOpenSourceDir, "LICENSE"));
  cpSync(rootReadmePath, join(runtimeOpenSourceDir, "README.md"));
  writeFileSync(
    join(runtimeOpenSourceDir, "NOTICE-PrismAI.md"),
    `${notice}\n`,
    "utf8"
  );
  writeFileSync(
    join(runtimeOpenSourceDir, "metadata.json"),
    `${JSON.stringify(upstream, null, 2)}\n`,
    "utf8"
  );
}

function copyPortableRuntime() {
  const runtimeManifest = loadRuntimeManifest();
  resetRuntimeDir();
  copyRuntimeSubset(
    "server",
    serverDir,
    runtimeServerDir,
    runtimeManifest.server.include
  );
  copyRuntimeSubset(
    "collector",
    collectorDir,
    runtimeCollectorDir,
    runtimeManifest.collector.include
  );
  installRuntimeProductionDependencies("server", runtimeServerDir);
  generateRuntimeServerPrismaClient();
  installRuntimeProductionDependencies("collector", runtimeCollectorDir);
  const removedServerSymlinks = removeRuntimeSymlinks(runtimeServerDir);
  const removedCollectorSymlinks = removeRuntimeSymlinks(runtimeCollectorDir);
  const removedPrismaArtifacts =
    removeRedundantRuntimePrismaArtifacts(runtimeServerDir);
  console.log(
    `Removed ${removedServerSymlinks} symlinks from ${runtimeServerDir} and ${removedCollectorSymlinks} symlinks from ${runtimeCollectorDir}`
  );
  console.log(
    `Removed ${removedPrismaArtifacts} redundant Prisma runtime artifacts from ${runtimeServerDir}`
  );
  cpSync(governanceDocsDir, runtimeGovernanceDocsDir, { recursive: true });
  if (existsSync(templateDbPath)) {
    cpSync(templateDbPath, runtimeTemplateDbPath);
  }
  bundleOpenSourceMaterials();
  pruneRuntimeDir(runtimeServerDir);
  pruneRuntimeDir(runtimeCollectorDir);
  normalizeExecutablePermissions(runtimeServerDir);
  normalizeExecutablePermissions(runtimeCollectorDir);
  removeFinderMetadata(runtimeRoot);

  const hostNodePath = process.env.ANYTHINGLLM_NODE_BIN || process.execPath;
  const resolvedNodePath = realpathSync(hostNodePath);
  cpSync(resolvedNodePath, bundledNodePath);
  chmodSync(bundledNodePath, 0o755);
  console.log(`Bundled production runtime in ${runtimeRoot}`);
}

function validateTemplateSourceDatabase(dbPath) {
  const result = spawnSync(
    "sqlite3",
    [
      dbPath,
      "select count(*) from workspaces; select count(*) from workspace_chats; select count(*) from workspace_agent_invocations; select count(*) from api_keys; select count(*) from users;",
    ],
    {
      encoding: "utf8",
    }
  );

  if (result.error || result.status !== 0) {
    throw new Error(`Failed to validate template database at ${dbPath}`);
  }

  const counts = result.stdout
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((value) => Number(value));

  if (counts.length !== 5 || counts.some((value) => Number.isNaN(value))) {
    throw new Error(
      `Unexpected validation output for template database at ${dbPath}`
    );
  }

  if (counts.some((value) => value !== 0)) {
    throw new Error(
      `Template database at ${dbPath} is not clean enough to bundle (expected zero workspaces/chats/agent runs/api keys/users).`
    );
  }
}

function prepareRuntimeTemplateDatabase() {
  forceRemovePath(templateWorkspaceDir);
  mkdirSync(templateStorageDir, { recursive: true });
  mkdirSync(prismaCacheDir, { recursive: true });

  const preferredTemplateSource =
    process.env.ANYTHINGLLM_TEMPLATE_DB || defaultTemplateSourceDbPath;
  if (preferredTemplateSource && existsSync(preferredTemplateSource)) {
    try {
      validateTemplateSourceDatabase(preferredTemplateSource);
      cpSync(preferredTemplateSource, templateDbPath);
      return;
    } catch (error) {
      console.warn(
        `Skipping template database source ${preferredTemplateSource}: ${error.message}`
      );
      console.warn(
        "Falling back to a clean generated template database for packaging."
      );
    }
  }
}

function main() {
  ensureCoreLayout();
  installIfNeeded("server", serverDir);
  installIfNeeded("collector", collectorDir);
  installIfNeeded("frontend", frontendDir);
  ensureRuntimeEnvFiles();
  ensureRuntimePrismaSchema();
  prepareRuntimeTemplateDatabase();
  forceRemovePath(frontendDistDir);
  run("npm", ["run", "build"], frontendDir);
  syncFrontendIntoServerPublic();
  verifyFrontendSyncParity();
  copyPortableRuntime();

  const audit = auditRuntimeTree(runtimeRoot);
  if (!audit.passed) {
    console.error("\nRuntime packaging audit failed:");
    for (const failure of audit.failures) {
      console.error(`- ${failure}`);
    }
    throw new Error("Runtime packaging audit failed.");
  }

  console.log("\nCore runtime preparation complete.");
}

main();
