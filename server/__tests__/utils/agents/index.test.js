process.env.STORAGE_DIR = process.env.STORAGE_DIR || "/tmp";

const { AgentHandler } = require("../../../utils/agents");
const { WORKSPACE_AGENT } = require("../../../utils/agents/defaults");

describe("AgentHandler initial invocation prompt routing", () => {
  it("strips explicit /lens invocations before sending input to a direct lens channel", () => {
    const handler = new AgentHandler({ uuid: "test-invocation" });
    handler.channel = "@mc-direct-response-board-direct-response-master";

    expect(
      handler.initialAgentPrompt(
        "/lens @mc-direct-response-board-direct-response-master Tell me about Paul"
      )
    ).toBe("Tell me about Paul");
  });

  it("strips direct handle prefixes before sending input to a direct lens channel", () => {
    const handler = new AgentHandler({ uuid: "test-invocation" });
    handler.channel = "@prism";

    expect(handler.initialAgentPrompt("@prism Help me rewrite this")).toBe(
      "Help me rewrite this"
    );
  });

  it("preserves the original prompt for standard workspace-agent routing", () => {
    const handler = new AgentHandler({ uuid: "test-invocation" });
    handler.channel = WORKSPACE_AGENT.name;

    expect(handler.initialAgentPrompt("/lens @prism Help me rewrite this")).toBe(
      "/lens @prism Help me rewrite this"
    );
  });
});
