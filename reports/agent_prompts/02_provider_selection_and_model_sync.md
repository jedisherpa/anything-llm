# Agent Prompt: Fix Prism Provider Selection and Model Sync

## Objective

Make Prism provider/model selection consistent across onboarding, global settings, workspace settings, chat surfaces, and agent execution.

## Context

PrismAI drifted into multiple provider-selection sources of truth. Symptoms included:

- `Docker Model Runner` missing from some flows
- onboarding using its own hand-maintained provider list
- chat surfaces not reacting after global provider/model changes
- agent and lens runs using stale fallback providers instead of the active workspace model

The user-facing outcome should be that provider selection feels unified and predictable.

## Source files to inspect first

- `frontend/src/pages/OnboardingFlow/Steps/LLMPreference/index.jsx`
- `frontend/src/pages/GeneralSettings/LLMPreference/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/WorkspaceModelPicker/index.jsx`
- `frontend/src/constants/llmProviders.jsx`
- `frontend/src/components/LLMSelection/providerOptions/*`
- `frontend/src/models/workspace.js`
- `server/utils/agents/index.js`
- any related agent/workspace LLM selector components

## Your task

Restore or implement the following behavior:

1. Onboarding must use the shared provider registry, not a route-local duplicate list.
2. Shared provider option panels must render from the shared provider-to-component mapping.
3. Saving global LLM settings must notify dependent chat/model-pick surfaces.
4. Workspace chat selectors must update when the global provider/model changes.
5. Workspace overrides should only be updated automatically when they still match the old global selection.
6. Agent execution should prefer the active workspace chat provider/model over stale agent fallback state unless an explicit agent provider/model pair is set.

## Required implementation details

- Use a shared registry equivalent to `AVAILABLE_LLM_PROVIDERS`.
- Use a shared options-component map equivalent to `PROVIDER_OPTIONS_COMPONENTS`.
- Emit and listen for a save event after global LLM preference persistence.
- Add reconciliation logic that updates stale workspace chat overrides from old global selection to new global selection.
- Keep explicit per-workspace or explicit per-agent overrides intact.

## Constraints

- Do not add another duplicated provider list.
- Do not special-case `Docker Model Runner` in a one-off way. Fix the architecture so it appears anywhere the shared registry is consumed.
- Preserve the intended distinction between:
  - global LLM selection
  - per-workspace chat override
  - explicit agent provider/model override

## Acceptance criteria

- `Docker Model Runner` appears in onboarding, settings, and other expected provider pickers.
- Onboarding renders the correct provider-specific configuration panel using shared components.
- Changing the global provider/model updates dependent chat surfaces.
- Agents/lenses prefer the workspace chat model when explicit agent settings do not provide a complete provider/model pair.
- No route-local giant provider list remains where a shared registry should be used.

## Recommended validation

Test at minimum:

- onboarding provider list
- global LLM settings save flow
- workspace chat model picker reaction after global save
- workspace with explicit override vs workspace inheriting global state
- agent execution using workspace chat provider/model

## Deliverable

Produce:

- the code changes
- a short explanation of the provider-state hierarchy after the fix
- which save event(s) or synchronization mechanism(s) you used
- any follow-up work needed if other selectors still drift from the shared registry
