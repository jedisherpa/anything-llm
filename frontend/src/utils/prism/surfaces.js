export const PRISM_SURFACE_STABILITY = Object.freeze({
  STABLE: "stable",
  ADMIN_ONLY: "admin-only",
  EXPERIMENTAL: "experimental",
});

export const PRISM_SURFACES = Object.freeze({
  controlCenter: {
    key: "control-center",
    path: "/metacanonai",
    stability: PRISM_SURFACE_STABILITY.STABLE,
  },
  library: {
    key: "library",
    path: "/metacanonai/library",
    stability: PRISM_SURFACE_STABILITY.STABLE,
  },
  composer: {
    key: "composer",
    path: "/metacanonai/composer",
    stability: PRISM_SURFACE_STABILITY.STABLE,
  },
  manualPreviews: {
    key: "manual-previews",
    path: "/metacanonai/manual-previews",
    stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
  },
  uiLab: {
    key: "ui-lab",
    path: "/metacanonai/ui-lab",
    stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
  },
  repoLab: {
    key: "repo-lab",
    path: "/metacanonai/repo-lab",
    stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
  },
  prismHero: {
    key: "prism-hero",
    path: "/prism-hero",
    stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
  },
  prismDodecahedron: {
    key: "prism-dodecahedron",
    path: "/prism-dodecahedron",
    stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
  },
});

export function prismExperimentalSurfacesEnabled() {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_PRISM_EXPERIMENTAL_SURFACES === "enabled"
  );
}

export function prismRepoLabEnabled() {
  return (
    prismExperimentalSurfacesEnabled() &&
    (import.meta.env.DEV || import.meta.env.VITE_PRISM_REPO_LAB === "enabled")
  );
}

export function prismSurfaceEnabled(surface) {
  if (!surface) return false;

  if (surface.stability === PRISM_SURFACE_STABILITY.EXPERIMENTAL) {
    if (surface.key === PRISM_SURFACES.repoLab.key) {
      return prismRepoLabEnabled();
    }
    return prismExperimentalSurfacesEnabled();
  }

  return true;
}

export function prismSurfaceBadge(surface) {
  if (!surface) return null;
  if (surface.stability === PRISM_SURFACE_STABILITY.EXPERIMENTAL) {
    return "Experimental";
  }
  if (surface.stability === PRISM_SURFACE_STABILITY.ADMIN_ONLY) {
    return "Admin";
  }
  return "Stable";
}
