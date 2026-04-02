# PrismAI UI Fix Agent Prompt Pack

This folder rewrites the UI fix handoff into separate agent-ready prompt files.

Each prompt is written so you can hand it directly to an implementation agent. The prompts are scoped by fix area, not by commit hash, so they can be reused for:

- regression repair
- forward-porting into another branch
- rebuilding a fix after merge conflict drift
- auditing whether the current branch still preserves the intended behavior

## Files

- `01_desktop_packaging_and_asset_sync.md`
- `02_provider_selection_and_model_sync.md`
- `03_chat_attachments_paste_and_context.md`
- `04_alignment_council_and_thread_actions.md`
- `05_prism_presence_and_desktop_piper_tts.md`
- `06_manual_verification_and_smoke.md`

## Source-of-truth context

The prompts are based on the committed March 29, 2026 Prism rehab series on `prismai/server-rehab`, summarized in:

- `reports/PRISMAI_UI_FIXES_HANDOFF_2026-04-02.md`

Use that handoff if an agent needs architectural context before starting.

## Portability

These prompt files are written to be portable across computers and repo clones:

- all file references are repo-relative
- there are no machine-specific absolute filesystem paths
- there are no references to local usernames, local mount points, or one-computer-only launch commands

To use them on another computer:

1. place this folder anywhere inside the target repo checkout
2. keep the repo-relative source file paths intact
3. give the chosen prompt file directly to the implementation agent

If the target branch uses different file locations, the receiving engineer should remap only those repo-relative paths, not rewrite the prompts from scratch

## Usage

Give one file to one agent.

Each prompt already contains:

- objective
- problem statement
- source files
- required implementation behavior
- acceptance criteria
- constraints and guardrails
- recommended validation

## Important note

These prompts describe the intended shipped behavior from the committed rehab fixes. They should not automatically trust the current dirty working tree as correct.
