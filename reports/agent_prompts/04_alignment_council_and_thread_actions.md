# Agent Prompt: Fix Alignment Continuity, Council Naming, and Thread Actions

## Objective

Make Prism aligned conversations, featured councils, and sidebar thread actions behave like integrated product flows rather than brittle browser-era hacks.

## Context

PrismAI had three related UX failures:

- thread rename used `window.prompt`, which felt unsafe and visually out of place
- custom councils could be saved but not smoothly renamed from the surfaces where users actually saw them
- alignment often broke conversation continuity, especially for prompts like “answer again in light of the lens” or short follow-up replies after assistant clarifying questions

This fix should make alignment feel like an active conversational layer and make councils/threads editable inside the app.

## Source files to inspect first

- `frontend/src/components/Sidebar/ActiveWorkspaces/ThreadContainer/ThreadItem/index.jsx`
- `frontend/src/components/Sidebar/FeaturedCouncils/index.jsx`
- `frontend/src/models/metacanonLibrary.js`
- `frontend/src/utils/metacanonAlignment.js`
- any related Metacanon library or onboarding surfaces that display council naming

## Your task

Implement or restore the following behavior:

1. Replace thread rename via `window.prompt()` with an in-app modal.
2. Ensure successful rename updates the visible sidebar thread name immediately without requiring a page refresh.
3. Add a direct `Rename` action for featured custom councils.
4. Allow custom council-pack metadata to be updated in storage without breaking its featured-card representation.
5. If a renamed council is currently active as alignment, update the active alignment state as well.
6. Improve alignment prompt rewriting so referential follow-ups continue the active conversation instead of describing the selected lens/constellation/council generically.
7. Short replies after assistant clarifying questions should stay anchored to the prior exchange when alignment is active.

## Required implementation details

- Build a dedicated rename modal for threads with:
  - current name prefilled
  - save/cancel
  - loading state
- Dispatch or reuse a thread rename event so the sidebar rerenders immediately after rename.
- Add an update function for saved council packs and propagate relevant changes into featured-council storage.
- In alignment logic:
  - inspect recent resolved user/assistant exchanges
  - detect referential prompts such as “answer again,” “in light of,” “with the lens,” or similarly short follow-up continuations
  - rewrite the outgoing prompt so it remains anchored to the prior exchange before applying alignment

## Constraints

- Do not keep any browser-native `prompt()` rename flow.
- Do not make custom councils renameable only in some hidden editor; the rename action must exist on the surfaced featured card UI.
- Do not make alignment continuity depend on a single hardcoded phrase. Use heuristics broad enough to cover natural follow-up phrasing.

## Acceptance criteria

- Thread rename opens an in-app modal and persists.
- Sidebar thread name updates immediately after save.
- Featured custom councils expose a `Rename` action.
- Renaming a council updates saved pack state and featured card state.
- If the active alignment references the renamed council, the active banner/state updates too.
- Prompts such as “answer that again in light of the constellation” revise the prior answer instead of drifting into generic alignment explanation.
- Short replies after assistant clarifying questions continue the aligned task.

## Recommended validation

Test at minimum:

- thread rename modal open/save/cancel
- sidebar thread label immediate update
- custom council save and rename
- rename of a currently active council
- referential aligned follow-up case
- short aligned reply after assistant asks clarifying questions

## Deliverable

Produce:

- the code changes
- the event/state path used for immediate thread rename updates
- the council-pack persistence update path
- the alignment anchoring heuristic in plain language
- any cases where the heuristic still feels overly broad or too narrow
