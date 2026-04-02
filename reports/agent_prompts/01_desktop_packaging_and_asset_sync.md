# Agent Prompt: Fix PrismAI Desktop Packaging and Asset Sync

## Objective

Restore and harden the PrismAI desktop packaging pipeline so the packaged app reliably ships the current frontend assets and a clean runtime tree.

## Context

PrismAI had desktop packaging drift where:

- `frontend/dist` could differ from what the packaged runtime actually served
- stale Finder metadata like `.DS_Store` could enter the app bundle
- copy/delete behavior in runtime assembly was too brittle for repeated packaging runs

This fix must make the desktop packaging path deterministic and auditable.

## Source of truth

Use the March 29 rehab behavior as the intended baseline. The relevant source files are:

- `desktop-tauri/scripts/prepare-core.mjs`
- `desktop-tauri/scripts/release-macos.mjs`

## Your task

Audit the current branch and implement or restore the following behavior:

1. Runtime assembly must defensively remove previous output trees before copying new content.
2. `frontend/dist` must be rebuilt during desktop runtime preparation.
3. `server/public` must be resynced from the fresh frontend build.
4. The packaging path must verify frontend sync parity rather than assuming it worked.
5. Finder metadata such as `.DS_Store` must be removed from the packaged app/runtime.
6. The release path must preserve the existing Prism stable-bundle exclusions for experimental assets when those surfaces are disabled.

## Required implementation details

- Add or restore a defensive path-removal helper instead of relying only on bare `rmSync(..., force: true)`.
- Hash or otherwise compare the built `frontend/dist` tree against the packaged/public runtime tree after sync.
- Fail fast if parity verification fails.
- Strip `.DS_Store` from both the copied runtime and the staged `.app`.
- Do not break the existing runtime assembly flow for server, collector, templates, or Prisma setup.

## Constraints

- Do not change product behavior unrelated to packaging.
- Do not silently loosen validation. If parity fails, the script should stop loudly.
- Keep the stable desktop bundle lean by preserving current omission rules for experimental public assets unless product requirements explicitly changed.

## Acceptance criteria

- `prepare-core` rebuilds frontend assets and copies them into the runtime path.
- `prepare-core` verifies parity between built frontend assets and packaged public assets.
- The packaged `.app` and staged runtime do not contain `.DS_Store` files.
- Repeated packaging runs do not fail because stale directories or metadata were left behind.
- The packaged desktop app reflects the current frontend changes instead of stale assets.

## Recommended validation

Run and verify:

- desktop runtime preparation
- packaged macOS build
- at least one spot-check that a recent frontend change is visible in the packaged app

Then document:

- what parity check was added
- what metadata cleanup was added
- whether any omitted desktop assets were intentionally preserved

## Deliverable

Produce:

- the code changes
- a brief summary of the packaging-hardening changes
- exact commands you ran
- any residual risk if parity still depends on environment-specific behavior
