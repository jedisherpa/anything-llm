# Metacanon Figma Page Map

This is the fastest way to structure the Figma file so each mock maps cleanly to a real screen or component in the current app.

Use this together with:
- `METACANON_UI_INVENTORY.md`
- `METACANON_REDESIGN_CHECKLIST.md`

## File Structure

Create one Figma file called:

- `AnythingLLM-MetacanonAI UI`

Inside it, create pages in this order.

## Page 1: Foundations

Purpose:
- lock the design system before page-specific work

Frames/components to include:
- color palette
- surface palette
- text styles
- spacing scale
- radius scale
- shadows
- icon sizing
- button types
- input styles
- card styles
- modal shell styles
- Prism states
- logo usage
- dock icon treatment

Match to code:
- `frontend/src/index.css`
- `frontend/src/hooks/useTheme.js`
- `frontend/src/components/PrismPresence/index.jsx`
- `frontend/src/LogoContext.jsx`

## Page 2: App Shell

Purpose:
- define the global frame around most authenticated screens

Frames to create:
- `Shell / Sidebar Expanded`
- `Shell / Sidebar Collapsed`
- `Shell / Settings Sidebar`
- `Shell / Footer Dock`
- `Shell / Header Variants`

Include:
- logo placement
- Prism placement
- workspace list item
- thread item
- search box
- footer dock button spacing
- active / hover / selected states

Match to code:
- `frontend/src/components/Sidebar/index.jsx`
- `frontend/src/components/Sidebar/SearchBox/index.jsx`
- `frontend/src/components/Sidebar/ActiveWorkspaces/index.jsx`
- `frontend/src/components/SettingsSidebar/index.jsx`
- `frontend/src/components/Footer/index.jsx`
- `frontend/src/components/SettingsButton/index.jsx`

## Page 3: Chat

Purpose:
- define the product’s most important screen

Frames to create:
- `Chat / Empty State`
- `Chat / Active Conversation`
- `Chat / Long Thread`
- `Chat / With Citations`
- `Chat / Agent Thinking`
- `Chat / Mobile Hint` if you want a future responsive pass

Components to include:
- prompt composer
- send button
- stop button
- attachment chip
- model selector
- tool menu
- user message
- assistant message
- status message
- citation card
- thought block
- message action row

Match to code:
- `frontend/src/pages/WorkspaceChat/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/*`

## Page 4: Login and Access

Frames to create:
- `Auth / Login`
- `Auth / SSO`
- `Auth / Invite Accepted`
- `Auth / Invite Pending`

Include:
- branding
- form fields
- primary CTA
- secondary/help text
- background treatment
- Prism placement

Match to code:
- `frontend/src/pages/Login/index.jsx`
- `frontend/src/components/Modals/Password/index.jsx`
- `frontend/src/pages/Invite/index.jsx`

## Page 5: Onboarding

Frames to create:
- `Onboarding / Welcome`
- `Onboarding / Survey`
- `Onboarding / LLM Preference`
- `Onboarding / Embeddings`
- `Onboarding / Vector Database`
- `Onboarding / User Setup`
- `Onboarding / Data Handling`

Include:
- progress indicator
- step header
- cards/options
- back/next actions
- Prism behavior if wanted

Match to code:
- `frontend/src/pages/OnboardingFlow/index.jsx`
- `frontend/src/pages/OnboardingFlow/Steps/*`

## Page 6: Settings System

Purpose:
- define one reusable settings language before screen-by-screen mocking

Frames to create:
- `Settings / Overview Pattern`
- `Settings / Card Section`
- `Settings / Form Section`
- `Settings / Save Bar`
- `Settings / Empty State`
- `Settings / Warning State`

Components to include:
- section header
- helper text
- input row
- select row
- toggle row
- destructive action row
- inline status badge
- save/apply/cancel patterns

Match to code:
- `frontend/src/pages/GeneralSettings/*`
- `frontend/src/components/ContextualSaveBar/index.jsx`
- `frontend/src/components/lib/CTAButton/index.jsx`

## Page 7: Specific Settings Screens

Create one frame each for the settings you care about most.

Recommended frames:
- `Settings / Interface`
- `Settings / Branding`
- `Settings / Chat`
- `Settings / API Keys`
- `Settings / Security`
- `Settings / Privacy`
- `Settings / Browser Extension`
- `Settings / Embed Widgets`
- `Settings / Mobile Connections`

## Page 8: Workspace Settings

Frames to create:
- `Workspace Settings / General Appearance`
- `Workspace Settings / Chat Settings`
- `Workspace Settings / Vector Database`
- `Workspace Settings / Members`
- `Workspace Settings / Agent Config`

Match to code:
- `frontend/src/pages/WorkspaceSettings/*`

## Page 9: Modals

Purpose:
- standardize overlays before we style every individual modal separately

Frames to create:
- `Modal / Base`
- `Modal / Confirmation`
- `Modal / New Workspace`
- `Modal / Add Member`
- `Modal / New API Key`
- `Modal / Browser Extension Key`
- `Modal / Embed Create`
- `Modal / Embed Edit`
- `Modal / Account`

Match to code:
- `frontend/src/components/Modals/*`
- `frontend/src/pages/**/New*Modal/*`
- `frontend/src/components/UserMenu/AccountModal/index.jsx`

## Page 10: Admin

Frames to create only if needed soon:
- `Admin / Agents`
- `Admin / Agent Builder`
- `Admin / Logs`
- `Admin / Users`
- `Admin / Invitations`
- `Admin / Workspaces`

These are lower priority unless they are central to your workflow.

## Page 11: MetacanonAI

Frames to create:
- `MetacanonAI / Feature Menu`
- `MetacanonAI / UI Lab`
- `Prism / Hero`
- `Prism / Geometry`

Match to code:
- `frontend/src/pages/MetacanonAI/index.jsx`
- `frontend/src/pages/MetacanonAILab/index.jsx`
- `frontend/src/pages/PrismHero/*`
- `frontend/src/pages/PrismDodecahedron/*`

## Naming Convention

Use literal names so implementation is faster:

- `Sidebar / Expanded`
- `Footer Dock / Default`
- `Chat / Empty State`
- `Settings / Interface`
- `Modal / New Workspace`

Avoid abstract frame names like:
- `Concept A`
- `Version 3 maybe`
- `Dark option`

## Annotation Checklist

For each Figma frame, annotate only the things that matter for implementation:

- width
- height
- padding
- gap
- border radius
- font size
- font weight
- color
- state

You do not need to annotate every pixel if Auto Layout already makes the layout obvious.

## Export Checklist

When sending me a design to implement, send:

1. one PNG or screenshot per frame
2. the frame name
3. any non-obvious notes
   - "dock icons are 18px"
   - "this card should feel heavier"
   - "this text is intentionally tight"

## Best First Figma Frames

If you want the highest return for the least effort, mock these first:

1. `Shell / Sidebar Expanded`
2. `Chat / Active Conversation`
3. `Auth / Login`
4. `Settings / Interface`
5. `Modal / New Workspace`

That set gives us enough to define almost the whole visual language.
