const DEFAULT_LIBRARY_MANIFEST_PATH = "/music/playlist.json";

function toTrackId(value, fallback) {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTrackUrl(url) {
  if (!url) return "";

  if (/^https?:\/\//i.test(url) || url.startsWith("/")) {
    return url;
  }

  return `/music/${url.replace(/^\.?\//, "")}`;
}

function normalizeTrack(track, index) {
  if (!track || typeof track !== "object") return null;

  const name = String(track.name || track.title || track.filename || "").trim();
  const filename = String(track.filename || track.file || "").trim();
  const url = normalizeTrackUrl(track.url || track.path || filename);

  if (!name || !url) return null;

  const id = toTrackId(track.id, `${name}-${index + 1}`);

  return {
    id,
    name,
    filename: filename || url.split("/").pop() || `${id}.mp3`,
    url,
    source: "library",
  };
}

export function normalizePlaylistManifest(payload) {
  const tracks = Array.isArray(payload) ? payload : payload?.tracks;

  if (!Array.isArray(tracks)) {
    return [];
  }

  return tracks
    .map((track, index) => normalizeTrack(track, index))
    .filter(Boolean);
}

export async function loadBundledPlaylistManifest(
  manifestPath = DEFAULT_LIBRARY_MANIFEST_PATH
) {
  const response = await fetch(manifestPath, {
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return {
      status: "empty",
      tracks: [],
    };
  }

  if (!response.ok) {
    throw new Error(`Unable to load playlist manifest (${response.status}).`);
  }

  const payload = await response.json();
  const tracks = normalizePlaylistManifest(payload);

  return {
    status: tracks.length ? "ready" : "empty",
    tracks,
    title:
      typeof payload?.title === "string" && payload.title.trim()
        ? payload.title.trim()
        : "Prism Library",
  };
}

export { DEFAULT_LIBRARY_MANIFEST_PATH };
