# PrismAI UI Figma Handoff Report

## Purpose

This document is a design-system and layout handoff for the current PrismAI frontend. It is written for rebuilding or extending the UI in Figma without needing to reverse-engineer the codebase from scratch.

The report focuses on:

- the global theming system
- typography and font usage
- shell and page layout
- sidebar, settings, chat, onboarding, modal, and table patterns
- sizing, radius, spacing, and effect conventions
- which files are the actual source of truth for appearance

This is not a full React behavior map. It is the visual and structural map needed to design the product accurately.

---

## 1. Frontend Visual Architecture

The PrismAI UI is not driven by a single design-system package. It is a layered system made of:

1. Tailwind utility classes for local layout and spacing in JSX
2. global CSS custom properties for theme tokens
3. Prism/Metacanon surface classes for branded appearance
4. route- and component-level CSS classes for specific page families

The main visual layers are:

- `frontend/src/index.css`
  - base tokens
  - font registration
  - Metacanon/Prism shell classes
  - composer, sidebar, footer, model picker, home-stage styling
- `frontend/src/styles/prism-app-treatment.css`
  - branded page surfaces
  - settings layouts
  - sidebar modules/cards
  - tables
  - onboarding shell styling
  - theme-specific overrides for major Prism surfaces
- `frontend/src/styles/theme-dark.css`
- `frontend/src/styles/theme-light.css`
- `frontend/src/styles/theme-cathedral.css`
  - sanctuary-mode token sets for Prism-specific shell styling
- `frontend/src/ThemeContext.jsx`
- `frontend/src/hooks/useTheme.js`
  - runtime theme selection and `data-theme` application

The top-level app shell is applied in:

- `frontend/src/App.jsx`

The current implementation relies heavily on CSS variables, gradients, blur, and mixed transparent surfaces rather than flat colors alone.

---

## 2. Theme System

### 2.1 Theme names

The active user-facing themes are:

- `dark`
- `light`
- `cathedral`

Theme switching is handled in:

- `frontend/src/hooks/useTheme.js`
- `frontend/src/components/Metacanon/ThemeSwitcher.jsx`

`useTheme()` writes the theme to `localStorage`, applies `data-theme` on `document.documentElement`, and toggles a `light` class on `body` only for the light theme.

### 2.2 Two token families

There are effectively two overlapping token systems:

#### A. AnythingLLM-style `--theme-*` app tokens

Defined primarily in:

- `frontend/src/index.css`

Examples:

- `--theme-bg-primary`
- `--theme-bg-sidebar`
- `--theme-text-primary`
- `--theme-text-secondary`
- `--theme-sidebar-border`
- `--theme-settings-input-bg`
- `--theme-button-primary`

These feed most of the product UI, settings forms, tables, inputs, attachments, and common surfaces.

#### B. Prism shell tokens

Defined in:

- `frontend/src/styles/theme-dark.css`
- `frontend/src/styles/theme-light.css`
- `frontend/src/styles/theme-cathedral.css`

Examples:

- `--bg`
- `--sidebar-bg`
- `--sidebar-bg-end`
- `--sidebar-glow-color`
- `--subtle-border`
- `--text-1`
- `--text-2`
- `--gold`
- `--gold-bg`
- `--gold-border`
- `--comp-bg`
- `--comp-border`
- `--display-font`
- `--display-weight`

These control the branded Prism layer: shell backgrounds, ambient gradients, sidebar cards, theme switcher, composer chrome, ornamental glow, and brand-specific text treatments.

### 2.3 Theme personalities

#### Dark

Defined in:

- `frontend/src/styles/theme-dark.css`

Intent:

- “The Forge”
- black-charcoal base
- muted gold highlights
- low-opacity borders
- restrained glow

Key traits:

- background near `#0d0d0f`
- sidebars use dark brown-black gradients
- gold is present but controlled
- display font weight is thin/light

#### Light

Defined in:

- `frontend/src/styles/theme-light.css`

Intent:

- “The Atelier”
- warm ivory and parchment
- softened gold accents
- less blur, softer shadowing

Key traits:

- background near `#fafaf7`
- sidebars are cream/beige
- dark text on warm surfaces
- gold becomes ochre rather than metallic glow

#### Cathedral

Defined in:

- `frontend/src/styles/theme-cathedral.css`

Intent:

- “The Sanctuary”
- dark liturgical palette
- gold plus teal secondary spectral glow
- slightly more mystical than dark mode

Key traits:

- deep navy-black background
- gold and teal both appear in gradients
- status label becomes `SANCTUARY`
- stronger backform effects and sacred geometry feel

### 2.4 Figma recommendation

In Figma, build:

1. a semantic token set for `--theme-*`
2. a second Prism shell token set for `--bg`, `--text-1`, `--gold`, `--comp-border`, etc.
3. theme modes:
   - Dark
   - Light
   - Cathedral

Do not build only raw hex tokens. Build semantic tokens first, because the code is semantic-variable driven.

---

## 3. Typography

### 3.1 Primary body font

Registered in:

- `frontend/src/index.css`

The primary app font is:

- `plus-jakarta-sans`

Loaded from:

- `frontend/public/fonts/PlusJakartaSans.ttf`

The body stack is:

- `"plus-jakarta-sans", -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, ...`

Use this in Figma as the default UI/body font.

### 3.2 Display font

Theme token:

- `--display-font`

All three Prism themes currently use:

- `"Cormorant Garamond", serif`

This is used for:

- hero text
- home-stage titles
- manifesto / inscription copy
- some lens card titles
- some placeholder / mystical copy treatments

### 3.3 Typography roles

From the code, the UI tends to use these practical categories:

- micro label: `10px` to `11px`
- section label / eyebrow: `11px` to `11.5px`, uppercase, heavy tracking
- secondary body: `11px` to `13px`
- standard body: `14px` to `15px`
- block title: around `1.05rem`
- page hero: `clamp()` or `2rem+` sizes depending on route

Common typography patterns:

- uppercase metadata labels with `0.14em` to `0.18em` tracking
- body copy line-height around `1.45` to `1.6`
- large display text in `Cormorant Garamond`
- practical UI labels in Plus Jakarta Sans

### 3.4 Figma recommendation

Define text styles like:

- `UI / Label / Micro / 10`
- `UI / Label / Section / 11 Upper`
- `UI / Body / Small / 11`
- `UI / Body / Regular / 14`
- `UI / Body / Medium / 15`
- `UI / Title / Block / 17`
- `Display / Hero / Prism`
- `Display / Manifesto / Small Italic`

---

## 4. Layout System

### 4.1 Global shell

Top-level shell:

- `frontend/src/App.jsx`
- `frontend/src/styles/prism-app-treatment.css`

Key classes:

- `.prism-app-shell`
- `.prism-app-ambient`
- `.prism-app-grid`
- `.prism-app-content`

The app shell is built from:

- a base background
- two fixed ambient radial-gradient layers
- a fixed subtle grid overlay
- a content layer above them

This means Figma should treat the product as:

1. base color field
2. large soft radial glow fields
3. a very low-opacity grid
4. content surfaces floating above

### 4.2 Main page shell

Key classes:

- `.metacanon-page-shell`
- `.workspace-prism-shell`
- `.metacanon-page-frame`
- `.workspace-prism-frame`

Used for:

- workspace chat
- settings routes
- auth/onboarding shells

Pattern:

- transparent interior frame
- decorative background applied on the shell
- content surfaces come from nested panels/cards rather than one big card

### 4.3 Desktop widths

Known major fixed or semi-fixed widths from source:

- standard workspace/settings sidebar: `344px`
- minimum sidebar inner width often around `304px` or `250px`
- model picker panel: `620px`
- provider settings trigger/menu max width: `760px`
- manage workspace modal max width: `1240px`
- large modal family usually `max-w-md`, `max-w-lg`, `max-w-2xl`, or custom max widths

### 4.4 Figma recommendation

Use these primary desktop frames:

- App shell width: standard desktop frame
- Left sidebar: `344`
- Main content: fluid remainder
- Settings content max width: around `1120`
- Large system modal max width: `1240`

---

## 5. Spacing, Radius, and Effects

### 5.1 Radius language

This UI uses a very consistent rounded system:

- `10px`
- `12px`
- `14px`
- `16px`
- `18px`
- `20px`
- `22px`
- `24px`
- `28px`
- `999px` for pills / circular controls

Typical usage:

- search and compact buttons: `14px`
- sidebar cards: `16px`
- stats: `18px`
- page cards: `20px`
- panels: `22px`
- heroes and composer shell: `24px`
- large special modal cards: `28px`
- tabs/chips/toggles: pill radius

### 5.2 Spacing cadence

The code repeatedly uses:

- `4`
- `6`
- `8`
- `10`
- `12`
- `14`
- `16`
- `18`
- `20`
- `22`
- `24`
- `28`

This is not a strict 8pt system. It is an 8pt system with deliberate 10/14/22 adjustments.

Use these in Figma as the real spacing cadence rather than forcing pure 8pt.

### 5.3 Shadows and blur

Common effects:

- soft inset top highlight
- low-opacity exterior elevation shadows
- glass-like blur on overlays, popovers, and search/result panels
- almost no aggressive neumorphism

Common shadow behavior:

- sidebar cards: modest shadow
- page cards/panels: modest shadow
- modals and popovers: deeper shadow plus blur
- some newer surfaces intentionally flattened to avoid “card overload”

Blur usage:

- modal backdrops
- modal panels
- search result overlays
- model picker panel
- some footer trays

### 5.4 Border language

Borders are rarely opaque. They are usually:

- low-opacity gold-mixed borders
- theme-border variables mixed with transparency
- hairline dividers using gradient lines

---

## 6. Major Surface Families

### 6.1 Sidebar

Primary files:

- `frontend/src/components/Sidebar/index.jsx`
- `frontend/src/components/Sidebar/SearchBox/index.jsx`
- `frontend/src/index.css`
- `frontend/src/styles/prism-app-treatment.css`

Visual structure:

1. brand block
2. sticky search rail
3. new workspace button
4. workspace list
5. featured councils / constellations / lenses
6. bottom footer tray

Key classes:

- `.metacanon-sidebar-panel`
- `.metacanon-sidebar-search-rail`
- `.metacanon-sidebar-search`
- `.metacanon-workspace-row`
- `.metacanon-thread-row`
- `.prism-sidebar-module`
- `.prism-sidebar-card`
- `.prism-sidebar-chip`
- `.metacanon-sidebar-footer-tray`

Important design notes:

- the sidebar is gradient-backed, not flat
- the search rail is sticky with its own blurred background and divider
- featured items use editorial card styling, not list rows
- footer dock buttons are circular medallions

### 6.2 Settings sidebar and settings pages

Primary files:

- `frontend/src/components/SettingsSidebar/index.jsx`
- `frontend/src/styles/prism-app-treatment.css`

Key classes:

- `.prism-settings-sidebar-shell`
- `.prism-settings-sidebar-brand`
- `.prism-settings-sidebar-divider`
- `.prism-settings-topbar`
- `.prism-settings-tab`
- `.prism-settings-content`
- `.prism-settings-field`
- `.prism-settings-choice`
- `.prism-settings-provider-*`

Important layout facts:

- settings sidebar uses the same `344px` width language as chat sidebar
- settings controls rely heavily on pills, grouped provider cards, and roomy fields
- provider selection is a large custom trigger + dropdown system, not a plain select

### 6.3 Workspace chat

Primary files:

- `frontend/src/pages/WorkspaceChat/index.jsx`
- `frontend/src/components/WorkspaceChat/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx`
- `frontend/src/index.css`

Key visual areas:

1. left navigation sidebar
2. central chat history
3. composer rail at bottom
4. optional source sidebar / overlays
5. model picker and execution/chat mode controls near composer

Important visual classes:

- `.metacanon-composer-shell`
- `.metacanon-composer-shell--workspace`
- `.metacanon-composer-input-shell--workspace`
- `.metacanon-chat-mode-shell`
- `.metacanon-chat-mode-toggle__button`
- `.metacanon-model-picker-button`
- `.metacanon-model-picker-panel`
- `.metacanon-user-bubble`
- `.metacanon-assistant-message`
- `.metacanon-status-thought`

Key design notes:

- the composer is intentionally flatter than many earlier card-based versions
- placeholders use the display font and italic styling for brand voice
- message chrome is subtle; the composer and controls carry more of the Prism identity

### 6.4 Onboarding

Primary files:

- `frontend/src/pages/OnboardingFlow/Steps/Home/index.jsx`
- `frontend/src/styles/prism-app-treatment.css`

The onboarding home is a branded composition made from:

- ambient left and right glyph zones
- PrismPresence orbs
- central logo stage
- two primary CTAs
- strong symmetry and atmospheric geometry

It is less like a settings page and more like a branded poster/hero surface.

### 6.5 Modals

Primary files:

- `frontend/src/components/ModalWrapper/index.jsx`
- `frontend/src/index.css`
- `frontend/src/styles/prism-app-treatment.css`
- `frontend/src/components/Modals/ManageWorkspace/index.jsx`

Key classes:

- `.metacanon-modal-backdrop`
- `.metacanon-modal-panel`
- `.prism-settings-modal-card`
- `.prism-settings-modal-qr`

Modal visual pattern:

- dark blurred backdrop
- rounded, gradient-backed panel
- subtle inset highlight
- stronger shadow than standard cards
- large interior padding

### 6.6 Tables and admin/data surfaces

Primary file:

- `frontend/src/styles/prism-app-treatment.css`

Key class:

- `.prism-data-table`

Pattern:

- rounded table wrapper
- gradient header
- hover-highlighted body rows
- themed border dividers

---

## 7. Component-Level Design Inventory

This section maps the main visual units to code.

### Brand and theme controls

- brand block: `frontend/src/components/Metacanon/Branding`
- theme switcher: `frontend/src/components/Metacanon/ThemeSwitcher.jsx`
- theme behavior: `frontend/src/hooks/useTheme.js`

### Sidebar system

- desktop sidebar: `frontend/src/components/Sidebar/index.jsx`
- search/new workspace: `frontend/src/components/Sidebar/SearchBox/index.jsx`
- active workspaces: `frontend/src/components/Sidebar/ActiveWorkspaces/index.jsx`
- threads: `frontend/src/components/Sidebar/ActiveWorkspaces/ThreadContainer/ThreadItem/index.jsx`
- featured councils: `frontend/src/components/Sidebar/FeaturedCouncils/index.jsx`
- featured lenses: `frontend/src/components/Sidebar/FeaturedLenses/index.jsx`
- pinned constellations: `frontend/src/components/Sidebar/PinnedConstellations/index.jsx`

### Chat surface

- route shell: `frontend/src/pages/WorkspaceChat/index.jsx`
- workspace chat wrapper: `frontend/src/components/WorkspaceChat/index.jsx`
- chat container: `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- prompt input: `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx`
- tools menu: `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/index.jsx`
- model picker: `frontend/src/components/WorkspaceChat/ChatContainer/WorkspaceModelPicker/index.jsx`
- source sidebar: `frontend/src/components/WorkspaceChat/ChatContainer/SourcesSidebar/index.jsx`

### Settings

- settings sidebar: `frontend/src/components/SettingsSidebar/index.jsx`
- general settings pages: `frontend/src/pages/GeneralSettings/*`
- AI provider / LLM preference page styling often relies on:
  - `.prism-settings-provider-*`
  - `.prism-settings-field*`
  - `.prism-settings-choice*`

### Onboarding

- route shell: `frontend/src/pages/OnboardingFlow/index.jsx`
- home step: `frontend/src/pages/OnboardingFlow/Steps/Home/index.jsx`
- LLM selection: `frontend/src/pages/OnboardingFlow/Steps/LLMPreference/index.jsx`

### Modals

- shared modal portal: `frontend/src/components/ModalWrapper/index.jsx`
- manage workspace: `frontend/src/components/Modals/ManageWorkspace/index.jsx`
- new workspace: `frontend/src/components/Modals/NewWorkspace.jsx`

### Experimental branded pages

- Prism hero: `frontend/src/pages/PrismHero/index.css`
- Prism dodecahedron: `frontend/src/pages/PrismDodecahedron/index.css`

These are more standalone art-direction surfaces than core application UI, but they matter if you want the broader Prism visual vocabulary in Figma.

---

## 8. Practical Figma Token Extraction

If you are rebuilding the UI in Figma, create token groups like this.

### 8.1 Core color tokens

- `App / BG / Primary`
- `App / BG / Secondary`
- `App / BG / Sidebar`
- `App / BG / Chat`
- `App / Text / Primary`
- `App / Text / Secondary`
- `App / Border / Sidebar`
- `App / Border / Modal`
- `App / Button / Primary`
- `App / Input / BG`
- `App / Input / Text`

These map from `--theme-*`.

### 8.2 Prism shell tokens

- `Prism / BG`
- `Prism / Sidebar BG`
- `Prism / Gold`
- `Prism / Gold Border`
- `Prism / Gold BG`
- `Prism / Text 1`
- `Prism / Text 2`
- `Prism / Comp BG`
- `Prism / Comp Border`
- `Prism / Display Font`

These map from the sanctuary-mode CSS files.

### 8.3 Effects tokens

- `Effect / Blur / Modal`
- `Effect / Blur / Popover`
- `Effect / Shadow / Card`
- `Effect / Shadow / Modal`
- `Effect / Shadow / Sidebar Card`
- `Effect / Glow / Gold`
- `Effect / Grid / App`

### 8.4 Radius tokens

- `Radius / 14`
- `Radius / 16`
- `Radius / 20`
- `Radius / 22`
- `Radius / 24`
- `Radius / 28`
- `Radius / Pill`

### 8.5 Spacing tokens

- `Space / 4`
- `Space / 8`
- `Space / 10`
- `Space / 12`
- `Space / 14`
- `Space / 16`
- `Space / 18`
- `Space / 20`
- `Space / 24`
- `Space / 28`

---

## 9. Key Measurements Worth Mirroring in Figma

These are useful anchor values from the current code:

- desktop sidebar width: `344`
- settings sidebar width: `344`
- compact model picker max width: `148`
- regular model picker max width: `260`
- model picker dropdown width: `620`
- provider chooser max width: `760`
- large modal width: `1240`
- page hero radius: `24`
- panel radius: `22`
- card radius: `20`
- sidebar card radius: `16`
- search and compact action radius: `14`
- tab / chip radius: pill

---

## 10. What Actually Controls Appearance

If you only read a small set of files, read these first:

1. `frontend/src/index.css`
2. `frontend/src/styles/prism-app-treatment.css`
3. `frontend/src/styles/theme-dark.css`
4. `frontend/src/styles/theme-light.css`
5. `frontend/src/styles/theme-cathedral.css`
6. `frontend/src/hooks/useTheme.js`
7. `frontend/src/App.jsx`
8. `frontend/src/components/Sidebar/index.jsx`
9. `frontend/src/components/SettingsSidebar/index.jsx`
10. `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx`

Those files explain most of:

- color
- typography
- shell background
- spacing and radius language
- sidebar structure
- composer structure
- settings chrome
- theme switching

---

## 11. Figma Build Order Recommendation

If you are translating this app into Figma, do it in this order:

1. Build semantic token styles from `--theme-*`
2. Build Prism shell token styles from the three sanctuary theme files
3. Create typography styles
4. Create primitive components:
   - pill button
   - section label
   - sidebar search
   - sidebar card
   - chip
   - modal shell
   - composer shell
   - settings provider card
   - table shell
5. Create layout frames:
   - app shell
   - workspace shell
   - settings shell
   - onboarding shell
6. Apply theme modes:
   - dark
   - light
   - cathedral
7. Build page templates from those primitives

Do not start with individual pages. Start with tokens, then primitives, then layout shells, then pages.

---

## 12. Caveats

- A lot of spacing is still expressed inline via Tailwind classes in JSX, so the full system is split across CSS and component markup.
- The UI intentionally mixes transparent branded surfaces with flatter treatments; not everything should be turned into heavy cards.
- The light theme is warmer and softer than a conventional pure-white enterprise theme.
- Cathedral is not just “dark with blue.” It uses both gold and teal and needs its own mode in Figma.
- Some experimental surfaces like `PrismHero` and `PrismDodecahedron` have their own CSS vocabulary and should be treated as special pages rather than default app chrome.

---

## 13. Bottom Line

For Figma work, the most important mental model is:

- base application UI comes from `--theme-*`
- Prism identity comes from the sanctuary theme token layer
- most major screens are built from transparent or semi-transparent shell frames plus a smaller number of branded panels/cards
- the visual language depends on warm gold accents, controlled blur, strong radius consistency, and editorial typography contrast between Plus Jakarta Sans and Cormorant Garamond

If you mirror the token system first and then the shell/component families second, you can reproduce the product much more faithfully than by tracing page screenshots one by one.
