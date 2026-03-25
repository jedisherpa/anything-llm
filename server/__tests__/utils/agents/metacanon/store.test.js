const store = require("../../../../utils/agents/metacanon/store");

describe("Metacanon store alias resolution", () => {
  it("resolves legacy lens handles to the new canonical manifest", () => {
    const manifest = store.getLensManifestByHandle(
      "@mc-millennial-founders-board-09-first-principles-master-builder-lens"
    );

    expect(manifest?.id).toBe("millennial-founders-board-first-principles-builder");
    expect(manifest?.handle).toBe(
      "@mc-millennial-founders-board-first-principles-builder"
    );
  });

  it("resolves legacy constellation handles to the new canonical manifest", () => {
    const manifest = store.getConstellationManifestByHandle(
      "@constellation-octahedron-1-the-brand-soul-council"
    );

    expect(manifest?.id).toBe("brand-soul-atelier");
    expect(manifest?.handle).toBe("@constellation-brand-soul-atelier");
  });

  it("resolves legacy constellation item ids to the renamed detail payload", () => {
    const item = store.getLibraryItem(
      "constellations",
      "dodecahedron-1-the-sovereign-strategy-council"
    );

    expect(item?.id).toBe("sovereign-strategy-forum");
    expect(item?.detailPath).toBe("constellations/sovereign-strategy-forum.json");
  });

  it("resolves legacy council item ids to the renamed council detail payload", () => {
    const item = store.getLibraryItem("councils", "Council_01");

    expect(item?.id).toBe("matchless-love-council");
    expect(item?.detailPath).toBe("councils/matchless-love-council.json");
  });
});
