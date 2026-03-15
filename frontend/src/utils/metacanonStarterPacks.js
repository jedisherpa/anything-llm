export const STARTER_PACKS = [
  {
    id: "default",
    title: "Default",
    subtitle: "Watcher -> Auditor -> Synthesizer -> Torus -> Prism",
    handle: "@agent",
    collectionLabel: "Starter Pack",
    colorHex: "#d4a63e",
    glyph: "Df",
  },
  {
    id: "research",
    title: "Research",
    subtitle: "Evidence-gathering and vigilance-led framing",
    handle: "@watcher",
    collectionLabel: "Starter Pack",
    colorHex: "#46c8c7",
    glyph: "Rs",
  },
  {
    id: "strategy",
    title: "Strategy",
    subtitle: "Systems integration and long-range structure",
    handle: "@torus",
    collectionLabel: "Starter Pack",
    colorHex: "#5ca4ff",
    glyph: "St",
  },
  {
    id: "builder",
    title: "Builder",
    subtitle: "First-principles building with practical execution",
    handle:
      "@mc-millennial-founders-board-09-first-principles-master-builder-lens",
    collectionLabel: "Starter Pack",
    colorHex: "#d9895f",
    glyph: "Bd",
  },
  {
    id: "reflection",
    title: "Reflection",
    subtitle: "Stillness, perspective, and inner calibration",
    handle: "@mc-lens-09-09-the-empty-bowl",
    collectionLabel: "Starter Pack",
    colorHex: "#9f8cff",
    glyph: "Rf",
  },
];

export function getStarterPackById(id = "") {
  return STARTER_PACKS.find((pack) => pack.id === id) || null;
}
