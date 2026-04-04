# ffi-node

Node bridge for the MetaCanon native runtime addon.

## Entry points

- `index.js` - primary bridge entrypoint
- `commands.js` - command shim layer
- `client.js` - client shim layer
- `scripts/build-native.sh` - native build script
- `metacanon_ai.node` - current native addon artifact

## Role

This root is a standalone bridge package. Its provenance is tied to the umbrella Rust runtime, but it should be managed as its own repo.
