# Agent Prompt: Build and Maintain Manual Verification and Smoke Coverage for Prism UI Rehab Fixes

## Objective

Document and preserve a human-runnable validation path for the Prism rehab fixes so future engineers can recheck the same user-facing behaviors after merges, packaging changes, or notarized build refreshes.

## Context

The March 29 Prism rehab fixes crossed frontend, server, and desktop packaging boundaries. The code changes are only half the handoff. The other half is a clear verification procedure for:

- provider visibility
- workspace creation affordance
- attachment paths
- thread rename
- council naming
- alignment continuity
- current-context fidelity
- Prism presence and desktop TTS

Without a documented operator checklist, these fixes are easy to regress invisibly.

## Source files to inspect first

- `PRISMAI_MANUAL_LIVE_VERIFICATION_CHECKLIST.md`
- `PRISMAI_WAVE1_SMOKE_CHECKLIST.md`
- any existing reports/checklists in `reports/` or repo root tied to Prism rehab

## Your task

Create or refresh the verification artifacts so another engineer or operator can manually validate the shipped behavior without reverse-engineering the code.

You should cover:

1. Desktop preflight and “am I testing the correct build?” guidance.
2. Docker Model Runner visibility in onboarding, workspace, and agent settings.
3. Create-workspace affordance.
4. Attachment picker flow.
5. Clipboard image/file/mixed paste behavior.
6. Thread rename flow.
7. Custom council naming and rename flow.
8. Current Context vs actual model-visible attached files.
9. Draft alignment clear-state.
10. Aligned follow-up continuity.
11. Prism presence state during agent runs if applicable.
12. Desktop Piper/TTS sanity checks if applicable.

## Required implementation details

- Provide checklists that a human can run line by line.
- Separate:
  - operator/manual live verification
  - shorter smoke gating before merge or packaging
- Use expected-result wording, not just actions.
- Note the preferred workspace/thread setup if continuity tests depend on preexisting data.

## Constraints

- Do not write vague QA instructions like “test chat.”
- Do not assume the operator knows which branch or package they are testing.
- Keep the smoke checklist short enough to be practical, but the manual checklist detailed enough to catch regressions.

## Acceptance criteria

- Another engineer can run the checklist and know exactly what should happen.
- The fix areas from the March 29 rehab work are explicitly covered.
- The checklists distinguish packaged desktop validation from dev-path validation.
- The documents are easy to update as future fixes land.

## Recommended validation

- Read through the final checklist as if you are a new engineer joining the project.
- Confirm that each major fix area in the Prism rehab series appears somewhere in the verification docs.
- Confirm the docs mention both desktop and frontend/server concerns where relevant.

## Deliverable

Produce:

- updated checklist docs
- a short summary of what is covered and what is still manual/operator-dependent
- any obvious missing regression areas you found while preparing the docs
