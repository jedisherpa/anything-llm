# PrismAI UI Fixes Developer Handoff

Date: 2026-04-02
Branch: `prismai/server-rehab`
Current HEAD: `4133c236`

## Scope

This handoff covers the committed PrismAI UI and desktop-facing fixes landed in the March 29, 2026 rehab series:

1. `57ad2ee5` Stabilize PrismAI desktop packaging and dev asset sync
2. `fe59ccdb` Align Prism provider selection across settings, workspace, and agents
3. `b923608b` Fix Prism chat attachments, paste handling, and context manifests
4. `88f144b9` Fix Prism alignment continuity, council naming, and thread actions
5. `84e6b9e0` Fix Prism presence state and restore local desktop Piper playback
6. `4133c236` Add PrismAI manual verification checklist and follow-up smoke notes

This report is intentionally **not** a handoff for the current uncommitted working tree. The repo is currently dirty, with additional WIP across frontend, desktop, and server files. Treat that WIP as out of scope unless it is separately reviewed and committed.

## Executive Summary

The committed March 29 fix set closed the main first-use and demo-path UI regressions in PrismAI:

- local LLM provider selection was re-unified across onboarding, global settings, workspace settings, and agent settings
- the chat composer’s attachment intake paths were repaired and normalized
- explicit attached-document context was made visible to the model before broader workspace retrieval
- thread rename moved from an unsafe prompt flow to an in-app modal
- custom councils became renameable and alignment continuity became conversation-aware
- Prism presence state and local desktop Piper playback were stabilized
- desktop packaging was hardened so frontend asset sync and runtime assembly are reproducible

The net effect is that the desktop product path became much more coherent:

- provider choice is consistent
- workspaces and agents stop drifting from global model selection
- chat attachments behave more like upstream AnythingLLM
- alignment/council UX feels less brittle
- desktop TTS and shell feedback behave more reliably

## Working Tree Status Warning

Current `git status` shows many modified and untracked files in `frontend`, `server`, and `desktop-tauri`.

That means:

- this handoff should be read as a handoff for the committed rehab checkpoint
- any engineer picking this up should branch from a clean commit, not from the current local dirty tree, unless they explicitly want to absorb later WIP

## Commit-by-Commit Handoff

### 1. Desktop packaging and asset sync

Commit:

- `57ad2ee5` `Stabilize PrismAI desktop packaging and dev asset sync`

Primary files:

- [prepare-core.mjs](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/desktop-tauri/scripts/prepare-core.mjs)
- [release-macos.mjs](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/desktop-tauri/scripts/release-macos.mjs)

What changed:

- Replaced brittle `rmSync(..., force: true)` usage with a more defensive `forceRemovePath()` helper.
- Added frontend/server-public parity verification by hashing `frontend/dist` and `server/public`.
- Explicitly removes `.DS_Store` and stale Finder metadata from the packaged runtime/app bundle.
- Forces a fresh frontend build during desktop runtime preparation.
- Verifies the copied desktop runtime tree after sync instead of assuming copy success.

Why it mattered:

- The desktop app was vulnerable to stale or partially synced frontend assets.
- Local macOS metadata and fragile delete/copy behavior could pollute the bundle or make packaging nondeterministic.
- This commit made the packaged UI more trustworthy by ensuring that the built frontend actually matches what the runtime serves.

Behavioral impact on UI:

- Fixes in later commits are meaningful only if the desktop runtime actually ships the current frontend. This commit is the foundation that makes the rest of the UI fixes reliably appear in the packaged app.

Implementation notes:

- `verifyFrontendSyncParity()` hashes the built source tree and the packaged public tree.
- `pruneStableDesktopPublicAssets()` continues omitting experimental stable-bundle assets when Prism experimental surfaces are disabled.
- `release-macos.mjs` now strips `.DS_Store` from the staged `.app` before distribution.

Known risk:

- Any new packaging rule or runtime omission should be added to `prepare-core.mjs` rather than patched ad hoc elsewhere, otherwise parity can drift again.

### 2. Provider selection and model sync

Commit:

- `fe59ccdb` `Align Prism provider selection across settings, workspace, and agents`

Primary files:

- [WorkspaceModelPicker/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/WorkspaceChat/ChatContainer/WorkspaceModelPicker/index.jsx)
- [GeneralSettings/LLMPreference/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/pages/GeneralSettings/LLMPreference/index.jsx)
- [OnboardingFlow/Steps/LLMPreference/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/pages/OnboardingFlow/Steps/LLMPreference/index.jsx)
- [workspace.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/models/workspace.js)
- [server/utils/agents/index.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/server/utils/agents/index.js)

What changed:

- Onboarding stopped using its own giant hand-maintained provider list and moved to the shared `AVAILABLE_LLM_PROVIDERS` registry plus `PROVIDER_OPTIONS_COMPONENTS`.
- Global LLM settings dispatch a save event after persistence so the bottom-left/workspace picker can react immediately.
- Workspace model picker now listens to both local selector saves and global preference saves.
- Saving a new global LLM provider/model syncs workspace chat overrides that were still pointing at the previous global pair.
- Agent provider/model resolution now prefers explicit workspace chat provider/model over a stale agent-provider fallback when appropriate.

Why it mattered:

- Prism had drifted into duplicated provider sources of truth.
- Some surfaces showed `Docker Model Runner` while others did not.
- Workspace/agent/provider state could diverge, making the UI feel inconsistent and causing chat or lens runs to use the wrong backend.

Behavioral impact on UI:

- Provider choices are now more consistent across onboarding, general settings, workspace chat, and agents.
- Changing the global provider/model is much more likely to propagate to the chat surfaces the user actually sees.
- Agent and lens execution behaves more like “use the active workspace model” instead of falling back to stale configuration.

Implementation notes:

- `LLM_PREFERENCE_SAVED_EVENT` is the bridge used to notify workspace model pickers after global saves.
- `syncWorkspacesToGlobalSelection()` updates only workspaces still matching the old global selection, so explicit per-workspace overrides are preserved.
- Server-side `#resolveProviderAndModel()` was introduced to reconcile explicit agent config, workspace chat config, and fallbacks.

Known risk:

- The architecture still depends on provider registry consistency. Any new provider should be added only to the shared registry/components mapping, not to one-off route-local arrays.

### 3. Chat attachments, paste handling, and current-context manifests

Commit:

- `b923608b` `Fix Prism chat attachments, paste handling, and context manifests`

Primary files:

- [DnDWrapper/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/index.jsx)
- [PromptInput/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx)
- [ChatContainer/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/WorkspaceChat/ChatContainer/index.jsx)
- [apiChatHandler.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/server/utils/chats/apiChatHandler.js)
- [contextManifest.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/server/utils/chats/contextManifest.js)

What changed on the frontend:

- Added `OPEN_ATTACHMENT_PICKER_EVENT` so multiple UI affordances can open the same file picker without directly reaching into DOM nodes.
- Unified attachment queuing into a reusable pipeline instead of duplicating separate paste/drop logic.
- Allowed image attachments immediately even while document parsing services are still warming up.
- Clipboard paste now collects files from both `clipboardData.items` and `clipboardData.files`.
- Clipboard file collection dedupes by name, size, type, and `lastModified`.
- Empty-state upload actions route through the same attachment pipeline as the main composer.
- Composer height reporting was added so the chat/history layout can adapt to the live composer footprint.

What changed on the server:

- Added `buildAttachedContextManifest(parsedFiles)` to inject an explicit list of attached current-context documents ahead of broader retrieval.
- Attached parsed files now contribute both:
  - a manifest that names them
  - their page content and source previews

Why it mattered:

- The desktop app had multiple broken or inconsistent attachment entry points.
- Clipboard behavior differed between browser and desktop webview environments.
- Users could ask “what files can you see?” and get an answer dominated by broader retrieval instead of the documents they explicitly attached.

Behavioral impact on UI:

- The `+` flow, drag/drop, empty state upload actions, and paste handling are much more unified.
- Mixed paste behavior works better: text still inserts, while files/images become attachments.
- Current Context in the UI is now more aligned with what the model is actually told about explicit thread attachments.

Implementation notes:

- `prepareAttachments()` distinguishes image attachments from upload/parse documents.
- `queueIncomingFiles()` centralizes warnings and accepted-file injection.
- `collectClipboardFiles()` is the key clipboard dedupe helper.
- `buildAlignedPrompt(..., history)` was also threaded into the chat send path in this commit, which overlaps with the next alignment commit.

Known risk:

- Deduping by file fingerprint is practical but not perfect. Two different files with identical metadata could still collapse together.
- Context manifesting depends on parsed-file availability; if parsing is incomplete or stale, the manifest can only reflect what the backend knows is attached and usable.

### 4. Alignment continuity, council naming, and thread actions

Commit:

- `88f144b9` `Fix Prism alignment continuity, council naming, and thread actions`

Primary files:

- [ThreadItem/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/Sidebar/ActiveWorkspaces/ThreadContainer/ThreadItem/index.jsx)
- [FeaturedCouncils/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/Sidebar/FeaturedCouncils/index.jsx)
- [metacanonLibrary.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/models/metacanonLibrary.js)
- [metacanonAlignment.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/utils/metacanonAlignment.js)
- [MetacanonAILibrary/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/pages/MetacanonAILibrary/index.jsx)
- [Onboarding Home](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/pages/OnboardingFlow/Steps/Home/index.jsx)
- [prism-app-treatment.css](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/styles/prism-app-treatment.css)

What changed:

- Thread rename moved from `window.prompt()` to an in-app modal with save/cancel/loading state.
- Successful rename now dispatches a thread rename event so the sidebar updates immediately.
- Featured custom councils gained a `Rename` action in the sidebar card UI.
- Local council-pack storage now supports `updateCouncilPack()`, including propagation into featured-council entries.
- Alignment logic now detects referential follow-ups like:
  - “answer again”
  - “in light of the constellation”
  - short replies after the assistant asked follow-up questions
- `buildAlignedPrompt()` can now anchor the next prompt to the most recent resolved exchange before applying alignment.

Why it mattered:

- Thread rename via `prompt()` was visually inconsistent, easy to lose, and produced a bad desktop feel.
- Custom councils could be created but not smoothly renamed from the surfaces where users actually saw them.
- Aligned conversations drifted into generic lens/council explanation instead of continuing the task the user was already in.

Behavioral impact on UI:

- Thread actions feel native to the app instead of browser-native.
- Custom councils are editable from their featured state.
- Alignment behaves more like an overlay on the active conversation instead of a hard context reset.
- Short clarifying-answer flows behave better in lens/council contexts.

Implementation notes:

- `RenameThreadModal` lives inside `ThreadItem/index.jsx`.
- `getCouncilChipLabel()` improves featured-council card metadata.
- `updateCouncilPack()` updates both saved pack storage and featured-council storage if the pack is pinned there.
- `buildAnchoredFollowUpPrompt()` is the core continuity helper. It inspects the latest resolved user/assistant exchange, checks for referential cues, and rewrites the outgoing prompt to preserve continuity.

Known risk:

- The anchoring heuristic is intentionally broad. It improves continuity, but if future prompt rewriting grows more complex, it may need clearer boundaries to avoid over-anchoring.

### 5. Prism presence state and local desktop Piper playback

Commit:

- `84e6b9e0` `Fix Prism presence state and restore local desktop Piper playback`

Primary files:

- [PrismContext.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/PrismContext.jsx)
- [agent.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/utils/chat/agent.js)
- [piperTTS/index.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/utils/piperTTS/index.js)
- [piperTTS/worker.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/utils/piperTTS/worker.js)
- [TTSButton/piperTTS.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/TTSButton/piperTTS.jsx)
- [server/utils/piper/index.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/server/utils/piper/index.js)
- [server/utils/piper/piperFileExists.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/server/utils/piper/piperFileExists.js)

What changed in presence behavior:

- Agent session end now produces a Prism response pulse instead of using the generic “complete thinking” path.
- Agent websocket events now signal Prism response state on:
  - generic agent output
  - full text responses
  - first response chunk
  - “done thinking” status responses

What changed in Piper/TTS:

- Added Piper worker warmup before first playback.
- Split long text into more balanced chunks and prioritizes a smaller first chunk.
- Increased timeout handling for first chunk vs subsequent chunks.
- Added richer worker debug/progress/error reporting.
- Local voice assets now validate `.onnx` responses and fall back if the local file is just a bad LFS pointer or otherwise invalid.
- Server exposes `/static/piper/` and lazily downloads missing Piper runtime assets from storage if needed.

Why it mattered:

- Prism’s top-right/ambient response state could remain sticky or feel disconnected from agent output.
- Desktop Piper playback was brittle, especially on first request and on local bundled assets.

Behavioral impact on UI:

- The presence layer better reflects live agent output and transition back to response/settled state.
- TTS playback is more likely to work on first click and less likely to fail silently due to local asset issues.

Implementation notes:

- `PiperTTSClient.prewarm()` and worker `warmup` handling are the key first-request improvements.
- `piperFileExists` acts as a lightweight cache-and-fetch gate for required Piper runtime files.
- Local model validation guards against shipping broken voice binaries or LFS pointer placeholders.

Known risk:

- This commit materially improved presence and Piper behavior, but it did not guarantee the badge/ambient behavior is perfect in every live edge case.
- Piper still spans frontend worker logic plus server static-asset availability, so regressions can come from either side.

### 6. Verification artifacts

Commit:

- `4133c236` `Add PrismAI manual verification checklist and follow-up smoke notes`

Primary files:

- [PRISMAI_MANUAL_LIVE_VERIFICATION_CHECKLIST.md](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/PRISMAI_MANUAL_LIVE_VERIFICATION_CHECKLIST.md)
- [PRISMAI_WAVE1_SMOKE_CHECKLIST.md](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/PRISMAI_WAVE1_SMOKE_CHECKLIST.md)

What changed:

- Added a human-run verification checklist for the rehab fixes:
  - Docker Model Runner visibility
  - create-workspace affordance
  - attachment picker
  - clipboard paste
  - thread rename
  - custom council naming
  - current context fidelity
  - draft alignment clear-state
  - aligned follow-up continuity
- Added a shorter smoke checklist for desktop, frontend, server, and integration lanes.

Why it mattered:

- These fixes were user-facing and cross-layer. A textual checklist is part of the product handoff because it tells the next engineer exactly what manual behaviors to re-verify after packaging or merging.

## Cross-Cutting Themes

### Shared source of truth

The strongest theme in this fix series is removal of duplicated UI configuration:

- provider lists moved toward shared registries
- attachment entry points moved toward one shared pipeline
- council renaming now updates both saved packs and featured cards
- desktop packaging validates that the shipped frontend matches the built frontend

### Preserve active conversation context

Several fixes are really about continuity:

- model/provider continuity
- attachment-context continuity
- alignment continuity
- thread rename immediate UI continuity
- presence/TTS continuity between agent output and the shell state

That principle should continue to guide future UI work.

## Validation State

Validation evidence checked into the repo:

- operator checklist: [PRISMAI_MANUAL_LIVE_VERIFICATION_CHECKLIST.md](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/PRISMAI_MANUAL_LIVE_VERIFICATION_CHECKLIST.md)
- smoke checklist: [PRISMAI_WAVE1_SMOKE_CHECKLIST.md](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/PRISMAI_WAVE1_SMOKE_CHECKLIST.md)

What this handoff can assert from code history:

- the fixes were committed as a coherent Mar 29 rehab series
- the behavior changes are localized to the files described above
- the intended verification cases were documented immediately after the code landed

What this handoff does **not** assert:

- that every checklist item has been rerun against today’s dirty working tree
- that current uncommitted WIP preserves all of these behaviors unchanged

## Open Risks / Likely Follow-Up Areas

These are the areas most likely to need attention if regressions show up later:

1. Provider drift
   - New provider work must stay on shared registries and shared options maps.

2. Attachment pipeline regressions
   - Empty state, plus-button, drag/drop, and paste should stay on the same path. If a future UI adds another file entry point, it should emit the same events instead of directly manipulating DOM/file inputs.

3. Alignment heuristics
   - Continuity improved through prompt rewriting. If users report “wrong context” or “it kept referring to the previous answer,” start in [metacanonAlignment.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/utils/metacanonAlignment.js).

4. Desktop TTS
   - Piper playback now spans worker warmup, local asset validation, static hosting, and fallback downloads. Failures can come from any of those layers.

5. Presence polish
   - This series improved the Prism response/thinking state, but any sticky badge or transition weirdness will likely involve [PrismContext.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/PrismContext.jsx) plus [agent.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/utils/chat/agent.js).

## Recommended Starting Points for a New Engineer

If someone is picking up this lane cold, have them read in this order:

1. [PRISMAI_MANUAL_LIVE_VERIFICATION_CHECKLIST.md](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/PRISMAI_MANUAL_LIVE_VERIFICATION_CHECKLIST.md)
2. [prepare-core.mjs](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/desktop-tauri/scripts/prepare-core.mjs)
3. [GeneralSettings/LLMPreference/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/pages/GeneralSettings/LLMPreference/index.jsx)
4. [PromptInput/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx)
5. [DnDWrapper/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/index.jsx)
6. [metacanonAlignment.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/utils/metacanonAlignment.js)
7. [ThreadItem/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/Sidebar/ActiveWorkspaces/ThreadContainer/ThreadItem/index.jsx)
8. [FeaturedCouncils/index.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/components/Sidebar/FeaturedCouncils/index.jsx)
9. [PrismContext.jsx](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/PrismContext.jsx)
10. [piperTTS/index.js](/Users/paulcooper/Documents/Codex%20Master%20Folder/worktrees/anything-llm/prismai-server/frontend/src/utils/piperTTS/index.js)

## Bottom Line

The March 29 rehab series was not just visual polish. It repaired several of the seams where Prism-specific UX had drifted away from AnythingLLM’s working chat infrastructure:

- provider state
- attachments
- thread actions
- council/alignment continuity
- presence feedback
- local TTS
- desktop packaging fidelity

If future work reopens one of those areas, use these commits as the behavioral baseline before layering new design or product changes on top.
