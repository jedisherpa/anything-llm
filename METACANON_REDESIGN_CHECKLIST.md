# Metacanon Redesign Checklist

This is the practical implementation order for redesigning the current AnythingLLM-MetacanonAI UI without fighting the app structure.

Use this together with:
- `METACANON_UI_INVENTORY.md`
- `METACANON_FIGMA_PAGE_MAP.md`

## Goal

Redesign the current UI in a way that is:
- visually coherent
- easy to review in Figma
- easy to implement incrementally
- low-risk for regressions

## Priority Order

### Phase 0: Lock the System

These changes create consistency before we start restyling screens.

- [ ] Finalize brand tokens in `frontend/src/index.css`
  - colors
  - surfaces
  - borders
  - shadows
  - text hierarchy
- [ ] Finalize theme behavior in `frontend/src/hooks/useTheme.js`
- [ ] Finalize logos and app title
  - `frontend/src/LogoContext.jsx`
  - `frontend/index.html`
- [ ] Finalize Prism behavior rules
  - `frontend/src/PrismContext.jsx`
  - `frontend/src/components/PrismPresence/index.jsx`
- [ ] Decide the base spacing system
  - `4 / 8 / 12 / 16 / 24 / 32`
- [ ] Decide border radius system
- [ ] Decide button hierarchy
  - primary
  - secondary
  - ghost
  - icon-only

Why first:
- every later page inherits this
- avoids redesign drift
- reduces rework

## Phase 1: Global Shell

These are the highest-visibility surfaces and should be mocked first.

- [ ] Sidebar shell
  - `frontend/src/components/Sidebar/index.jsx`
  - header
  - logo
  - Prism position
  - search box
  - workspace list
  - thread list
  - bottom-left dock
- [ ] Settings sidebar shell
  - `frontend/src/components/SettingsSidebar/index.jsx`
- [ ] Footer dock
  - `frontend/src/components/Footer/index.jsx`
- [ ] Settings/home button treatment
  - `frontend/src/components/SettingsButton/index.jsx`
- [ ] Global typography cleanup
  - `frontend/src/index.css`

Definition of done:
- the left rail feels finished
- branding feels correct
- dock spacing is stable
- icon sizes are consistent

## Phase 2: Core Chat Experience

This is the product’s primary surface and should come right after the shell.

- [ ] Chat page layout
  - `frontend/src/pages/WorkspaceChat/index.jsx`
- [ ] Chat container
  - `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- [ ] Empty state
- [ ] Prompt composer
  - text area
  - attachments
  - model selector
  - tool menu
  - send/stop actions
- [ ] Message bubbles
  - user
  - assistant
  - system/status
  - Prism/lens thought states
- [ ] Message actions
  - copy
  - edit
  - delete
  - TTS
  - metrics
- [ ] Citations and source cards

Definition of done:
- chat is visually readable
- composer feels polished
- messages have clear hierarchy
- Prism presence feels intentional, not decorative only

## Phase 3: Login and Onboarding

These are compact, high-impact screens and easy to make visually strong.

- [ ] Login page
  - `frontend/src/pages/Login/index.jsx`
  - `frontend/src/components/Modals/Password/index.jsx`
- [ ] Onboarding flow shell
  - `frontend/src/pages/OnboardingFlow/index.jsx`
- [ ] Onboarding step screens
  - provider selection
  - embeddings
  - vector DB
  - user setup
  - data handling

Definition of done:
- the first-run experience matches the brand
- steps feel guided and premium
- there is no mismatch between login/onboarding and the main app shell

## Phase 4: Settings and Configurators

These are broad but structurally similar, so they should be systematized rather than redesigned one by one from scratch.

- [ ] General settings layout pattern
- [ ] Settings form controls
  - text inputs
  - selects
  - toggles
  - save bars
  - helper text
  - warning text
- [ ] Settings cards and sections
- [ ] Interface settings
- [ ] Branding settings
- [ ] Chat settings
- [ ] API keys
- [ ] Security
- [ ] Privacy and data
- [ ] Browser extension
- [ ] Mobile connections
- [ ] Embed chat widgets

Primary files:
- `frontend/src/pages/GeneralSettings/*`
- `frontend/src/components/ContextualSaveBar/index.jsx`
- `frontend/src/components/lib/CTAButton/index.jsx`

Definition of done:
- all settings screens feel like one system
- save/apply actions are visually consistent
- form density feels intentional

## Phase 5: Workspace Settings

These are secondary to chat, but still user-facing and important.

- [ ] General appearance
- [ ] Chat settings
- [ ] Vector database
- [ ] Members
- [ ] Agent config
- [ ] Agent/model selection modals

Primary files:
- `frontend/src/pages/WorkspaceSettings/*`

## Phase 6: Modals and Utility Surfaces

These are easy to forget and usually create visual inconsistency if left for last-minute patching.

- [ ] New workspace modal
- [ ] Invite/add member modal
- [ ] New API key modal
- [ ] Browser extension key modal
- [ ] Embed create/edit modals
- [ ] User account modal
- [ ] Confirmation dialogs
- [ ] Keyboard shortcuts help

Definition of done:
- modal sizing is standardized
- spacing is consistent
- primary and secondary actions look related across the app

## Phase 7: Admin and Specialist Screens

These are lower priority unless they are core to your personal workflow.

- [ ] Agents list
- [ ] Agent builder
- [ ] Event logs
- [ ] Users
- [ ] Invitations
- [ ] Workspaces
- [ ] Default system prompt
- [ ] System prompt variables
- [ ] Experimental features
- [ ] Community hub pages

Primary files:
- `frontend/src/pages/Admin/*`
- `frontend/src/pages/GeneralSettings/CommunityHub/*`

## Phase 8: Metacanon and Prism Extras

These are custom identity surfaces and can evolve in parallel after the core product feels stable.

- [ ] MetacanonAI features page
  - `frontend/src/pages/MetacanonAI/index.jsx`
- [ ] Metacanon UI Lab
  - `frontend/src/pages/MetacanonAILab/index.jsx`
- [ ] Prism hero
  - `frontend/src/pages/PrismHero/*`
- [ ] Prism dodecahedron page
  - `frontend/src/pages/PrismDodecahedron/*`

## Recommended Working Order

If we want the cleanest momentum, use this order:

1. Brand tokens and spacing system
2. Sidebar and footer dock
3. Chat container and prompt composer
4. Message styles and empty state
5. Login
6. Onboarding
7. Shared settings form system
8. Workspace settings
9. Modals
10. Admin screens
11. Metacanon extras

## High-Leverage Files

These give the most visual leverage per edit.

- `frontend/src/index.css`
- `frontend/src/components/Sidebar/index.jsx`
- `frontend/src/components/SettingsSidebar/index.jsx`
- `frontend/src/components/Footer/index.jsx`
- `frontend/src/components/SettingsButton/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx`
- `frontend/src/components/lib/CTAButton/index.jsx`
- `frontend/src/components/ContextualSaveBar/index.jsx`
- `frontend/src/components/ModalWrapper/index.jsx`

## Fast Review Workflow

For each redesign pass:

1. Mock one screen in Figma.
2. Match it in `/metacanonai/ui-lab` or the real screen.
3. Lock the shared primitives first.
4. Reuse those primitives on the next screen.
5. Do not jump to specialist screens before shell and chat are stable.

## Good First Mock Set

If you only mock a few screens first, start here:

1. Sidebar + footer dock
2. Main chat screen
3. Login
4. One settings page
5. One modal

That set covers most of the app’s reusable UI language.
