## Prism Vercel Deploy

This frontend can now be deployed as a simple Prism microsite on Vercel.

### What ships

- The Prism WebGL route at `/prism-dodecahedron`
- A built-in music library loaded from `/public/music/playlist.json`
- Optional local MP3 uploads layered on top for temporary sessions
- A Vercel config that redirects `/` to `/prism-dodecahedron`

### Add your music

1. Copy your MP3 files into [`public/music`](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/frontend/public/music).
2. Update [`public/music/playlist.json`](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/frontend/public/music/playlist.json) with the track list.
3. Keep the total uploaded library under your Vercel project limit.

### Local verification

```bash
yarn install
yarn build:vercel
```

Then preview with:

```bash
yarn preview
```

Open:

```text
http://localhost:4173/prism-dodecahedron
```

### Deploy on Vercel

From [`frontend`](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/frontend):

```bash
vercel
```

Recommended Vercel settings:

- Framework preset: `Vite`
- Build command: `yarn build:vercel`
- Output directory: `dist`

The included [`vercel.json`](/Users/paulcooper/Documents/Codex%20Master%20Folder/anything-llm/frontend/vercel.json) already:

- keeps the static Vite build output intact
- redirects `/` to `/prism-dodecahedron`
- rewrites SPA routes to `index.html`

### Notes

- The current deployment package still contains the rest of the frontend bundle, but the root URL lands directly on Prism.
- If you want a smaller dedicated microsite later, we can split Prism into its own Vite app.
