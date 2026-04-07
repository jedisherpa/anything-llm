# Slash Command Integration Design

**Phase:** 2.0 (Prep Work)
**Status:** Design Document
**Version:** 1.0
**Date:** 2026-04-03

## Overview

This document maps the Rust prototype's slash command registry concepts (defined in `umbrella-runtime/src/runtime_prototypes/slash_commands.rs`) to the Node.js/AnythingLLM context and outlines the integration approach for PrismAI v2.0.

The actual integration implementation is deferred to Phase 3 or v2.1. This document serves as a specification and bridge between the prototype system and the production UI layer.

---

## Prototype Specification Summary

The Rust prototype defines a slash command system with the following architecture:

### Categories
- **Core**: Basic REPL operations (status, compact)
- **Runtime**: Model and permission management (model, permissions)
- **Session**: Session inspection and reset (session)
- **Workflow**: Workflow state inspection (workflow)

### Commands
| Command | Arguments | Category | Summary |
|---------|-----------|----------|---------|
| `/status` | None | Core | Show current prototype REPL status |
| `/compact` | None | Core | Compact the prototype transcript |
| `/model` | `[model]` | Runtime | Show or switch the active model |
| `/permissions` | `[mode]` | Runtime | Show or switch the permission mode |
| `/session` | `[show\|reset]` | Session | Inspect the current prototype session |
| `/workflow` | `[show\|compact] [id]` | Workflow | Inspect workflow prototype state |

### Implementation Features
- **Registry Pattern**: Commands are defined as specs with metadata (name, summary, argument_hint, category)
- **Parsing**: Input validation and command parsing with optional arguments
- **Suggestions**: Levenshtein distance-based command suggestions for autocomplete
- **Help Rendering**: Grouped help text organized by category

---

## Mapping to AnythingLLM / PrismAI v2.0

### Conceptual Alignment

The prototype's slash command system maps to PrismAI chat interface features:

| Prototype Concept | PrismAI v2.0 Equivalent | Implementation Context |
|-------------------|------------------------|----------------------|
| `PrototypeSlashRegistry` | Chat interface command dispatcher | Express middleware or WebSocket handler |
| `PrototypeSlashCommand` enum | Parsed command object | Request object with action/payload |
| Category grouping | UI command palette organization | Frontend UI component state |
| Levenshtein suggestions | Autocomplete recommendations | Real-time chat input suggestions |
| Help rendering | `/help` command or hover tooltips | Chat message formatting |

### Scope Reduction for v2.0

The prototype defines 6 commands across 4 categories. For v2.0 integration, the scope is reduced to focus on **deliberation and sphere coordination**:

#### Core Commands (Available v2.0)
- `/status` → Display sphere, agent, and runtime status
- `/deliberate` → **NEW** Create and manage deliberation spheres (PrismAI-specific)

#### Runtime Commands (Deferred to v2.1)
- `/model` → Full model selection (integrated in v2.1+)
- `/permissions` → Permission mode switching (integrated in v2.1+)

#### Session & Workflow (Deferred)
- `/session` → Session management (v2.1+)
- `/workflow` → Workflow inspection (v2.1+)

---

## PrismAI v2.0 Slash Commands

For Phase 2, we define a focused set of slash commands aligned with deliberation operations:

### Specification

```
SlashCommandRegistry (PrismAI v2.0)
├── Core
│   ├── /status           Show runtime, sphere, and agent status
│   └── /help             Display available commands
├── Sphere & Deliberation
│   ├── /sphere           Manage deliberation spheres (create, list, dissolve)
│   ├── /deliberate       Quick deliberation on a topic with agents
│   └── /agents           List and bind agents to spheres
└── HITL & Actions
    └── /approve          Approve or reject pending HITL actions
```

### Command Details

#### `/status`
- **Category**: Core
- **Arguments**: None
- **Purpose**: Display current runtime status, active spheres, and bound agents
- **Response**: JSON or formatted text with:
  - Runtime availability
  - Number of active spheres
  - Bound agents per sphere
  - Pending HITL actions count

#### `/help`
- **Category**: Core
- **Arguments**: `[command]` (optional)
- **Purpose**: Display available commands or detail for a specific command
- **Response**: Grouped command list or detailed command usage

#### `/sphere`
- **Category**: Sphere & Deliberation
- **Arguments**: `[action] [args...]`
  - `create <topic>` – Create new deliberation sphere
  - `list` – List active spheres
  - `dissolve <sphere-id> [reason]` – End a sphere
  - `pause <sphere-id>` – Pause a sphere
- **Purpose**: Manage deliberation sphere lifecycle

#### `/deliberate`
- **Category**: Sphere & Deliberation
- **Arguments**: `[topic] [--agents agent1,agent2]`
- **Purpose**: Quickly create a sphere and submit a deliberation query
- **Example**: `/deliberate "API design patterns" --agents agent-architect,agent-engineer`
- **Response**: Sphere ID and initial query result

#### `/agents`
- **Category**: Sphere & Deliberation
- **Arguments**: `[action]`
  - `list` – List all available agents
  - `bind <sphere-id> <agent-id>` – Bind agent to sphere
  - `info <agent-id>` – Show agent details
- **Purpose**: Manage agent binding to spheres

#### `/approve`
- **Category**: HITL & Actions
- **Arguments**: `<sphere-id> <action-id> [--reject] [reason]`
- **Purpose**: Approve or reject pending HITL actions
- **Examples**:
  - `/approve sphere-1 action-5` – Approve
  - `/approve sphere-1 action-5 --reject "Needs revision"` – Reject

---

## Integration Architecture

### Phase 2.0: UI Routing Layer (This Document)

The Node.js/AnythingLLM side defines:
1. **Command Router** – Maps slash commands to handler functions
2. **Command Specs** – Metadata (name, summary, args, category) matching prototype pattern
3. **Handler Implementation** – Wraps sphere-thread.js operations

### Phase 2.5–3.0: Chat Interface Integration

In later phases, the chat UI will:
1. Detect slash commands in user input (e.g., input starts with `/`)
2. Parse and validate against the command registry
3. Render autocomplete suggestions (Levenshtein-based, like prototype)
4. Route to appropriate handler
5. Format and display results in chat

### Phase 3.0: Full Prototype Alignment (Future)

When resources permit:
1. Migrate all 6 prototype commands to Node.js equivalents
2. Full help rendering and categorization UI
3. Real-time command suggestions
4. Integration with prototype REPL concepts (session, workflow)

---

## Implementation Checklist (v2.0)

- [ ] Create command handler registry at `/anything-llm/server/api/v1/commands/`
  - [ ] `sphere-commands.js` – Sphere/deliberation operations
  - [ ] `hitl-commands.js` – HITL action routing
  - [ ] `utils/command-registry.js` – Command metadata and dispatch

- [ ] Wire into chat input processing
  - [ ] Detect and parse `/` prefix in user message
  - [ ] Validate command against registry
  - [ ] Call appropriate handler
  - [ ] Format result for chat display

- [ ] Add to API routes (v2.0 endpoint: `/api/v1/chat/command`)
  - [ ] POST handler for slash commands
  - [ ] Response with command result

- [ ] Frontend integration (Phase 2.5+)
  - [ ] Input autocomplete detection
  - [ ] Suggestion dropdown rendering
  - [ ] Send command to `/api/v1/chat/command` endpoint

---

## Dependency Graph

```
PrismAI Chat Interface
  ├── /api/v1/chat/command (Router)
  │   ├── SphereCommands
  │   │   └── sphere-thread.js (SphereThreadCoordinator)
  │   │       └── client.js (MetaCanon FFI Bridge)
  │   ├── HitlCommands
  │   │   └── sphere-thread.js
  │   └── CommandRegistry (metadata & dispatch)
  └── Frontend Autocomplete
      └── CommandRegistry (specs for suggestions)
```

---

## Deferred Features

These are explicitly **NOT** in scope for v2.0 but are part of the full prototype spec:

1. **Full Prototype Commands** – `/model`, `/permissions`, `/session`, `/workflow`
   - Requires deeper integration with runtime state management
   - Deferred to v2.1 or Phase 3

2. **Advanced Help Rendering**
   - Grouped help with formatted tables
   - Per-category help (like Rust prototype's `render_help()`)
   - Deferred; v2.0 uses simple `/help` output

3. **Workflow Inspection**
   - Viewing and compacting workflow state
   - Requires workflow engine integration beyond sphere operations
   - Deferred to Phase 3

4. **Session Management**
   - Session reset, archive, inspect operations
   - Requires session state tracking
   - Deferred to v2.1+

---

## Testing & Validation

### Unit Tests (v2.0 Target)
- [ ] Command parsing with valid and invalid inputs
- [ ] Autocomplete suggestion ranking (Levenshtein distance)
- [ ] Handler invocation with correct sphere-thread calls
- [ ] Error handling for unavailable runtime

### Integration Tests (Phase 2.5+)
- [ ] End-to-end chat command flow
- [ ] Sphere creation and agent binding via `/deliberate`
- [ ] HITL action approval via `/approve`
- [ ] Graceful degradation when runtime unavailable

### User Acceptance Tests (Phase 3+)
- [ ] Autocomplete UX feels responsive
- [ ] Help text is clear and discoverable
- [ ] Error messages guide user to correct syntax

---

## Example Workflows

### Workflow 1: Quick Deliberation

```
User: /deliberate "Should we use microservices?" --agents architect,engineer
System:
  - Creates sphere "Should we use microservices?"
  - Binds architect and engineer agents
  - Submits initial query
  - Returns: Sphere ID and deliberation result
User: (sphere active, can now submit follow-up queries or approve HITL actions)
```

### Workflow 2: HITL Action Approval

```
User: /status
System: [Lists pending actions]
  - Sphere sphere-1: Action "deploy-api" pending approval
User: /approve sphere-1 deploy-api
System: Action approved. Sphere continues execution.
```

### Workflow 3: Check Status & Agents

```
User: /status
System:
  - Runtime: AVAILABLE
  - Active Spheres: 2
    - "API Design": 3 agents, 1 pending action
    - "Database Migration": 2 agents, 0 pending actions
User: /agents list
System: [Lists all available agents and their current bindings]
```

---

## References

- **Prototype Source**: `umbrella-runtime/src/runtime_prototypes/slash_commands.rs`
- **Sphere Thread Module**: `anything-llm/server/utils/metacanon-runtime/sphere-thread.js`
- **FFI Bridge**: `anything-llm/server/utils/metacanon-runtime/client.js`
- **Phase 2 Plan**: PrismAI v2.0 Integration Plan, Steps 6 & 6.5

---

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-04-03 | 1.0 | (Phase 2 Impl) | Initial design document; v2.0 scope definition |

---

## Approvals & Sign-Off

- [ ] Architecture Review
- [ ] Product Owner Sign-Off
- [ ] Engineering Lead Review

*(Deferred to Phase 2 closure)*
