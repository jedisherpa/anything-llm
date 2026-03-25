describe("Metacanon library runtime fallbacks", () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    jest.unmock("../../../../utils/agents/metacanon/store");
  });

  it("falls back to the council handle when the generated library index is unavailable", () => {
    jest.doMock("../../../../utils/agents/metacanon/store", () => ({
      getLibraryManifest: jest.fn(() => {
        throw new Error("missing index");
      }),
      getLibraryItem: jest.fn(() => {
        throw new Error("missing item");
      }),
      getLensIndex: jest.fn(() => {
        throw new Error("missing lenses");
      }),
      getConstellationIndex: jest.fn(() => {
        throw new Error("missing constellations");
      }),
      getLensManifestByHandle: jest.fn(() => {
        throw new Error("missing lens");
      }),
      getLensManifestById: jest.fn(() => {
        throw new Error("missing lens");
      }),
      getConstellationManifestByHandle: jest.fn(() => {
        throw new Error("missing constellation");
      }),
      getConstellationManifestById: jest.fn(() => {
        throw new Error("missing constellation");
      }),
    }));

    let library;
    jest.isolateModules(() => {
      library = require("../../../../utils/agents/metacanon/library");
    });

    expect(library.getSupportedMetacanonHandles()).toEqual(["@council"]);
    expect(library.getMetacanonLibrary()).toEqual({
      generatedAt: null,
      counts: {},
      collections: {},
    });
    expect(library.getImportedLensDefinition("@missing")).toBeNull();
    expect(library.getConstellationExecutionPlan("@missing")).toBeNull();
  });

  it("still resolves imported lens handles and constellations when store data is present", () => {
    jest.doMock("../../../../utils/agents/metacanon/store", () => ({
      getLibraryManifest: jest.fn(() => ({
        generatedAt: "2026-03-23T00:00:00Z",
        counts: { lenses: 1, constellations: 1 },
        collections: { lenses: "lenses" },
      })),
      getLibraryItem: jest.fn(() => ({ content: "Lens role body" })),
      getLensIndex: jest.fn(() => [
        { id: "lens-1", handle: "@lens-one", title: "Lens One", board: "Core" },
      ]),
      getConstellationIndex: jest.fn(() => [
        {
          id: "constellation-1",
          handle: "@constellation-one",
          name: "Constellation One",
          members: [{ lensHandle: "@lens-one", role: "Reviewer" }],
        },
      ]),
      getLensManifestByHandle: jest.fn((handle) =>
        handle === "@lens-one"
          ? {
              id: "lens-1",
              handle: "@lens-one",
              title: "Lens One",
              board: "Core",
            }
          : null
      ),
      getLensManifestById: jest.fn(() => null),
      getConstellationManifestByHandle: jest.fn((handle) =>
        handle === "@constellation-one"
          ? {
              id: "constellation-1",
              handle: "@constellation-one",
              name: "Constellation One",
              members: [{ lensHandle: "@lens-one", role: "Reviewer" }],
            }
          : null
      ),
      getConstellationManifestById: jest.fn(() => null),
    }));

    let library;
    jest.isolateModules(() => {
      library = require("../../../../utils/agents/metacanon/library");
    });

    expect(library.getSupportedMetacanonHandles()).toEqual([
      "@council",
      "@lens-one",
      "@constellation-one",
    ]);
    expect(library.getImportedLensDefinition("@lens-one")).toMatchObject({
      name: "@lens-one",
      definition: {
        role: "Lens role body",
        lensId: "lens-1",
      },
    });
    expect(
      library.getConstellationExecutionPlan("@constellation-one")
    ).toMatchObject({
      handles: ["@lens-one"],
      members: [
        expect.objectContaining({
          role: "Reviewer",
          lens: expect.objectContaining({ handle: "@lens-one" }),
        }),
      ],
    });
  });

  it("hydrates preset constellation member execution from the detail payload", () => {
    const lensManifestByHandle = jest.fn((handle) => {
      const catalog = {
        "@project-manager": {
          id: "lens-pm",
          handle: "@project-manager",
          title: "Project Manager",
          board: "Project Managers",
        },
        "@lens-alpha": {
          id: "lens-alpha",
          handle: "@lens-alpha",
          title: "Lens Alpha",
          board: "Core",
        },
        "@lens-beta": {
          id: "lens-beta",
          handle: "@lens-beta",
          title: "Lens Beta",
          board: "Core",
        },
        "@lens-gamma": {
          id: "lens-gamma",
          handle: "@lens-gamma",
          title: "Lens Gamma",
          board: "Core",
        },
        "@lens-delta": {
          id: "lens-delta",
          handle: "@lens-delta",
          title: "Lens Delta",
          board: "Core",
        },
      };

      return catalog[handle] || null;
    });

    jest.doMock("../../../../utils/agents/metacanon/store", () => ({
      getLibraryManifest: jest.fn(() => ({
        generatedAt: "2026-03-24T00:00:00Z",
        counts: { lenses: 5, constellations: 1 },
        collections: { constellations: "constellations" },
      })),
      getLibraryItem: jest.fn((tab, id) => {
        if (tab === "constellations" && id === "constellation-1") {
          return {
            id: "constellation-1",
            handle: "@constellation-one",
            name: "Constellation One",
            projectManagerHandle: "@project-manager",
            members: [
              { lensHandle: "@lens-alpha", role: "First" },
              { lensHandle: "@lens-beta", role: "Second" },
              { lensHandle: "@lens-gamma", role: "Third" },
              { lensHandle: "@lens-delta", role: "Fourth" },
            ],
          };
        }

        return { content: `Role body for ${id}` };
      }),
      getLensIndex: jest.fn(() => Object.values({}).filter(Boolean)),
      getConstellationIndex: jest.fn(() => [
        {
          id: "constellation-1",
          handle: "@constellation-one",
          name: "Constellation One",
          projectManagerHandle: "@project-manager",
        },
      ]),
      getLensManifestByHandle: lensManifestByHandle,
      getLensManifestById: jest.fn(() => null),
      getConstellationManifestByHandle: jest.fn((handle) =>
        handle === "@constellation-one"
          ? {
              id: "constellation-1",
              handle: "@constellation-one",
              name: "Constellation One",
              projectManagerHandle: "@project-manager",
            }
          : null
      ),
      getConstellationManifestById: jest.fn(() => null),
      getLensAliasHandles: jest.fn(() => []),
      getConstellationAliasHandles: jest.fn(() => []),
    }));

    let library;
    jest.isolateModules(() => {
      library = require("../../../../utils/agents/metacanon/library");
    });

    const executionPlan =
      library.getConstellationExecutionPlan("@constellation-one");

    expect(executionPlan?.projectManager).toMatchObject({
      handle: "@project-manager",
    });
    expect(executionPlan?.handles).toEqual([
      "@project-manager",
      "@lens-alpha",
      "@lens-beta",
      "@lens-gamma",
      "@lens-delta",
    ]);
    expect(executionPlan?.members).toHaveLength(4);
    expect(executionPlan?.members.map((member) => member.role)).toEqual([
      "First",
      "Second",
      "Third",
      "Fourth",
    ]);
  });
});
