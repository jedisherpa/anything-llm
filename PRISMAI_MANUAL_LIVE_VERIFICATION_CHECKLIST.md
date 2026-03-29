# PrismAI Manual Live Verification Checklist

Use this checklist to manually verify the March 27-28 PrismAI rehab fixes in the live desktop app.

This checklist is intentionally human-driven. It assumes the desktop app is already running from either:

- `desktop-tauri` via `npm run tauri:dev`, or
- a freshly built packaged app

Record each item as:

- `[ ]` not tested
- `[x]` passed
- `[!]` failed

---

## Preflight

- [ ] PrismAI launches successfully.
- [ ] The local interface is responsive.
- [ ] You can reach a workspace with thread history, documents, councils, and constellations already available.
- [ ] If testing packaged builds, confirm you are testing the newly built artifact and not an older installed copy.

Notes:

- Preferred workspace for continuity tests: `Prism Preview`
- If a test needs a clean thread, create a new thread instead of reusing a working conversation.

---

## 1. Docker Model Runner Visibility

### Onboarding

- [ ] Open the onboarding provider selection flow.
- [ ] Confirm `Docker Model Runner` appears as a first-class provider option.
- [ ] Select it and confirm the provider-specific settings panel renders instead of a blank or generic panel.

### Workspace settings

- [ ] Open workspace chat settings.
- [ ] Confirm `Docker Model Runner` appears in the model/provider list.
- [ ] Select it and confirm the options panel renders correctly.

### Agent settings

- [ ] Open workspace agent settings.
- [ ] Confirm `Docker Model Runner` appears there as well.
- [ ] Select it and confirm the options panel renders correctly.

Expected result:

- `Docker Model Runner` is visible in all expected desktop-facing provider flows and its settings UI is usable.

---

## 2. Create Workspace Affordance

- [ ] Look at the left sidebar search rail.
- [ ] Confirm the `New Workspace` affordance is clearly visible for a creator-capable user.
- [ ] Click it.
- [ ] Confirm the existing new-workspace modal opens.
- [ ] Create a disposable workspace or cancel out cleanly.

Expected result:

- The button is visible, looks intentional, and opens the existing creation flow.

---

## 3. Chat Attachments: Plus Button

- [ ] Open any workspace thread with the normal chat composer.
- [ ] Click the `+` or file-attachment affordance in the composer.
- [ ] Confirm the file picker opens.
- [ ] Select an image file.
- [ ] Confirm the image appears as a pending attachment in the composer.
- [ ] Repeat with a non-image file.

Expected result:

- The picker opens reliably.
- Images attach even if document parsing services are still warming up.
- Non-image files enter the existing parse/upload flow.

---

## 4. Chat Attachments: Clipboard Paste

### Image paste

- [ ] Copy an image to the clipboard.
- [ ] Focus the chat composer.
- [ ] Paste.
- [ ] Confirm the image becomes an attachment.
- [ ] Confirm it is attached only once.

### File paste

- [ ] Copy a file from Finder if your environment supports file clipboard paste.
- [ ] Paste into the composer.
- [ ] Confirm the file enters the attachment pipeline.
- [ ] Confirm it is attached only once.

### Mixed paste

- [ ] Copy text plus an image, or paste text while an image is available on the clipboard.
- [ ] Confirm text lands in the textarea and the image becomes an attachment.

Expected result:

- Paste works for both `clipboardData.items` and `clipboardData.files`.
- No duplicate attachments are created.
- Text still pastes as text.

---

## 5. Thread Rename

- [ ] Open a workspace with several threads in the sidebar.
- [ ] Use the thread rename action.
- [ ] Enter a new name in the in-app rename modal.
- [ ] Save it.
- [ ] Confirm the thread name updates immediately in the sidebar without needing a refresh.
- [ ] Reopen the thread and confirm the name persists.

Expected result:

- Rename works through the in-app modal and the sidebar rerenders immediately.

---

## 6. Custom Council Naming

### Draft naming

- [ ] Open the Metacanon library flow for building a custom council.
- [ ] Confirm the draft naming field says `Council Name`, not `Custom Constellation`.
- [ ] Confirm the helper copy refers to councils rather than constellations.

### Saved custom council naming

- [ ] Save a custom council with a distinctive name.
- [ ] Confirm the featured custom council card shows that saved name.
- [ ] Use the `Rename` action on the card.
- [ ] Save a new name.
- [ ] Confirm the visible council name updates immediately.

Expected result:

- Council naming is explicit and editable both during draft creation and after saving.

---

## 7. Current Context vs Actual Accessible Documents

- [ ] Open a thread that uses attached documents.
- [ ] Attach one or more documents.
- [ ] Open `Current Context`.
- [ ] Confirm the documents shown there are the ones Prism can actually load, not stale or missing parsed files.
- [ ] Ask Prism: `What files can you currently see in this conversation?`
- [ ] Confirm Prism names the same files shown in `Current Context`, not unrelated workspace-retrieved files.

### Reattach check

- [ ] Reattach the same file again.
- [ ] Ask the same question.
- [ ] Confirm Prism uses the newest usable version instead of an older stale copy.

Expected result:

- `Current Context` and the model-visible attachment set stay in sync.

---

## 8. Draft Council / Pack Alignment Clear State

- [ ] Build or activate a draft council or constellation pack.
- [ ] Confirm the composer shows the active alignment banner.
- [ ] Remove the draft lenses, clear the draft, or switch draft mode.
- [ ] Confirm the banner disappears.
- [ ] Send a new message.
- [ ] Confirm Prism does not keep using the old draft pack after the draft was cleared.

Expected result:

- Clearing the draft also clears the active draft alignment state.

---

## 9. Aligned Follow-Up Continuity: “Answer Again” Case

- [ ] Ask a normal question in a thread.
- [ ] Let Prism answer fully.
- [ ] Activate a constellation, council, or lens.
- [ ] Ask: `Answer that again in light of the constellation.`
- [ ] Confirm Prism revises the prior answer itself rather than drifting into generic alignment explanation.

Expected result:

- The second answer stays anchored to the original task and prior exchange.

---

## 10. Aligned Follow-Up Continuity: Short Reply Case

- [ ] Start a new aligned conversation where Prism asks you follow-up questions.
- [ ] Reply briefly to those questions.
- [ ] Confirm Prism continues the same task rather than resetting into generic constellation/council/lens description.

Suggested prompt:

```text
/constellation @constellation-brand-voice-atelier Ask me two specific questions about my brand voice before you answer.
```

Suggested short reply:

```text
My audience is technically capable founders. I want the voice to feel grounded, warm, and precise.
```

Expected result:

- Prism treats the short reply as continuation of the active thread, not as a fresh abstract alignment request.

---

## 11. Current Fixes Summary Pass

- [ ] Provider picker regressions are resolved.
- [ ] Create-workspace affordance is restored.
- [ ] Plus-button upload works.
- [ ] Clipboard attachment behavior works.
- [ ] Thread rename works.
- [ ] Custom council naming is clear and editable.
- [ ] Current Context matches the documents Prism actually sees.
- [ ] Clearing a draft council/constellation also clears active alignment state.
- [ ] “Answer again in light of...” follow-ups stay grounded.
- [ ] Short replies to Prism’s own clarifying questions stay grounded.

---

## Notes / Failures

Use this section to capture failures with exact reproduction details:

- Workspace:
- Thread:
- Model/provider:
- Prompt:
- Expected:
- Actual:
- Screenshot path:
- Timestamp:
