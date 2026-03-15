Place your deployed Prism music library in this folder.

1. Copy up to 20-25 MP3 files into `public/music/`.
2. Update `public/music/playlist.json`.
3. Deploy the frontend to Vercel.

Example `playlist.json`:

```json
{
  "title": "Prism After Hours",
  "tracks": [
    {
      "id": "moon-river",
      "name": "Moon River",
      "filename": "moon-river.mp3",
      "url": "/music/moon-river.mp3"
    },
    {
      "id": "night-drive",
      "name": "Night Drive",
      "filename": "night-drive.mp3",
      "url": "/music/night-drive.mp3"
    }
  ]
}
```

Notes:
- `name` is what shows up in the Prism UI.
- `url` can be absolute like `/music/song.mp3` or a relative file name like `song.mp3`.
- Tracks listed here become the bundled library available to anyone who opens the deployed site.
