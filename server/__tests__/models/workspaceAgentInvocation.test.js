const {
  WorkspaceAgentInvocation,
} = require("../../models/workspaceAgentInvocation");

describe("WorkspaceAgentInvocation.parseAgents", () => {
  it("normalizes explicit /agent commands into agent invocations", () => {
    expect(
      WorkspaceAgentInvocation.normalizeInvocationPrompt(
        "/agent Help me think this through"
      )
    ).toBe("@agent Help me think this through");

    expect(
      WorkspaceAgentInvocation.parseAgents("/agent Help me think this through")
    ).toEqual(["@agent"]);
  });

  it("normalizes explicit /lens commands into direct lens invocations", () => {
    expect(
      WorkspaceAgentInvocation.normalizeInvocationPrompt(
        "/lens @prism Help me rewrite this clearly"
      )
    ).toBe("@prism Help me rewrite this clearly");

    expect(
      WorkspaceAgentInvocation.parseAgents(
        "/lens @prism Help me rewrite this clearly"
      )
    ).toEqual(["@prism"]);
  });

  it("normalizes explicit /constellation commands into constellation invocations", () => {
    expect(
      WorkspaceAgentInvocation.normalizeInvocationPrompt(
        "/constellation @constellation-brand-soul-atelier Help me define the brand soul"
      )
    ).toBe(
      "@constellation-brand-soul-atelier Help me define the brand soul"
    );

    expect(
      WorkspaceAgentInvocation.parseAgents(
        "/constellation @constellation-brand-soul-atelier Help me define the brand soul"
      )
    ).toEqual(["@constellation-brand-soul-atelier"]);
  });

  it("keeps legacy constellation aliases working during the transition", () => {
    expect(
      WorkspaceAgentInvocation.parseAgents(
        "/constellation @constellation-octahedron-1-the-brand-soul-council Help me define the brand soul"
      )
    ).toEqual(["@constellation-octahedron-1-the-brand-soul-council"]);
  });

  it("normalizes explicit /council commands into structured council prompts", () => {
    expect(
      WorkspaceAgentInvocation.normalizeInvocationPrompt(
        "/council @watcher @auditor -- Pressure test this launch plan"
      )
    ).toBe(
      "@council\npack: Ad Hoc Council Pack\nlenses: @watcher @auditor\nuser query: Pressure test this launch plan"
    );

    expect(
      WorkspaceAgentInvocation.parseAgents(
        "/council @watcher @auditor -- Pressure test this launch plan"
      )
    ).toEqual(["@council"]);
  });

  it("parses only supported leading invocation handles", () => {
    expect(
      WorkspaceAgentInvocation.parseAgents(
        "@agent @prism help me think this through"
      )
    ).toEqual(["@agent", "@prism"]);
  });

  it("does not treat later prose mentions as invocation handles", () => {
    expect(
      WorkspaceAgentInvocation.parseAgents(
        "@agent help me compare this idea to what @prism would say"
      )
    ).toEqual(["@agent"]);
  });

  it("does not parse handles when the prompt does not start with a supported handle", () => {
    expect(
      WorkspaceAgentInvocation.parseAgents(
        "Can you ask @prism what it thinks about this?"
      )
    ).toEqual([]);
  });

  it("keeps constellation routing anchored to the leading constellation handle", () => {
    expect(
      WorkspaceAgentInvocation.parseAgents(
        "@constellation-brand-soul-atelier help with this and mention @prism in the answer"
      )
    ).toEqual(["@constellation-brand-soul-atelier"]);
  });
});
