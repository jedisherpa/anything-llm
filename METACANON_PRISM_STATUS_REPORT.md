# Metacanon Prism Status Report

Updated against:
- `/Users/paulcooper/Downloads/AnythingLLM UI Transformation Plan_ The Prism Integration.md`
- `/Users/paulcooper/Downloads/AnythingLLM Metacanon AI Edition_ Initial Skin Production Plan.md`

Date:
- March 12, 2026

## Executive Summary

There are now two distinct targets:

1. **Initial Skin Production Plan**
   - premium dark Metacanon skin
   - static Prism branding
   - no full WebGL integration required yet

2. **Full Prism Integration Plan**
   - cinematic dark mode
   - live WebGL Prism
   - state choreography across app surfaces
   - desktop-specific Prism behaviors

The current fork has meaningful groundwork, but it is not visually aligned with either document yet.

The most important reason is simple:
- the current UI direction is largely **linen / soft gold / black**
- both Prism plans target **dark charcoal / gold / teal / white**

That means some recent UI work is usable as structure, but not as final art direction.

## Current Completion Estimate

### Against the Initial Skin Production Plan

Estimated completion:
- **35% to 45%**

Why:
- branding and custom Metacanon surfaces exist
- Prism state presence exists
- shell customization has started
- but the core design system is still visually off-target
- chat, login, onboarding, settings, and modals do not yet look like the target skin

### Against the Full Prism Integration Plan

Estimated completion:
- **25% to 35%**

Why:
- there is real Prism prototype work already
- there is a real state machine
- there are working Three.js prototype routes
- but the live app does not yet use a real WebGL Prism across the core product surfaces
- the architecture is not yet the fully separated EventBus-driven system described in the plan
- the desktop shell is Tauri and still mostly conventional

## What Is Already Built

### 1. Metacanon Branding Is In The Fork

Built:
- custom product name
- custom wordmark
- custom MetacanonAI route
- custom UI lab route
- custom bottom-left dock entry

Key files:
- `frontend/src/LogoContext.jsx`
- `frontend/index.html`
- `frontend/src/pages/MetacanonAI/index.jsx`
- `frontend/src/pages/MetacanonAILab/index.jsx`
- `frontend/src/components/Footer/index.jsx`

Status:
- useful foundation
- not yet the final visual language from the plans

### 2. Prism State Logic Exists

Built:
- `idle`
- `hover`
- `thinking`
- `response`
- `error`

Key file:
- `frontend/src/PrismContext.jsx`

What this means:
- the app already has the behavioral backbone needed for Prism choreography
- this is one of the strongest parts of the current implementation

### 3. Prism Presence Exists In The Main App

Built:
- sidebar Prism presence
- login Prism presence
- chat Prism presence
- hover reactions across several surfaces
- error and response signaling from chat/session flow

Key files:
- `frontend/src/components/PrismPresence/index.jsx`
- `frontend/src/components/Sidebar/index.jsx`
- `frontend/src/components/Modals/Password/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`

Status:
- structurally useful
- visually still a lightweight CSS placeholder, not the target live Prism object

### 4. Real Prism 3D Prototype Work Already Exists

Built:
- Three.js Prism hero route
- Dodecahedron geometry
- physical material
- half-float render target
- bloom composer
- Prism tuning/prototype lab

Key files:
- `frontend/src/pages/PrismHero/index.jsx`
- `frontend/src/pages/PrismHero/createPrismHeroScene.js`
- `frontend/src/pages/PrismDodecahedron/index.jsx`

Status:
- much stronger than a mock
- still isolated prototype work, not yet integrated into the live app shell

## Where The Current Fork Diverges From The Plans

### 1. Global Visual Direction Is Wrong For The Target

Plans require:
- dark charcoal backgrounds
- gold accents
- teal thinking states
- white or near-white text
- Inter typography

Current fork:
- defaults to light linen surfaces
- uses soft gold accents
- uses black text
- still uses Plus Jakarta Sans globally

Key files:
- `frontend/src/index.css`
- `frontend/src/hooks/useTheme.js`

This is the biggest mismatch in the entire project.

## Detailed Gap Assessment

### A. Design System

Target:
- dark premium system
- Inter
- strict gold/teal/red accent roles
- unified spacing, shadows, radii

Current state:
- custom theme system exists
- Prism colors exist
- but the active skin is pointed in the wrong direction

Completion:
- **25%**

### B. Static Metacanon Skin

Target:
- static premium dark skin without full WebGL dependency
- static Prism branding assets
- dark shell, dark cards, gold focus states

Current state:
- branding exists
- custom footer item exists
- UI lab exists
- but shell, chat, auth, and settings are not yet rebuilt into the target skin

Completion:
- **40%**

### C. Prism Runtime Architecture

Target:
- React and Prism renderer separated
- EventBus communication
- surface-level state choreography
- device tiering

Current state:
- Prism context and event signaling exist
- chat lifecycle hooks already emit states
- but the current main Prism surface is still CSS-based
- there is not yet a full app-wide renderer manager connected to the main UI

Completion:
- **35%**

### D. Landing / Hero

Target:
- full-bleed cinematic hero
- starfield
- dolly zoom
- premium copy layout

Current state:
- strong isolated prototype route exists
- technical ingredients are already in place

Completion:
- **70%**

Important note:
- this is a prototype route, not the main product shell

### E. Login

Target:
- split screen
- Prism on the left
- form on the right
- gold focus treatment
- cinematic transition on success

Current state:
- Prism is present
- branded logo is present
- but layout is still a centered auth modal/page

Completion:
- **20%**

### F. Onboarding

Target:
- guided Prism-adjacent onboarding flow
- modal-centered choreography
- provider and embedding interactions tied to Prism

Current state:
- onboarding exists structurally
- there is no real Prism-guided experience yet

Completion:
- **15%**

### G. Sidebar / Dashboard Shell

Target:
- dark premium shell
- Prism replacing logo presence
- subtle reactive behaviors
- strong card treatment

Current state:
- custom header layout exists
- Prism exists in the sidebar
- footer dock and Metacanon entry exist
- but the style is still not the target dark cinematic system

Completion:
- **45%**

### H. Chat Interface

Target:
- top-right Prism
- choreographed send / thinking / response / error motions
- premium dark conversation surface
- static or live Prism avatar alignment

Current state:
- real state triggers exist
- Prism is present in the chat UI
- but visual treatment is still mostly standard AnythingLLM plus overlays

Completion:
- **35%**

### I. Settings Surfaces

Target:
- unified premium dark form system
- gold focus states
- restrained Prism feedback

Current state:
- shell and hover wiring exist
- save/apply coverage exists
- but the settings pages are still visually close to the stock product structure

Completion:
- **30%**

### J. Modals

Target:
- consistent premium modal system
- dark cards
- unified buttons
- strong spacing hierarchy

Current state:
- hover support exists
- but the actual modal art direction is not yet rebuilt

Completion:
- **25%**

### K. Desktop Shell

Target:
- custom desktop chrome
- tray integration
- Prism status in shell
- renderer throttling behavior

Current state:
- Tauri wrapper is functional
- desktop storage isolation is fixed
- Prism-specific desktop shell experience is still minimal

Completion:
- **15%**

Important note:
- both new plans assume Electron in parts
- our fork is Tauri
- that is not a blocker, but it means the desktop implementation must be translated rather than copied directly

## Strongest Existing Assets To Reuse

These are the best parts of the current fork to build on:

1. `frontend/src/PrismContext.jsx`
   - state model and event wiring

2. `frontend/src/pages/PrismHero/createPrismHeroScene.js`
   - strongest technical Prism rendering asset already in the repo

3. `frontend/src/pages/PrismDodecahedron/index.jsx`
   - tuning and look-dev surface

4. `frontend/src/pages/MetacanonAILab/index.jsx`
   - implementation and comparison surface for visual iteration

5. `frontend/src/components/Footer/index.jsx`
   - proof that custom Metacanon-specific controls can live in the product shell

## Biggest Risks

### 1. Theme Drift

Right now the fork mixes:
- original AnythingLLM structure
- linen Metacanon skin decisions
- dark Prism prototype ideas

If we do not pick one design target now, the app will continue to fragment visually.

### 2. Building The 3D Layer Too Early

The plans are clear that the main chat experience must not degrade.

If we rush the live WebGL integration before the shell and dark skin are locked:
- performance risk goes up
- UI consistency goes down
- iteration slows down

### 3. Desktop Assumption Mismatch

The planning docs mention Electron-specific patterns.
We are using Tauri.

This is manageable, but it must be treated as an implementation translation task.

## Recommended Interpretation Of The Two Plans

The clean way to read them is:

### Plan 1: Initial Skin

This should be the next real target.

Meaning:
- dark theme first
- static or lightweight Prism presentation first
- shell, chat, login, onboarding, settings first
- do not block progress on full WebGL rollout

### Plan 2: Full Prism Integration

This should come after the dark skin is coherent.

Meaning:
- reuse the existing Three.js hero work
- promote Prism into the live app gradually
- start with one or two surfaces, not the whole app at once

## Fastest Path To Match The Plans Better

If we want visible progress fast, the best sequence is:

1. Replace the current linen default with the dark Prism token system
2. Swap global typography to Inter
3. Rebuild sidebar and footer dock into the dark target
4. Rebuild chat and composer into the dark target
5. Rebuild login into the split-screen dark target
6. Rebuild onboarding to match
7. Standardize settings and modal surfaces
8. Only then start moving the live WebGL Prism into the main app surfaces

## Bottom Line

If the target is:

### The Initial Skin Production Plan

We are **partly set up, but not close visually**.

Best summary:
- **35% to 45% complete**

### The Full Prism Integration Plan

We have **good technical seeds, but the main product does not yet feel like the plan**.

Best summary:
- **25% to 35% complete**

The encouraging part is that the hardest unknowns are no longer unknown:
- Prism state model exists
- Prism rendering prototype exists
- branded shell customization exists
- desktop wrapper exists

What is still missing is mostly:
- visual unification
- the dark cinematic design system
- live integration across core surfaces
