# Agent Prompt: Fix Prism Presence State and Desktop Piper TTS

## Objective

Stabilize Prism’s reactive presence state and restore reliable local desktop Piper playback, especially on first request and in packaged desktop builds.

## Context

PrismAI had two visibly related issues:

- the Prism presence/THINKING-to-response state could feel sticky or disconnected from agent output
- local desktop Piper TTS was unreliable, especially on first playback and when bundled local voice assets were invalid or incomplete

This fix should make both the shell feedback loop and the local TTS experience feel dependable.

## Source files to inspect first

- `frontend/src/PrismContext.jsx`
- `frontend/src/utils/chat/agent.js`
- `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/HistoricalMessage/Actions/TTSButton/piperTTS.jsx`
- `frontend/src/utils/piperTTS/index.js`
- `frontend/src/utils/piperTTS/worker.js`
- `server/utils/piper/index.js`
- `server/utils/piper/piperFileExists.js`
- any server bootstrap file where the Piper static route is mounted

## Your task

Implement or restore the following behavior:

1. Agent stream events should produce Prism response pulses when useful output actually arrives, not only at some generic session boundary.
2. The Prism shell should leave thinking state cleanly when the agent finishes or reports “done thinking.”
3. Piper should prewarm before first playback.
4. Long TTS messages should be chunked in a way that gets the first audible response out quickly.
5. Timeout behavior should be more generous for first chunk / warmup than for follow-on chunks.
6. Local Piper assets should be validated so broken bundled voice files or LFS placeholder files do not silently poison playback.
7. The desktop/server runtime should be able to serve or lazily fetch required Piper runtime assets.

## Required implementation details

- In Prism presence handling:
  - make agent output trigger a response pulse at meaningful times such as generic output, first chunk, full response, or explicit done-thinking status
  - ensure agent-end behavior does not leave the shell stuck in thinking
- In Piper client/worker behavior:
  - add a warmup phase
  - distinguish warmup/result/progress/debug/error messages
  - improve chunk splitting with a smaller or prioritized first chunk
  - use different timeout floors for first chunk vs later chunks
- In local asset validation:
  - verify `.onnx` files are real model payloads, not just text/LFS pointers
  - fall back if the local asset is invalid
- On the server:
  - expose the Piper runtime assets on a stable local path
  - lazily fetch required runtime files if missing

## Constraints

- Do not treat presence and TTS as unrelated problems; both affect perceived responsiveness.
- Do not hard-fail playback just because a local bundled voice asset is invalid if a safe fallback path exists.
- Preserve local desktop-first behavior where possible instead of forcing browser-worker-only or remote-only playback.

## Acceptance criteria

- Agent responses visibly transition Prism out of thinking state and into response state at the right times.
- First-click Piper playback is materially more reliable.
- Long messages do not stall excessively before any audio starts.
- Bad local voice assets do not permanently break local playback.
- Required Piper runtime files are available through the local server/runtime path.

## Recommended validation

Test:

- Prism response state during agent output
- end-of-agent-session state
- first TTS click in desktop mode
- repeated TTS playback after warmup
- long TTS message chunking
- invalid or missing local voice asset fallback

## Deliverable

Produce:

- the code changes
- the Prism presence transition rules you implemented
- the TTS warmup/chunking strategy
- the local-asset validation/fallback strategy
- any remaining cosmetic issues in presence state that still need follow-up
