const OpenAI = require("openai");
const Provider = require("./ai-provider.js");
const InheritMultiple = require("./helpers/classes.js");
const UnTooled = require("./helpers/untooled.js");

const XAI_MODEL_ALIASES = {
  "grok-4.20-multi-agent-0309": "grok-4.20-multi-agent-beta-0309",
};

/**
 * The agent provider for the xAI provider.
 */
class XAIProvider extends InheritMultiple([Provider, UnTooled]) {
  model;

  constructor(config = {}) {
    const { model = "grok-beta" } = config;
    super();
    const client = new OpenAI({
      baseURL: "https://api.x.ai/v1",
      apiKey: process.env.XAI_LLM_API_KEY,
      maxRetries: 3,
    });

    this._client = client;
    this.model = this.#normalizeModel(model);
    this.verbose = true;
  }

  get client() {
    return this._client;
  }

  get supportsAgentStreaming() {
    return true;
  }

  /**
   * Whether this provider supports native OpenAI-compatible tool calling.
   * Override in subclass and return true to use native tool calling instead of UnTooled.
   * @returns {boolean|Promise<boolean>}
   */
  supportsNativeToolCalling() {
    return false;
  }

  #normalizeModel(model = "grok-beta") {
    return XAI_MODEL_ALIASES[model] ?? model;
  }

  #usesResponsesApi() {
    return this.model.includes("multi-agent");
  }

  #formatResponsesInput(messages = []) {
    return messages.map((message) => ({
      role: message.role,
      content: typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content),
    }));
  }

  #extractResponsesText(response) {
    if (typeof response?.output_text === "string" && response.output_text) {
      return response.output_text;
    }

    const text = [];
    for (const outputBlock of response?.output || []) {
      if (outputBlock.type !== "message") continue;
      for (const contentBlock of outputBlock.content || []) {
        if (contentBlock.type === "output_text" && contentBlock.text) {
          text.push(contentBlock.text);
        }
      }
    }

    return text.join("");
  }

  async *#streamResponsesAsChatChunks({ messages = [] }) {
    const response = await this.client.responses.create({
      model: this.model,
      input: this.#formatResponsesInput(messages),
      stream: true,
      store: false,
    });

    for await (const chunk of response) {
      if (chunk.type !== "response.output_text.delta" || !chunk.delta) continue;
      yield { choices: [{ delta: { content: chunk.delta } }] };
    }
  }

  async #handleFunctionCallChat({ messages = [] }) {
    if (this.#usesResponsesApi()) {
      return await this.client.responses
        .create({
          model: this.model,
          input: this.#formatResponsesInput(messages),
          store: false,
        })
        .then((result) => this.#extractResponsesText(result))
        .catch((_) => {
          return null;
        });
    }

    return await this.client.chat.completions
      .create({
        model: this.model,
        messages,
      })
      .then((result) => {
        if (!result.hasOwnProperty("choices"))
          throw new Error("xAI chat: No results!");
        if (result.choices.length === 0)
          throw new Error("xAI chat: No results length!");
        return result.choices[0].message.content;
      })
      .catch((_) => {
        return null;
      });
  }

  async #handleFunctionCallStream({ messages = [] }) {
    if (this.#usesResponsesApi()) {
      return this.#streamResponsesAsChatChunks({ messages });
    }

    return await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages,
    });
  }

  async stream(messages, functions = [], eventHandler = null) {
    return await UnTooled.prototype.stream.call(
      this,
      messages,
      functions,
      this.#handleFunctionCallStream.bind(this),
      eventHandler
    );
  }

  async complete(messages, functions = []) {
    return await UnTooled.prototype.complete.call(
      this,
      messages,
      functions,
      this.#handleFunctionCallChat.bind(this)
    );
  }

  /**
   * Get the cost of the completion.
   *
   * @param _usage The completion to get the cost for.
   * @returns The cost of the completion.
   */
  getCost(_usage) {
    return 0;
  }
}

module.exports = XAIProvider;
