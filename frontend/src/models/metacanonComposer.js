import {
  getCouncilUiTitle,
  getLensUiTitle,
  getSubSphereUiTitle,
} from "@/utils/metacanonTerminology";

const SAVED_SHAPES_STORAGE_KEY = "metacanon-composer-saved-shapes-v1";
const SAVED_COUNCILS_STORAGE_KEY = "metacanon-composer-saved-councils-v1";

export const COMPOSER_FAMILIES = Object.freeze({
  SHAPES: "shapes",
  COUNCILS: "councils",
});

export const COMPOSER_BUILD_MODES = Object.freeze({
  PRESETS: "presets",
  CUSTOM: "custom",
});

export const SHAPE_TEMPLATES = Object.freeze([
  {
    id: "tetrahedron",
    label: "Tetrahedron",
    cardinality: 4,
    sourceType: "Tetrahedron",
    defaultPresetId: "first-principles-inquiry",
    purpose: "Compact four-lens structure for fast synthesis.",
  },
  {
    id: "cube",
    label: "Cube",
    cardinality: 6,
    sourceType: "Octahedron",
    defaultPresetId: "ethical-architecture-forum",
    purpose: "Balanced six-lens frame for grounded execution.",
  },
  {
    id: "octahedron",
    label: "Octahedron",
    cardinality: 8,
    sourceType: "Star Tetrahedron",
    defaultPresetId: "organizational-transformation-engine",
    purpose: "Eight-lens orchestration for larger strategic builds.",
  },
  {
    id: "decagon",
    label: "Decagon",
    cardinality: 10,
    sourceType: "Decagon",
    defaultPresetId: "category-creation-engine",
    purpose: "Ten-lens pattern for category and platform design.",
  },
  {
    id: "dodecahedron",
    label: "Dodecahedron",
    cardinality: 12,
    sourceType: "Dodecahedron",
    defaultPresetId: "sovereign-strategy-forum",
    purpose: "Twelve-lens strategic forum for full-spectrum inquiry.",
  },
]);

function safeParse(rawValue, fallback) {
  try {
    const parsed = JSON.parse(rawValue);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function makeId(prefix = "mix") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTitle(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/\s+/g, " ");
}

function normalizeLens(lens = {}) {
  return {
    id: lens.id || lens.handle || lens.relativePath || lens.title,
    handle: lens.handle || "",
    title: getLensUiTitle(lens),
    overview: lens.overview || lens.description || "",
    relativePath: lens.relativePath || "",
    collectionLabel:
      lens.collectionLabel || lens.councilLabel || lens.councilName || "Lens",
    collectionKind: lens.collectionKind || "lens",
  };
}

export function createLensLookups(lenses = []) {
  const byHandle = new Map();
  const byRelativePath = new Map();
  const byTitle = new Map();

  const normalized = lenses.map((lens) => {
    const next = normalizeLens(lens);

    if (next.handle) byHandle.set(next.handle, next);
    if (next.relativePath) byRelativePath.set(next.relativePath, next);
    byTitle.set(normalizeTitle(next.title), next);
    return next;
  });

  return {
    all: normalized,
    byHandle,
    byRelativePath,
    byTitle,
  };
}

function resolveLensReference(reference = {}, lensLookups) {
  if (!reference) return null;

  if (reference.handle && lensLookups.byHandle.has(reference.handle)) {
    return lensLookups.byHandle.get(reference.handle);
  }

  if (
    reference.relativePath &&
    lensLookups.byRelativePath.has(reference.relativePath)
  ) {
    return lensLookups.byRelativePath.get(reference.relativePath);
  }

  const titleKey = normalizeTitle(
    reference.lensTitle ||
      reference.displayRole ||
      reference.role ||
      reference.title
  );
  if (titleKey && lensLookups.byTitle.has(titleKey)) {
    return lensLookups.byTitle.get(titleKey);
  }

  const fallbackTitle =
    reference.lensTitle ||
    reference.displayRole ||
    reference.role ||
    reference.title;

  if (!fallbackTitle) return null;

  return {
    id: reference.id || reference.relativePath || fallbackTitle,
    handle: "",
    title: String(fallbackTitle),
    overview: "",
    relativePath: reference.relativePath || "",
    collectionLabel: reference.collectionLabel || "Imported Lens",
    collectionKind: "lens",
  };
}

function uniqueLenses(lenses = []) {
  const seen = new Set();

  return lenses.filter((lens) => {
    const key = lens?.handle || lens?.id || lens?.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveConstellationMembers(members = [], lensLookups) {
  return uniqueLenses(
    members
      .map((member, index) => {
        const lens = resolveLensReference(
          {
            handle: member?.lensHandle || "",
            lensTitle: member?.lensTitle || "",
            title: member?.displayRole || member?.role || "",
            relativePath: member?.relativePath || "",
            collectionLabel: "Preset Lens",
          },
          lensLookups
        );

        if (!lens) return null;

        return {
          ...lens,
          slot: index + 2,
          role: member?.displayRole || member?.role || lens.title,
        };
      })
      .filter(Boolean)
  );
}

function resolveProjectManager(constellation = {}, lensLookups) {
  const lens = resolveLensReference(
    {
      handle: constellation.projectManagerHandle || "",
      lensTitle: constellation.projectManagerTitle || "",
      title: constellation.projectManagerTitle || "",
      relativePath: constellation.projectManagerRelativePath || "",
      collectionLabel: "Project Manager Lens",
    },
    lensLookups
  );

  if (!lens) return null;

  return {
    ...lens,
    slot: 1,
    locked: true,
    role: constellation.projectManagerTitle || lens.title,
  };
}

function buildShapePresetMix(template, constellation, lensLookups) {
  const projectManager = resolveProjectManager(constellation, lensLookups);
  const members = resolveConstellationMembers(
    constellation.members || [],
    lensLookups
  );
  const lenses = uniqueLenses(
    [projectManager, ...members].filter(Boolean)
  ).slice(0, template.cardinality);

  return {
    id: constellation.id,
    sourceId: constellation.id,
    name: getSubSphereUiTitle(constellation),
    description: constellation.purpose || template.purpose,
    mode: "shape",
    sourceKind: "preset",
    family: COMPOSER_FAMILIES.SHAPES,
    shapeId: template.id,
    shapeLabel: template.label,
    cardinality: template.cardinality,
    projectManagerLensHandle: projectManager?.handle || "",
    projectManagerLensTitle:
      constellation.projectManagerTitle || projectManager?.title || "",
    lenses,
    statusLabel: `${template.cardinality}-lens preset`,
  };
}

function buildCouncilPresetMix(council = {}, lensLookups) {
  const lenses = uniqueLenses(
    (council.lenses || [])
      .map((lens, index) => {
        const resolved = resolveLensReference(
          {
            handle: lens?.handle || "",
            lensTitle: lens?.displayTitle || lens?.title || "",
            title: lens?.displayTitle || lens?.title || "",
          },
          lensLookups
        );

        if (!resolved) return null;
        return {
          ...resolved,
          slot: index + 1,
          role: resolved.title,
        };
      })
      .filter(Boolean)
  );

  return {
    id: council.id,
    sourceId: council.id,
    name: getCouncilUiTitle(council),
    description:
      council.purpose ||
      `${lenses.length} lenses arranged for self-reflection and deeper thinking.`,
    mode: "council",
    sourceKind: "preset",
    family: COMPOSER_FAMILIES.COUNCILS,
    shapeId: null,
    shapeLabel: null,
    cardinality: lenses.length,
    projectManagerLensHandle: "",
    projectManagerLensTitle: "",
    lenses,
    statusLabel: `${lenses.length}-lens preset`,
  };
}

function findTemplateById(shapeId = "") {
  return (
    SHAPE_TEMPLATES.find((template) => template.id === shapeId) ||
    SHAPE_TEMPLATES[1]
  );
}

export function buildComposerDataset({
  councils = [],
  constellations = [],
  lenses = [],
} = {}) {
  const lensLookups = createLensLookups(lenses);

  const shapeTemplates = SHAPE_TEMPLATES.map((template) => {
    const presets = constellations
      .filter((constellation) => constellation.type === template.sourceType)
      .map((constellation) =>
        buildShapePresetMix(template, constellation, lensLookups)
      );

    const defaultPreset =
      presets.find((preset) => preset.id === template.defaultPresetId) ||
      presets[0] ||
      null;

    return {
      ...template,
      presets,
      defaultPresetId: defaultPreset?.id || template.defaultPresetId,
      defaultProjectManagerLensHandle:
        defaultPreset?.projectManagerLensHandle || "",
      defaultProjectManagerLensTitle:
        defaultPreset?.projectManagerLensTitle || "",
      defaultCanonicalLensHandles: (defaultPreset?.lenses || [])
        .map((lens) => lens.handle)
        .filter(Boolean),
    };
  });

  const councilPresets = councils.map((council) =>
    buildCouncilPresetMix(council, lensLookups)
  );

  return {
    lensLookups,
    allLenses: lensLookups.all,
    councilPresets,
    shapeTemplates,
  };
}

function normalizeSavedMix(mix = {}, type = "council") {
  return {
    id: mix.id || makeId(type === "shape" ? "shape" : "council"),
    name: mix.name || (type === "shape" ? "Saved Shape" : "Saved Council"),
    description: mix.description || "",
    mode: type,
    shapeId: mix.shapeId || null,
    projectManagerLensHandle: mix.projectManagerLensHandle || "",
    projectManagerLensTitle: mix.projectManagerLensTitle || "",
    lenses: Array.isArray(mix.lenses)
      ? mix.lenses.map((lens, index) => ({
          ...normalizeLens(lens),
          slot: lens.slot || index + 1,
          role: lens.role || normalizeLens(lens).title,
          locked: Boolean(lens.locked),
        }))
      : [],
    createdAt: mix.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function loadSavedShapes() {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(SAVED_SHAPES_STORAGE_KEY), []).map(
    (mix) => normalizeSavedMix(mix, "shape")
  );
}

export function loadSavedCouncils() {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(SAVED_COUNCILS_STORAGE_KEY), []).map(
    (mix) => normalizeSavedMix(mix, "council")
  );
}

export function saveShapeMix(mix = {}) {
  if (typeof window === "undefined") return null;
  const nextMix = normalizeSavedMix(mix, "shape");
  const next = [
    nextMix,
    ...loadSavedShapes().filter((current) => current.id !== nextMix.id),
  ];
  localStorage.setItem(SAVED_SHAPES_STORAGE_KEY, JSON.stringify(next));
  return nextMix;
}

export function saveCouncilMix(mix = {}) {
  if (typeof window === "undefined") return null;
  const nextMix = normalizeSavedMix(mix, "council");
  const next = [
    nextMix,
    ...loadSavedCouncils().filter((current) => current.id !== nextMix.id),
  ];
  localStorage.setItem(SAVED_COUNCILS_STORAGE_KEY, JSON.stringify(next));
  return nextMix;
}

export function deleteSavedShape(mixId = "") {
  if (typeof window === "undefined") return [];
  const next = loadSavedShapes().filter((mix) => mix.id !== mixId);
  localStorage.setItem(SAVED_SHAPES_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteSavedCouncil(mixId = "") {
  if (typeof window === "undefined") return [];
  const next = loadSavedCouncils().filter((mix) => mix.id !== mixId);
  localStorage.setItem(SAVED_COUNCILS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function createCustomShapeMix(
  template,
  { name = "", description = "" } = {}
) {
  return {
    id: makeId("shape-draft"),
    name: name || `Custom ${template.label}`,
    description,
    mode: "shape",
    sourceKind: "custom",
    family: COMPOSER_FAMILIES.SHAPES,
    shapeId: template.id,
    shapeLabel: template.label,
    cardinality: template.cardinality,
    projectManagerLensHandle: template.defaultProjectManagerLensHandle || "",
    projectManagerLensTitle:
      template.defaultProjectManagerLensTitle || "Project Manager",
    lenses: template.defaultProjectManagerLensHandle
      ? [
          {
            ...{
              handle: template.defaultProjectManagerLensHandle,
              title:
                template.defaultProjectManagerLensTitle || "Project Manager",
              collectionLabel: "Project Manager Lens",
              collectionKind: "lens",
              overview: "",
              relativePath: "",
              id: template.defaultProjectManagerLensHandle,
            },
            slot: 1,
            locked: true,
            role: template.defaultProjectManagerLensTitle || "Project Manager",
          },
        ]
      : [],
    statusLabel: `${template.cardinality}-lens custom shape`,
  };
}

export function createCustomCouncilMix() {
  return {
    id: makeId("council-draft"),
    name: "Custom Council",
    description: "",
    mode: "council",
    sourceKind: "custom",
    family: COMPOSER_FAMILIES.COUNCILS,
    shapeId: null,
    shapeLabel: null,
    cardinality: 0,
    projectManagerLensHandle: "",
    projectManagerLensTitle: "",
    lenses: [],
    statusLabel: "Freeform council",
  };
}

export function cloneMixAsCustom(mix = {}, templateOverride = null) {
  if (mix.mode === "shape") {
    const template = templateOverride || findTemplateById(mix.shapeId);
    return {
      ...normalizeSavedMix(
        {
          ...mix,
          id: makeId("shape-draft"),
          mode: "shape",
          shapeId: template.id,
        },
        "shape"
      ),
      sourceKind: "custom",
      shapeLabel: template.label,
      cardinality: template.cardinality,
    };
  }

  return {
    ...normalizeSavedMix({ ...mix, id: makeId("council-draft") }, "council"),
    sourceKind: "custom",
  };
}

export function validateShapeMix(mix = {}, templateOverride = null) {
  const template = templateOverride || findTemplateById(mix.shapeId);
  const totalSelected = mix.lenses?.length || 0;
  const pmPresent = Boolean(
    mix.projectManagerLensHandle &&
      mix.lenses?.some((lens) => lens.handle === mix.projectManagerLensHandle)
  );

  if (!pmPresent) {
    return {
      valid: false,
      status: "missing-pm",
      message: "Missing project manager lens.",
    };
  }

  if (totalSelected < template.cardinality) {
    return {
      valid: false,
      status: "incomplete",
      message: `Needs ${template.cardinality - totalSelected} more lens${template.cardinality - totalSelected === 1 ? "" : "es"}.`,
    };
  }

  if (totalSelected > template.cardinality) {
    return {
      valid: false,
      status: "overflow",
      message: `Overfilled by ${totalSelected - template.cardinality} lens${totalSelected - template.cardinality === 1 ? "" : "es"}.`,
    };
  }

  return {
    valid: true,
    status: "complete",
    message: "Ready to save.",
  };
}

export function describeCouncilMix(mix = {}) {
  const count = mix.lenses?.length || 0;
  if (count === 0) {
    return {
      valid: false,
      status: "empty",
      message: "Add at least one lens to build a council.",
    };
  }

  return {
    valid: true,
    status: "complete",
    message: `Freeform council with ${count} lens${count === 1 ? "" : "es"}.`,
  };
}

export function autocompleteShapeMix(mix = {}, template, shapeTemplates = []) {
  const activeTemplate = template || findTemplateById(mix.shapeId);
  const resolvedTemplate =
    shapeTemplates.find((item) => item.id === activeTemplate.id) ||
    activeTemplate;
  const canonicalHandles = resolvedTemplate.defaultCanonicalLensHandles || [];
  const existingHandles = new Set(
    (mix.lenses || []).map((lens) => lens.handle).filter(Boolean)
  );

  const nextLenses = [...(mix.lenses || [])];

  canonicalHandles.forEach((handle) => {
    if (nextLenses.length >= resolvedTemplate.cardinality) return;
    if (!handle || existingHandles.has(handle)) return;

    existingHandles.add(handle);
    nextLenses.push({
      id: handle,
      handle,
      title: handle,
      overview: "",
      relativePath: "",
      collectionLabel: "Canonical Lens",
      collectionKind: "lens",
      slot: nextLenses.length + 1,
      role: "Canonical Lens",
    });
  });

  return {
    ...mix,
    lenses: nextLenses.map((lens, index) => ({
      ...lens,
      slot: index + 1,
      locked:
        lens.handle === mix.projectManagerLensHandle
          ? true
          : Boolean(lens.locked),
    })),
  };
}

export function resolveShapeTemplate(shapeId = "") {
  return findTemplateById(shapeId);
}
