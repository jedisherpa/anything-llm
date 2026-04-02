# Agent Prompt: Fix Prism Chat Attachments, Paste Handling, and Current Context

## Objective

Repair the Prism chat attachment pipeline so plus-button uploads, drag/drop, empty-state uploads, and clipboard paste all feed the same reliable attachment path, while ensuring the model understands explicit thread attachments before broader retrieval.

## Context

PrismAI had multiple chat attachment regressions:

- the composer plus-button flow was unreliable
- drag/drop overlay behavior could get stuck
- paste handling differed between browser and desktop webview clipboard shapes
- duplicate attachments could appear from clipboard events
- users could ask “what files can you see?” and receive answers dominated by broader workspace retrieval instead of explicitly attached thread documents

The fix must unify these entry points and make explicit attachments first-class in model context.

## Source files to inspect first

- `frontend/src/components/WorkspaceChat/ChatContainer/DnDWrapper/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- any attachment manager / attach-item components in the same area
- `server/utils/chats/apiChatHandler.js`
- `server/utils/chats/contextManifest.js`
- any parsed-file model helpers used for current context

## Your task

Implement or restore the following behavior:

1. Add a shared event or entry path for opening the attachment picker.
2. Route plus-button uploads, empty-state uploads, and any similar affordances through the same picker/pipeline.
3. Unify drop and paste handling through shared attachment queue logic.
4. Accept clipboard files from both:
   - `clipboardData.items`
   - `clipboardData.files`
5. Deduplicate clipboard files before they enter the queue.
6. Allow image attachments to succeed even while document parsing services are still warming up.
7. Build an explicit attached-document manifest on the backend and place it into current chat context before broader workspace retrieval content.
8. Ensure attached parsed files contribute both file identity and usable content/source excerpts when available.

## Required implementation details

- Introduce or preserve a shared attachment-open event similar to `OPEN_ATTACHMENT_PICKER_EVENT`.
- Create a shared queue/preparation function instead of duplicating separate logic in paste and drop handlers.
- Distinguish:
  - image attachments that can attach immediately
  - non-image uploads that need parsing
- Use a deterministic file fingerprint for dedupe.
- Add or restore a backend helper that builds a plain-language list of explicitly attached documents and injects it into the prompt context ahead of general retrieval results.

## Constraints

- Do not create separate parallel upload code paths for plus-button, paste, and drag/drop.
- Do not break plain text paste into the composer.
- Do not let explicit thread attachments become invisible behind general workspace retrieval in model-visible context.

## Acceptance criteria

- File picker opens from the composer plus button and any empty-state upload affordance.
- Drag/drop clears properly after cancel, reject, or drop completion.
- Pasting images creates image attachments.
- Pasting non-image files sends them through the parse/upload flow.
- Mixed paste preserves text insertion and adds file/image attachments.
- Duplicate clipboard attachments do not appear from dual `items` and `files` exposure.
- Asking “what files can you see?” prioritizes explicitly attached current-context files.

## Recommended validation

Run manual checks for:

- plus-button image upload
- plus-button non-image upload
- drag/drop cancel, reject, and success
- image paste
- file paste
- mixed text-plus-file or text-plus-image paste
- current context vs model answer for attached files

## Deliverable

Produce:

- the code changes
- a concise description of the unified attachment pipeline
- the dedupe strategy used
- the backend context-manifest behavior
- any edge cases that still need manual QA
