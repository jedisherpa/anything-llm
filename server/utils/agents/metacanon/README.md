# Metacanon Runtime Boundary

This directory intentionally mixes a small handwritten runtime layer with a large generated data payload.

## Handwritten runtime files

- `library.js`
- `store.js`

These files contain the runtime behavior used by the server and mobile clients to resolve library manifests, collections, items, and execution plans.

## Generated data assets

- `library.generated.json`
- `summary.generated.json`
- `pcls.generated.json`
- `library-collections/`
- `library-items/`

These files are product data assets, not hand-maintained application logic. Treat them like packaged content:

- regenerate or replace them via explicit import/generation workflows
- do not mix runtime behavior into the generated payloads
- keep API compatibility stable for callers that consume the current manifest and item shapes

## Stability rule

Wave 1 rehab should preserve the current manifest, collection, and item read behavior while making the runtime/data boundary easier to reason about.
