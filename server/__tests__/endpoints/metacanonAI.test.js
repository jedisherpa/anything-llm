const path = require("path");

const ORIGINAL_ENV = process.env;

function loadInternals({
  nodeEnv = "",
  repoDevelopmentMarker = false,
  repoLab = undefined,
  repoLabWrite = undefined,
} = {}) {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };

  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;

  if (repoLab === undefined) delete process.env.METACANON_REPO_LAB;
  else process.env.METACANON_REPO_LAB = repoLab;

  if (repoLabWrite === undefined) delete process.env.METACANON_REPO_LAB_WRITE;
  else process.env.METACANON_REPO_LAB_WRITE = repoLabWrite;

  jest.doMock("fs", () => {
    const actual = jest.requireActual("fs");
    return {
      ...actual,
      existsSync: jest.fn((targetPath) => {
        if (String(targetPath).endsWith(`${path.sep}.git`)) {
          return repoDevelopmentMarker;
        }
        return actual.existsSync(targetPath);
      }),
    };
  });
  jest.doMock("../../utils/http", () => ({
    reqBody: jest.fn(() => ({})),
  }));
  jest.doMock("../../utils/middleware/validatedRequest", () => ({
    validatedRequest: jest.fn(),
  }));
  jest.doMock("../../utils/middleware/multiUserProtected", () => ({
    flexUserRoleValid: jest.fn(() => jest.fn()),
    ROLES: { admin: "admin", manager: "manager" },
  }));
  jest.doMock("../../utils/metacanonRepo", () => ({
    getRepoInfo: jest.fn(),
    listDirectory: jest.fn(),
    buildFileIndex: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    normalizeRelativePath: jest.fn((value) => String(value || "")),
  }));
  jest.doMock("../../utils/agents/metacanon/store", () => ({
    getLibraryManifest: jest.fn(() => ({})),
    getLibraryItem: jest.fn(() => null),
    getLibraryCollection: jest.fn(() => []),
  }));

  let internals;
  jest.isolateModules(() => {
    internals = require("../../endpoints/metacanonAI")._internals;
  });
  return internals;
}

describe("metacanon repo lab gating", () => {
  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
    jest.unmock("fs");
  });

  it("treats an unset NODE_ENV as local development only when running from a repo checkout", () => {
    const internals = loadInternals({
      nodeEnv: "",
      repoDevelopmentMarker: true,
    });

    expect(internals.isLocalRepoLabDevelopment()).toBe(true);
    expect(internals.repoLabReadEnabled()).toBe(true);
    expect(internals.repoLabWriteEnabled()).toBe(true);
  });

  it("keeps repo lab disabled in packaged runtimes when NODE_ENV is unset", () => {
    const internals = loadInternals({
      nodeEnv: "",
      repoDevelopmentMarker: false,
    });

    expect(internals.isLocalRepoLabDevelopment()).toBe(false);
    expect(internals.repoLabReadEnabled()).toBe(false);
    expect(internals.repoLabWriteEnabled()).toBe(false);
  });

  it("allows explicit production overrides without treating the runtime as local development", () => {
    const internals = loadInternals({
      nodeEnv: "production",
      repoDevelopmentMarker: false,
      repoLab: "enabled",
      repoLabWrite: "enabled",
    });

    expect(internals.isLocalRepoLabDevelopment()).toBe(false);
    expect(internals.repoLabReadEnabled()).toBe(true);
    expect(internals.repoLabWriteEnabled()).toBe(true);
  });
});
