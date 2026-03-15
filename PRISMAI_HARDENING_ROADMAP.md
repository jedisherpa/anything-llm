# PrismAI Hardening Roadmap

This roadmap translates the PrismAI reliability plan into GitHub-issues style work items.

Primary goals:
- reduce startup failures
- reduce packaging and notarization friction
- reduce bundle size
- improve diagnostics
- make releases reproducible

Suggested labels:
- `area:desktop`
- `area:release`
- `area:runtime`
- `area:loader`
- `area:data`
- `area:packaging`
- `priority:p0`
- `priority:p1`
- `priority:p2`

## Milestone 1: Startup Reliability

### Issue 1: Automate bundled Node signing with JIT entitlements
- Labels: `area:desktop`, `area:release`, `priority:p0`
- Summary: Ensure the bundled Node runtime is always signed with the entitlements required by V8 on Apple Silicon.
- Why: This is the direct fix path for `Fatal process OOM in Failed to reserve virtual memory for CodeRange`.
- Scope:
  - keep bundled Node signing in one script
  - apply node-specific entitlements during release signing
  - verify the entitlement set as part of release validation
- Acceptance criteria:
  - the release pipeline signs bundled `node` with the correct entitlements
  - a signed build launches from `/Applications` on Apple Silicon without the `CodeRange` crash
  - signing steps are documented and repeatable
- Key files:
  - [sign-macos-app.mjs](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/desktop-tauri/scripts/sign-macos-app.mjs)
  - [entitlements.node.plist](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/desktop-tauri/src-tauri/entitlements.node.plist)

### Issue 2: Detect DMG-mounted launches and block with a friendly install message
- Labels: `area:desktop`, `area:loader`, `priority:p0`
- Summary: Prevent runtime startup when PrismAI is launched directly from a mounted DMG volume.
- Why: Running from `/Volumes/PrismAI/...` creates confusing startup failures and is the wrong install path.
- Scope:
  - detect app launches from `/Volumes`
  - keep loader open
  - show explicit "Drag PrismAI to Applications" guidance
- Acceptance criteria:
  - app does not attempt migrations or service startup when launched from DMG
  - loader shows a clear install instruction instead of a raw crash or port timeout
- Key files:
  - [main.rs](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/desktop-tauri/src-tauri/src/main.rs)
  - [main.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/desktop-tauri/app/main.js)

### Issue 3: Promote startup logs to first-class diagnostics
- Labels: `area:desktop`, `area:loader`, `priority:p0`
- Summary: Capture and surface real startup logs for bootstrap, server, and collector processes.
- Why: The old `127.0.0.1:3001` timeout message hid the actual crash reason.
- Scope:
  - keep per-process logs in app data
  - surface log excerpts in startup failure states
  - document log locations for support/debugging
- Acceptance criteria:
  - server/collector crashes produce visible loader diagnostics
  - a failed launch yields enough information to distinguish runtime, migration, and service failures
- Key files:
  - [main.rs](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/desktop-tauri/src-tauri/src/main.rs)
  - [main.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/desktop-tauri/app/main.js)

### Issue 4: Replace generic 3001 timeout handling with failure-aware startup status
- Labels: `area:desktop`, `area:loader`, `priority:p0`
- Summary: Distinguish between "server not ready yet" and "server exited during startup."
- Why: Reachability failures should not all collapse into the same error message.
- Scope:
  - poll for server readiness
  - detect early child-process exit
  - classify failures into server, collector, migration, port conflict, and runtime categories
- Acceptance criteria:
  - if the server crashes, the loader reports that specifically
  - if the server is merely slow, the loader continues to wait with a meaningful progress state

## Milestone 2: Packaging and Size Reduction

### Issue 5: Strip unused `darwin-x64` binaries from arm64 builds
- Labels: `area:packaging`, `area:release`, `priority:p0`
- Summary: Remove x64-only native binaries from Apple Silicon releases.
- Why: The app bundle currently ships unneeded cross-architecture baggage.
- Current signal:
  - there are still `10` `darwin-x64` paths in the packaged runtime
- Scope:
  - identify all x64-only runtime artifacts
  - exclude them from arm64 packaging
  - verify no runtime feature depends on them
- Acceptance criteria:
  - arm64 releases contain no unnecessary x64 native runtime payloads
  - notarization target count is reduced
- Key files:
  - [prepare-core.mjs](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/desktop-tauri/scripts/prepare-core.mjs)

### Issue 6: Prune test fixtures and non-runtime files from packaged app
- Labels: `area:packaging`, `area:release`, `priority:p1`
- Summary: Stop shipping test files, example fixtures, and other non-runtime package baggage.
- Why: These increase bundle size and create unnecessary notarization surface.
- Scope:
  - add a packaging allowlist or aggressive prune step
  - exclude test-data and fixture-heavy package trees
- Acceptance criteria:
  - no test fixtures are included in packaged runtime trees
  - bundle size is materially smaller than the current baseline

### Issue 7: Reduce duplicate native dependencies between server and collector
- Labels: `area:runtime`, `area:packaging`, `priority:p1`
- Summary: Audit duplicated native modules across server and collector packaging.
- Why: Duplicate binaries increase signing work, notarization pain, and release size.
- Scope:
  - inventory duplicate native libraries
  - determine whether shared packaging or optional loading is possible
- Acceptance criteria:
  - duplicate native modules are reduced or justified
  - runtime binary count is reduced from current baseline

## Milestone 3: Startup Work Reduction

### Issue 8: Separate first-run initialization from normal launch
- Labels: `area:desktop`, `area:runtime`, `priority:p1`
- Summary: Stop treating every launch like a fresh deployment.
- Why: Startup currently does too much work in the hot path.
- Scope:
  - define first-run setup flow
  - define normal launch flow
  - persist a runtime/version marker in app data
- Acceptance criteria:
  - normal launches skip first-run-only work
  - first-run behavior is deterministic and recoverable

### Issue 9: Only migrate database when schema or app version changes
- Labels: `area:desktop`, `area:runtime`, `priority:p1`
- Summary: Reduce the chance of startup failures by limiting DB work to versioned upgrades.
- Why: migration work is one of the riskiest startup steps
- Scope:
  - version the runtime schema
  - compare against stored applied version
  - skip unnecessary migration work
- Acceptance criteria:
  - stable launches do not repeatedly invoke migration tooling
  - upgrade launches migrate only when needed

### Issue 10: Ship a release-ready template database and validate it
- Labels: `area:release`, `area:runtime`, `priority:p1`
- Summary: Treat the template DB as a real release artifact instead of a side effect.
- Why: a valid template DB reduces first-run work and failure modes
- Scope:
  - generate template DB during release prep
  - validate file presence and schema health
  - fail release prep if template DB is missing or invalid
- Acceptance criteria:
  - packaged app always includes a known-good template DB
  - fresh installs do not depend on ad hoc DB bootstrap behavior

## Milestone 4: Desktop Launcher Maintainability

### Issue 11: Split `main.rs` into focused desktop runtime modules
- Labels: `area:desktop`, `priority:p1`
- Summary: Break the large desktop entry point into smaller units with clear boundaries.
- Why: the desktop runtime is carrying too much logic in one file
- Current signal:
  - [main.rs](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/desktop-tauri/src-tauri/src/main.rs) is about `923` lines
- Proposed modules:
  - `config.rs`
  - `paths.rs`
  - `bootstrap.rs`
  - `database.rs`
  - `processes.rs`
  - `logs.rs`
  - `status.rs`
- Acceptance criteria:
  - no single desktop runtime file owns every startup concern
  - process control, logging, and bootstrap logic are independently testable

### Issue 12: Add targeted tests for startup classification and bootstrap path logic
- Labels: `area:desktop`, `priority:p1`
- Summary: Cover the most failure-prone desktop paths with tests.
- Why: startup regressions are expensive and easy to miss
- Scope:
  - classify startup errors in tests
  - test path resolution
  - test DMG install guard
  - test child-process failure handling
- Acceptance criteria:
  - new desktop startup behaviors are covered with automated tests

## Milestone 5: Release Automation

### Issue 13: Build a single release script for build, sign, notarize, and validate
- Labels: `area:release`, `priority:p0`
- Summary: Replace manual release choreography with one canonical release path.
- Why: manual release steps are error-prone and stressful
- Scope:
  - build app
  - produce clean signing copy
  - sign nested binaries
  - sign outer app
  - package DMG
  - notarize
  - staple
  - validate
- Acceptance criteria:
  - one documented command produces a releasable PrismAI DMG
  - release output includes verification steps and status summary

### Issue 14: Generate a release manifest with version, hash, and notarization metadata
- Labels: `area:release`, `priority:p1`
- Summary: Persist release metadata for support and reproducibility.
- Why: we should know exactly what was shipped
- Scope:
  - app hash
  - DMG hash
  - notarization submission id
  - bundle version
  - release timestamp
- Acceptance criteria:
  - every formal release produces a machine-readable manifest

## Milestone 6: Clean-Machine Confidence

### Issue 15: Create a clean-machine install smoke test checklist
- Labels: `area:release`, `priority:p1`
- Summary: Define a repeatable install test on a clean account or second Mac.
- Why: many failures only appear outside the development machine
- Scope:
  - mount DMG
  - drag to Applications
  - first launch
  - loader handoff
  - settings open
  - library open
  - one prompt path
- Acceptance criteria:
  - every candidate release is validated against the same install checklist

### Issue 16: Capture release support logs and support instructions
- Labels: `area:release`, `area:desktop`, `priority:p2`
- Summary: Make it easy for testers to send back useful diagnostics.
- Why: support loops are much faster if logs and paths are standardized
- Scope:
  - document log locations
  - add "copy diagnostics" workflow or support note
  - note common failure signatures and their meaning
- Acceptance criteria:
  - support instructions for testers fit on a single page

## Suggested execution order

1. Issue 1
2. Issue 3
3. Issue 4
4. Issue 2
5. Issue 13
6. Issue 5
7. Issue 8
8. Issue 9
9. Issue 10
10. Issue 11
11. Issue 12
12. Issue 15
13. Issue 16
14. Issue 6
15. Issue 7
16. Issue 14

## Best first sprint

If we want the most leverage quickly, start with:
- Issue 1: bundled Node JIT signing
- Issue 3: startup logs
- Issue 4: failure-aware startup status
- Issue 2: DMG launch guard
- Issue 13: one canonical release script

That bundle of work should cut down the majority of the startup and release pain we have hit so far.
