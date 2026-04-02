# PrismAI React Behavior Map

## Purpose

This document is the behavioral companion to `PRISMAI_UI_FIGMA_HANDOFF_REPORT.md`.

The Figma handoff explains how the UI looks. This report explains how the React app behaves:

- how the route tree is organized
- which providers own global state
- how auth and onboarding gate the app
- how workspace chat loads, streams, and persists
- how Prism-specific alignment, presence, and desktop runtime logic fit into the normal AnythingLLM flow
- where behavior actually lives when you want to change it

Use this as the source-of-truth map for translating the existing product into Figma flows, prototypes, interaction states, and component behavior.

## 1. Application Bootstrap

### Entry point

Primary bootstrap lives in:

- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

### What `main.jsx` does

`frontend/src/main.jsx` creates the router with `createBrowserRouter` and lazy-loads almost every page. It also imports the entire visual layer up front:

- `theme-dark.css`
- `theme-light.css`
- `theme-cathedral.css`
- `prism-presence.css`
- `index.css`
- `prism-app-treatment.css`

Behaviorally, this means:

- route resolution happens first
- theme CSS is globally available before any page renders
- page code is split by route family
- Prism experimental routes can be injected conditionally

### What `App.jsx` does

`frontend/src/App.jsx` is the runtime shell above all pages.

It provides:

1. Error boundary
2. Theme provider
3. PWA mode provider
4. Prism presence provider
5. Auth provider
6. Logo provider
7. Profile-photo provider
8. i18n provider
9. shared shell chrome
10. toast container
11. keyboard shortcuts help

The important behavioral point is that almost every visible surface in the app renders inside the same shell:

- `.prism-app-shell`
- ambient left/right decoration layers
- `.prism-app-grid`
- `.prism-app-content`

So from a Figma perspective, the app is not a collection of unrelated pages. It is one continuous shell with route-based inner content.

## 2. Route Graph and Page Families

### Route source

All top-level routes are declared in:

- `frontend/src/main.jsx`

### Major route families

#### Public/auth routes

- `/login`
- `/sso/simple`
- `/accept-invite/:code`

#### Main/private routes

- `/`
- `/workspace/:slug`
- `/workspace/:slug/t/:threadSlug`
- `/workspace/:slug/settings/:tab`

#### Global settings routes

- `/settings/llm-preference`
- `/settings/transcription-preference`
- `/settings/audio-preference`
- `/settings/embedding-preference`
- `/settings/text-splitter-preference`
- `/settings/vector-database`
- `/settings/agents`
- `/settings/agents/builder`
- `/settings/agents/builder/:flowId`
- `/settings/event-logs`
- `/settings/embed-chat-widgets`
- `/settings/security`
- `/settings/privacy`
- `/settings/interface`
- `/settings/branding`
- `/settings/default-system-prompt`
- `/settings/chat`
- `/settings/beta-features`
- `/settings/api-keys`
- `/settings/system-prompt-variables`
- `/settings/browser-extension`
- `/settings/workspace-chats`
- `/settings/invites`
- `/settings/users`
- `/settings/workspaces`
- `/settings/beta-features/live-document-sync/manage`
- `/settings/community-hub/trending`
- `/settings/community-hub/authentication`
- `/settings/community-hub/import-item`
- `/settings/mobile-connections`

#### Onboarding routes

- `/onboarding`
- `/onboarding/:step`

#### Prism route family

These route paths come from `PRISM_SURFACES`:

- control center
- library
- composer
- optional experimental surfaces
- optional repo lab

The important design takeaway is that Prism is not a separate app. It is a route family inside the same router and provider stack.

### Route guards

Route protection is implemented in:

- `frontend/src/components/PrivateRoute/index.jsx`

Guard types:

- `PrivateRoute`
- `AdminRoute`
- `ManagerRoute`

These do three things:

1. wait for auth/onboarding checks
2. redirect incomplete installs to onboarding
3. wrap allowed pages with keyboard shortcuts and usually `UserMenu`

So route access behavior is not owned by each page. It is centralized in the wrappers.

## 3. Global Providers and What They Own

### ThemeProvider

Files:

- `frontend/src/ThemeContext.jsx`
- `frontend/src/hooks/useTheme.js`

Owns:

- current sanctuary mode: `dark`, `light`, or `cathedral`
- persistence to `localStorage.theme`
- `document.documentElement[data-theme]`
- `body.light` toggle
- cross-tab sync through `storage` events
- theme change custom event

Important event:

- `prism-theme-changed`

Important behavior:

- theme is global
- CSS is token-driven
- switching theme does not replace route content, only the visual contract

### PWAModeProvider

File:

- `frontend/src/PWAContext.jsx`

Owns:

- whether the app is running as a standalone PWA

Detects via:

- `matchMedia("(display-mode: standalone)")`
- `navigator.standalone`
- Android app referrer

Applies:

- `body.pwa`
- `documentElement[data-pwa]`

This means some layout or spacing logic can branch on install mode, not just viewport size.

### PrismProvider

File:

- `frontend/src/PrismContext.jsx`

Owns:

- global Prism presence state
- hover state
- chat-thinking state
- agent-thinking state
- transient response pulse
- transient error pulse

Derived visual states:

- `idle`
- `hover`
- `thinking`
- `response`
- `error`

Input signals come from:

- hover registration
- chat events
- agent websocket events
- error boundary

Important custom events:

- `prismStateThinking`
- `prismStateResponse`
- `prismStateError`
- `prismStateReset`

This provider is one of the key Prism-specific behavioral systems. It is what makes the shell feel "alive" rather than static.

### AuthProvider

File:

- `frontend/src/AuthContext.jsx`

Owns:

- current user object
- current auth token
- refresh flow for multi-user mode
- logout/clear behavior on failed refresh

Persists:

- `anythingllm_user`
- `anythingllm_authToken`
- `anythingllm_authTimestamp`

Also clears:

- `anythingllm_user_prompt_input_map`

Important behavior:

- auth refresh happens centrally
- invalid session forces navigation to `/login`
- store/actions exist in context, but comments indicate the action helpers are not widely used

### LogoProvider

File:

- `frontend/src/LogoContext.jsx`

Owns:

- instance logo
- login logo
- custom-logo flag

Default fallback behavior:

- dark theme uses Prism dark logo
- light theme uses Prism light logo

Important event:

- `refetch-logo`

### PfpProvider

File:

- `frontend/src/PfpContext.jsx`

Owns:

- current user profile image

Behavior:

- fetches image when `user.id` changes
- no profile photo means a `null` state, not a hard failure

## 4. Auth and Onboarding Behavior

### Auth checks

Main guard logic lives in:

- `frontend/src/components/PrivateRoute/index.jsx`

The boot sequence is:

1. `System.isOnboardingComplete()`
2. `System.keys()`
3. decide auth mode:
   - single user, no auth
   - single user, password auth
   - multi-user auth
4. if a token exists, validate it
5. redirect to onboarding, login, or the target route

### Why this matters

The app does not have one global "logged in" boolean. It has three install modes:

- onboarding incomplete
- single-user
- multi-user

That distinction changes page access and should be mirrored in any Figma flow map.

## 5. Workspace Entry Flow

Primary page:

- `frontend/src/pages/WorkspaceChat/index.jsx`

### Workspace page boot sequence

1. `usePasswordModal()` checks whether the workspace itself requires a password
2. if protected, show password modal
3. load workspace by `slug`
4. fetch suggested messages
5. persist `anythingllm_last_visited_workspace`
6. render shell:
   - sidebar on desktop
   - workspace frame
   - workspace chat container

### Behavior note

There are two nested shells:

- the global app shell from `App.jsx`
- the workspace shell from `WorkspaceChat/index.jsx`

That is why chat feels like a dedicated environment while still living inside the broader settings/control-center product.

## 6. Workspace Chat Container Ownership

Primary files:

- `frontend/src/components/WorkspaceChat/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`

### `WorkspaceChat/index.jsx`

Owns:

- loading initial history
- handling missing workspace state
- wrapping chat with:
  - `TTSProvider`
  - `DnDFileUploaderProvider`

It also installs a document-level copy-code handler through `setEventDelegatorForCodeSnippets()`.

### `ChatContainer/index.jsx`

This is the main behavior controller for active conversation.

It owns:

- `loadingResponse`
- `chatHistory`
- agent websocket ID and connection state
- chat mode vs query mode
- execute mode vs chat mode
- selected execute worktree root
- trusted execute session
- execute status payload

It also coordinates:

- prompt submission
- mode switching
- stream handling
- websocket agent handling
- attachment intake
- execute-mode handoff
- Prism presence updates

If you want to understand "what the product does when the user sends something," this is the center of gravity.

## 7. Chat Modes, Execute Modes, and Handoff Logic

File:

- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`

### Chat mode

The workspace itself persists normal mode state as:

- `chat`
- `query`

Changing the mode calls:

- `Workspace.update(workspace.slug, { chatMode: nextMode })`

### Execute mode

Separate from chat/query, the container also tracks:

- `executionMode`

Values:

- `chat`
- `execute`

### Automatic execute handoff

The container contains an `EXECUTE_INTENT_PATTERN` regex.

This means the UI can detect prompts that sound like:

- save/export/write a file
- run tests or build
- inspect a repo
- browse the web or research

and automatically switch the user into Execute mode.

This is important for Figma because Execute mode is not just a manual toggle. It can be suggested or activated by inferred intent.

### Trusted session state

The container restores trusted-session state from prior assistant messages.

Recovered fields include:

- `trustedSessionId`
- `sessionExpiresAt`
- `subSphereId`
- `selectedWorktreeRoot`

That means execute continuity is conversation-aware, not only form-state-driven.

## 8. Streaming Chat Lifecycle

Primary files:

- `frontend/src/models/workspace.js`
- `frontend/src/utils/chat/index.js`

### Request path

Standard workspace chat uses:

- `Workspace.streamChat(...)`

Thread chat uses:

- `Workspace.threads.streamChat(...)`

The network layer uses:

- `fetchEventSource`

### SSE lifecycle

The frontend handles these event types:

- `abort`
- `statusResponse`
- `textResponse`
- `textResponseChunk`
- `finalizeResponseStream`
- `agentInitWebsocketConnection`
- `stopGeneration`

### Behavioral flow

1. user prompt is sent with attachments and optional execute payload
2. SSE stream opens
3. incoming event payloads are normalized by `handleChat`
4. assistant message is inserted or incrementally updated
5. final stream event closes animation/loading state
6. TTS completion event can fire for the assistant message

### Special action payloads

The streaming response can also issue side-effect actions:

- `reset_chat`
- `rename_thread`

`rename_thread` dispatches a custom event so the sidebar thread list can update without a hard reload.

## 9. Agent WebSocket Lifecycle

Primary file:

- `frontend/src/utils/chat/agent.js`

Standard chat uses SSE, but agent-mode execution uses a WebSocket path for richer live activity.

### Agent session responsibilities

This layer handles:

- websocket URI derivation
- active agent-session state
- report stream events
- status updates
- feedback requests
- file-download events
- websocket failures

Important custom events:

- `AGENT_SESSION_START`
- `AGENT_SESSION_END`

### Why it matters

The app has two different live-response transport models:

1. SSE for normal chat text streaming
2. WebSocket for agent-session execution and richer live telemetry

In Figma, these should not be modeled as the same type of loading state.

## 10. Prompt Input Behavior

Primary files:

- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/constants.js`
- `frontend/src/hooks/usePromptInputStorage.js`

### Prompt input responsibilities

The prompt composer is more than a text area. It is the interaction hub for:

- draft text
- tools menu
- slash commands
- starter-pack / pack invocation affordances
- first-run hints
- undo/redo behavior
- keyboard shortcuts
- attachments via picker, paste, and drag-and-drop
- prompt rewrite events from elsewhere in the app

Important constants:

- `PROMPT_INPUT_ID = "primary-prompt-input"`
- `PROMPT_INPUT_EVENT = "set_prompt_input"`

### Draft persistence

Drafts are stored in:

- `anythingllm_user_prompt_input_map`

Scope:

- thread-specific when `threadSlug` exists
- workspace-specific otherwise

So the UI remembers different drafts per workspace/thread.

### Attachment intake paths

The composer can receive files through:

- attachment picker events
- clipboard paste
- drag-and-drop wrapper context

This is why the composer behavior needs a state diagram in Figma, not just static variants.

## 11. Drag-and-Drop and Attachment Pipeline

Primary files:

- `frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/*`
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`

The chat container consumes uploader context:

- `files`
- `parseAttachments`

Important events imported into the container:

- `CLEAR_ATTACHMENTS_EVENT`
- `OPEN_ATTACHMENT_PICKER_EVENT`

Behaviorally, attachments are handled as a shared pipeline rather than separate one-off UI actions. That is why empty states, plus-button actions, paste behavior, and drag-drop overlays should all be thought of as different entry points into the same underlying system.

## 12. Alignment, Lenses, Constellations, and Councils

Primary file:

- `frontend/src/utils/metacanonAlignment.js`

This file is one of the most important Prism-specific behavior modules.

### What it owns

- active alignment persistence
- alignment normalization
- council/pack prompt construction
- direct invocation formatting
- follow-up anchoring
- council/lens accent derivation

### Persistence

Active alignment is stored in:

- `anythingllm_active_metacanon_alignment`

Important event:

- `metacanon_alignment_updated`

### Behavioral rules

This module can:

- convert a selected council pack into an `@council` prompt block
- convert direct handles into explicit slash/at-style invocation
- preserve continuity for short follow-ups
- reinterpret prompts like "answer again in light of the lens" as revisions of the active conversation instead of generic explanations

This is not cosmetic metadata. It changes the actual prompt text sent downstream.

### Figma implication

Any UI that lets the user choose a lens, council, or constellation needs states for:

- selected but not runnable
- runnable
- active with visible banner/chip
- clearable
- follow-up anchored to active exchange

## 13. Prism Presence and Ambient Response

Primary files:

- `frontend/src/PrismContext.jsx`
- `frontend/src/utils/prism/events.js`

Prism presence responds to:

- hover
- chat start
- chat completion
- agent stream start/end
- errors

The visual state machine is global and shell-level, not page-local.

That means the top-right presence indicator, ambient shell energy, and response pulse are effectively one coordinated product subsystem.

For design purposes, that subsystem should be thought of as a reactive assistant-presence layer rather than an isolated badge.

## 14. Desktop Runtime Bridge

Primary file:

- `frontend/src/utils/desktopRuntime.js`

This file is the bridge between the React app and the Tauri host.

### Desktop detection

Desktop shell is detected by either:

- Tauri invoke availability
- `prism_shell=desktop` query flag

### Exposed desktop behaviors

- read runtime status
- set execute engine URL
- restart the desktop app
- run dependency actions

Important point:

Desktop-only behavior is not inferred from styling. It is explicitly bridged through Tauri commands.

So any Figma flows for desktop setup, dependency repair, or runtime readiness should be modeled as host-integrated actions, not standard browser settings screens.

## 15. Model/API Layer

Primary files:

- `frontend/src/models/workspace.js`
- `frontend/src/models/system.js`

These files are thin API clients, not Redux-like stores.

### `Workspace` model owns network behavior for

- workspace CRUD
- chat history
- streaming chat
- execute-session actions
- execute status
- thread operations
- feedback
- attachment-related updates

Notable constants:

- `workspaceOrderStorageKey = "anythingllm-workspace-order"`
- `maxContextWindowLimit = 0.8`

### `System` model owns network behavior for

- onboarding completion
- setup keys
- auth checks
- user refresh
- logo and profile fetch
- Prism readiness
- Prism dependency sequence
- setup draft and bootstrap actions
- local-files inspection

These models are the bridge between UI state and backend capabilities. When you want to redesign the UI in Figma, these files tell you what asynchronous states must exist.

## 16. Local Persistence Map

### Local storage keys directly visible in the React layer

- `theme`
- `anythingllm_user`
- `anythingllm_authToken`
- `anythingllm_authTimestamp`
- `anythingllm_last_visited_workspace`
- `anythingllm_user_prompt_input_map`
- `anythingllm_active_metacanon_alignment`
- `anythingllm-workspace-order`

### Session storage keys directly visible in the React layer

- `anythingllm_pending_home_message`

### Why this matters

These keys are the memory layer for the frontend experience:

- auth persistence
- last workspace continuity
- draft continuity
- alignment continuity
- pending message handoff
- workspace ordering

They explain why the product can feel stateful even without a heavy global client store.

## 17. Important Custom Events

### Theme and shell

- `prism-theme-changed`
- `prismStateThinking`
- `prismStateResponse`
- `prismStateError`
- `prismStateReset`

### Branding

- `refetch-logo`

### Prompt/composer

- `set_prompt_input`

### Chat and threads

- `abort-chat-stream`
- thread rename event from sidebar thread container

### Alignment

- `metacanon_alignment_updated`

### Agent execution

- `AGENT_SESSION_START`
- `AGENT_SESSION_END`

The app uses custom DOM events as a lightweight event bus. That is part of the architecture and should be preserved if behaviors are moved around.

## 18. Behavioral Ownership by Surface

### Sidebar

Main responsibilities:

- workspace navigation
- thread navigation
- search and create-workspace affordances
- workspace/thread rename hooks
- featured councils and launch surfaces

The sidebar is not only navigation; it is also a control surface for workspace state and council entry points.

### Workspace frame

Main responsibilities:

- entering a workspace
- guarding with password modal when required
- loading workspace metadata and suggested prompts
- mounting chat, attachments, and TTS providers

### Chat history area

Main responsibilities:

- rendering normalized message records
- streaming chunk updates
- code-copy affordances
- source display
- metrics display
- TTS playback hooks

### Prompt composer

Main responsibilities:

- collecting text
- maintaining unsent draft state
- command/tool invocation
- attachment intake
- alignment visibility
- chat/query/execute orchestration

### Settings surfaces

Main responsibilities:

- reading/writing server-backed preferences
- depending on auth role wrapper
- sharing common page shell patterns
- exposing provider choices, system state, and workspace controls

### Prism-specific surfaces

Main responsibilities:

- lenses, councils, constellations, and control-center flows
- alignment creation or selection
- experimental route behavior
- visual coupling to Prism presence and theme language

## 19. Where to Change Behavior

If you want to change a behavior category, start here:

### Route or shell behavior

- `frontend/src/main.jsx`
- `frontend/src/App.jsx`

### Auth and onboarding flow

- `frontend/src/components/PrivateRoute/index.jsx`
- `frontend/src/AuthContext.jsx`
- `frontend/src/models/system.js`

### Theme switching and sanctuary state

- `frontend/src/hooks/useTheme.js`
- `frontend/src/ThemeContext.jsx`

### Global Prism presence / top-level reactive state

- `frontend/src/PrismContext.jsx`
- `frontend/src/utils/prism/events.js`

### Workspace entry and page boot

- `frontend/src/pages/WorkspaceChat/index.jsx`

### Chat orchestration and execute mode

- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`

### Stream response handling

- `frontend/src/utils/chat/index.js`
- `frontend/src/utils/chat/agent.js`
- `frontend/src/models/workspace.js`

### Prompt composer behavior

- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx`
- `frontend/src/hooks/usePromptInputStorage.js`

### Lens / council / constellation / prompt rewriting

- `frontend/src/utils/metacanonAlignment.js`

### Desktop-only host integration

- `frontend/src/utils/desktopRuntime.js`

### Brand/logo/profile state

- `frontend/src/LogoContext.jsx`
- `frontend/src/PfpContext.jsx`

## 20. Figma Translation Guidance

To design this app accurately in Figma, treat it as five linked systems rather than one flat page library:

1. **Shell system**
   - app shell
   - sidebar
   - ambient presence
   - sanctuary modes

2. **Route family system**
   - onboarding
   - settings
   - workspace chat
   - Prism library/control-center/composer

3. **Conversation system**
   - prompt composer
   - history stream
   - attachments
   - mode toggles
   - thread continuity

4. **Alignment system**
   - lens/council/constellation selection
   - active alignment banner state
   - direct invocation
   - follow-up continuity

5. **Host/runtime system**
   - desktop runtime readiness
   - execute mode
   - trusted session state
   - dependency actions

If those five systems are modeled in Figma with stateful variants and route transitions, the prototype will reflect the real app much more closely than a static page recreation.

## 21. Bottom Line

The PrismAI frontend is not a monolithic React app with one store. It is a layered shell with:

- route-level lazy pages
- provider-owned global state
- model-based API clients
- DOM custom-event cross-talk
- localStorage/sessionStorage continuity
- dual live-response channels
- Prism-specific alignment and presence behavior
- desktop-only host bridges

That combination is what creates the product feel.

If the Figma rebuild needs to preserve not just appearance but the logic of the current product, the most important files to keep open alongside design work are:

- `frontend/src/main.jsx`
- `frontend/src/App.jsx`
- `frontend/src/components/PrivateRoute/index.jsx`
- `frontend/src/pages/WorkspaceChat/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx`
- `frontend/src/utils/chat/index.js`
- `frontend/src/utils/chat/agent.js`
- `frontend/src/utils/metacanonAlignment.js`
- `frontend/src/utils/desktopRuntime.js`
