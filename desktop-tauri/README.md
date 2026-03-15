# AnythingLLM Sovereign Desktop (Tauri)

This wrapper runs the upstream `server` + `collector` locally and opens AnythingLLM in a native Tauri window.

## Defaults baked in

- Runtime: `Tauri`
- Mode default: `desktop`
- Mode switching: `restart-on-toggle`
- Data persistence: shared local app-data directory via `STORAGE_DIR`
- Telemetry: disabled by default (`DISABLE_TELEMETRY=true`)
- App URL: `http://127.0.0.1:3033` with fallback to `3032`, then `3031`

## Prerequisites

- Node.js 18+
- Rust toolchain
- Tauri system prerequisites for your OS

## First-time setup

1. Install desktop wrapper dependencies:
   - `cd desktop-tauri`
   - `corepack yarn install --frozen-lockfile`
2. Prepare core AnythingLLM runtime assets:
   - `corepack yarn prepare:core`

The prepare step will:

- install missing dependencies for `server`, `collector`, and `frontend`
- build `frontend`
- sync `frontend/dist` into `server/public` for production server hosting
- create minimal local `.env` files if they do not already exist

## Run

- Development app run: `corepack yarn tauri:dev`
- Build the unsigned macOS `.app` only: `corepack yarn tauri:build`

## Release

Canonical macOS release flow for Apple Silicon:

- Local ad-hoc release for testing:
  - `corepack yarn release:macos --ad-hoc`
- Signed release:
  - `corepack yarn release:macos --identity "Developer ID Application: Your Name (TEAMID)" --team-id "TEAMID"`
- Signed + notarized release:
  - `corepack yarn release:macos --identity "Developer ID Application: Your Name (TEAMID)" --team-id "TEAMID" --notary-profile "your-notary-profile"`

The professional release pipeline is the custom PrismAI packaging flow, not Tauri's built-in DMG bundler.
`tauri:build` now produces the unsigned `.app`, and `release:macos` is the authoritative path for public installer artifacts.

The release script will:

- run `prepare:core`
- audit and slim the packaged runtime against fail-closed packaging rules
- build the Tauri app bundle only
- copy the app to a clean temporary location under `/tmp`
- clear macOS extended attributes before signing
- sign the staged app with either ad-hoc or Developer ID signing
- verify the app against bundle size, banned payload, and arm64-only binary budgets
- build a signed ZIP fallback artifact
- optionally notarize and staple the ZIP before installer packaging
- build a styled Finder DMG with `PrismAI.app` on the left and `Applications` on the right
- verify the DMG layout and audit the DMG size budget
- optionally notarize and staple the DMG
- write versioned release artifacts, checksums, and a machine-readable manifest

Default artifact names:

- `PrismAI-<version>-macos-arm64.zip`
- `PrismAI-<version>-macos-arm64.dmg`
- `PrismAI-<version>-checksums.txt`
- `PrismAI-<version>-manifest.json`

Default release budgets enforced by audit:

- `.app` bundle: `<= 1,000,000,000` bytes
- `.dmg`: `<= 500,000,000` bytes
- shipped `x86_64` Mach-O binaries: `0`
- banned dev/test/docs payloads: `0`

Compliance and legal packaging:

- The original upstream AnythingLLM `LICENSE` and top-level `README.md` are bundled inside:
  - `PrismAI.app/Contents/Resources/_up_/runtime/OpenSource/AnythingLLM/`
- A generated `NOTICE-PrismAI.md` is bundled beside them
- The desktop app exposes `Help -> Open Source Licenses` to open the packaged notice view

## Runtime controls

Use the native app menu:

- `Mode -> Switch to Desktop Mode`
- `Mode -> Switch to Web Mode`
- `Help -> Open in Browser`
- `Help -> Open Source Licenses`
- `Restart App`

If you launch in `web` mode, the app shows a local launcher page and opens AnythingLLM in your browser on demand.

## Optional environment overrides

- `ANYTHINGLLM_CORE_DIR`: Absolute path to the AnythingLLM source root.
- `ANYTHINGLLM_NODE_BIN`: Node executable (default: `node`).
- `ANYTHINGLLM_JWT_SECRET`
- `ANYTHINGLLM_SIG_KEY`
- `ANYTHINGLLM_SIG_SALT`
