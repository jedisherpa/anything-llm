# PrismAI Rehab Workflow

This repository remains the source of truth for PrismAI during Wave 1 rehab.

## Canonical branches

- `prismai/integration`: canonical merge target for all PrismAI rehab work
- `prismai/desktop-hardening`: desktop runtime and packaging lane
- `prismai/frontend-rehab`: Prism shell, routing, and stable surface lane
- `prismai/server-rehab`: server, collector-adjacent runtime, and Metacanon lane
- `prismai/mobile-followup`: mobile validation and follow-up work after Wave 1

## Active worktree mapping

- `/Users/paulcooper/Documents/Codex Master Folder/worktrees/anything-llm/prismai-desktop` -> `prismai/desktop-hardening`
- `/Users/paulcooper/Documents/Codex Master Folder/worktrees/anything-llm/prismai-frontend` -> `prismai/frontend-rehab`
- `/Users/paulcooper/Documents/Codex Master Folder/worktrees/anything-llm/prismai-server` -> `prismai/server-rehab`
- `/Users/paulcooper/Documents/Codex Master Folder/worktrees/anything-llm/prismai-mobile` -> `prismai/mobile-followup`
- `/Users/paulcooper/Documents/Codex Master Folder/anything-llm` remains attached to the historical `codex/prismai-fork-snapshot` branch; use `prismai/integration` as the merge target rather than continuing to work directly on the snapshot branch.

## Historical branches

- Snapshot-style `codex/prismai-*` branches are historical checkpoints, not the ongoing source of truth.
- `prismai-core` stays frozen unless there is a concrete reason to reactivate it.
- `prismai-overlay` is retired as a planning concept and should not receive new work without a narrowly defined scope.

## Merge policy

- Merge lane branches only into `prismai/integration`.
- Do not merge lane branches directly into fork `master`.
- Update fork `master` only after `prismai/integration` is release-candidate quality.
- Do not merge upstream `origin/master` into lane branches during Wave 1. If upstream sync is needed, merge it into `prismai/integration` first.

## Wave 1 stability boundaries

- Stable product path: login, onboarding, workspace shell, settings, Metacanon control center, and Metacanon library.
- Experimental surfaces remain in-repo but must be explicitly quarantined behind dev or experimental feature flags:
  - `PrismHero`
  - `PrismDodecahedron`
  - `UI Lab`
  - `Repo Lab`
  - manual preview tooling

## Validation expectation before merge

- Desktop: startup classification is explicit, logs are discoverable, packaged runs are diagnosable.
- Frontend: stable routes are clearly separated from experimental routes.
- Server: workspace chat, document ingestion, mobile bootstrap, and Metacanon library reads remain compatible.
