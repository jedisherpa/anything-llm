const { NativeEmbedder } = require("../../EmbeddingEngines/native");
const {
  LLMPerformanceMonitor,
} = require("../../helpers/chat/LLMPerformanceMonitor");
const {
  handleDefaultStreamResponseV2,
  formatChatHistory,
} = require("../../helpers/chat/responses");
const { MODEL_MAP } = require("../modelMap");

const XAI_MODEL_ALIASES = {
  "grok-4.20-multi-agent-0309": "grok-4.20-multi-agent-beta-0309",
};

class XAiLLM {
  constructor(embedder = null, modelPreference = null) {
    if (!process.env.XAI_LLM_API_KEY)
      throw new Error("No xAI API key was set.");
    this.className = "XAiLLM";
    const { OpenAI: OpenAIApi } = require("openai");

    this.openai = new OpenAIApi({
      baseURL: "https://api.x.ai/v1",
      apiKey: process.env.XAI_LLM_API_KEY,
    });
    this.model = this.#normalizeModel(
      modelPreference || process.env.XAI_LLM_MODEL_PREF || "grok-beta"
    );
    this.limits = {
      history: this.promptWindowLimit() * 0.15,
      system: this.promptWindowLimit() * 0.15,
      user: this.promptWindowLimit() * 0.7,
    };

    this.embedder = embedder ?? new NativeEmbedder();
    this.defaultTemp = 0.7;
    this.log(
      `Initialized ${this.model} with context window ${this.promptWindowLimit()}`
    );
  }

  log(text, ...args) {
    console.log(`\x1b[36m[${this.className}]\x1b[0m ${text}`, ...args);
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
      content:
        typeof message.content === "string"
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

  async *#responsesAsChatChunks(messages = []) {
    const response = await this.openai.responses.create({
      model: this.model,
      input: this.#formatResponsesInput(messages),
      stream: true,
      store: false,
    });

    for await (const chunk of response) {
      if (chunk.type !== "response.output_text.delta" || !chunk.delta) continue;
      yield { choices: [{ delta: { content: chunk.delta } }] };
    }

    yield { choices: [{ delta: {}, finish_reason: "stop" }] };
  }

  #appendContext(contextTexts = []) {
    if (!contextTexts || !contextTexts.length) return "";
    return (
      "\nContext:\n" +
      contextTexts
        .map((text, i) => {
          return `[CONTEXT ${i}]:\n${text}\n[END CONTEXT ${i}]\n\n`;
        })
        .join("")
    );
  }

  streamingEnabled() {
    return "streamGetChatCompletion" in this;
  }

  static promptWindowLimit(modelName) {
    return MODEL_MAP.get("xai", modelName) ?? 131_072;
  }

  promptWindowLimit() {
    return MODEL_MAP.get("xai", this.model) ?? 131_072;
  }

  isValidChatCompletionModel(_modelName = "") {
    return true;
  }

  /**
   * Generates appropriate content array for a message + attachments.
   * @param {{userPrompt:string, attachments: import("../../helpers").Attachment[]}}
   * @returns {string|object[]}
   */
  #generateContent({ userPrompt, attachments = [] }) {
    if (!attachments.length) {
      return userPrompt;
    }

    const content = [{ type: "text", text: userPrompt }];
    for (let attachment of attachments) {
      content.push({
        type: "image_url",
        image_url: {
          url: attachment.contentString,
          detail: "high",
        },
      });
    }
    return content.flat();
  }

  /**
   * Construct the user prompt for this model.
   * @param {{attachments: import("../../helpers").Attachment[]}} param0
   * @returns
   */
  constructPrompt({
    systemPrompt = "",
    contextTexts = [],
    chatHistory = [],
    userPrompt = "",
    attachments = [], // This is the specific attachment for only this prompt
  }) {
    const prompt = {
      role: "system",
      content: `${systemPrompt}${this.#appendContext(contextTexts)}`,
    };
    return [
      prompt,
      ...formatChatHistory(chatHistory, this.#generateContent),
      {
        role: "user",
        content: this.#generateContent({ userPrompt, attachments }),
      },
    ];
  }

  async getChatCompletion(messages = null, { temperature = 0.7 }) {
    if (!this.isValidChatCompletionModel(this.model))
      throw new Error(
        `xAI chat: ${this.model} is not valid for chat completion!`
      );

    const result = await LLMPerformanceMonitor.measureAsyncFunction(
      (this.#usesResponsesApi()
        ? this.openai.responses.create({
            model: this.model,
            input: this.#formatResponsesInput(messages),
            store: false,
          })
        : this.openai.chat.completions.create({
            model: this.model,
            messages,
            temperature,
          })
      ).catch((e) => {
        throw new Error(e.message);
      })
    );

    if (this.#usesResponsesApi()) {
      const textResponse = this.#extractResponsesText(result.output);
      if (!textResponse) return null;
      return {
        textResponse,
        metrics: {
          prompt_tokens: result.output.usage?.input_tokens || 0,
          completion_tokens: result.output.usage?.output_tokens || 0,
          total_tokens: result.output.usage?.total_tokens || 0,
          outputTps:
            (result.output.usage?.output_tokens || 0) / result.duration,
          duration: result.duration,
          model: this.model,
          provider: this.className,
          timestamp: new Date(),
        },
      };
    }

    if (!result.output.hasOwnProperty("choices") || result.output.choices.length === 0)
      return null;

    return {
      textResponse: result.output.choices[0].message.content,
      metrics: {
        prompt_tokens: result.output.usage.prompt_tokens || 0,
        completion_tokens: result.output.usage.completion_tokens || 0,
        total_tokens: result.output.usage.total_tokens || 0,
        outputTps: result.output.usage.completion_tokens / result.duration,
        duration: result.duration,
        model: this.model,
        provider: this.className,
        timestamp: new Date(),
      },
    };
  }

  async streamGetChatCompletion(messages = null, { temperature = 0.7 }) {
    if (!this.isValidChatCompletionModel(this.model))
      throw new Error(
        `xAI chat: ${this.model} is not valid for chat completion!`
      );

    const measuredStreamRequest = await LLMPerformanceMonitor.measureStream({
      func: this.#usesResponsesApi()
        ? this.#responsesAsChatChunks(messages)
        : this.openai.chat.completions.create({
            model: this.model,
            stream: true,
            messages,
            temperature,
          }),
      messages,
      runPromptTokenCalculation: false,
      modelTag: this.model,
      provider: this.className,
    });

    return measuredStreamRequest;
  }

  handleStream(response, stream, responseProps) {
    return handleDefaultStreamResponseV2(response, stream, responseProps);
  }

  // Simple wrapper for dynamic embedder & normalize interface for all LLM implementations
  async embedTextInput(textInput) {
    return await this.embedder.embedTextInput(textInput);
  }
  async embedChunks(textChunks = []) {
    return await this.embedder.embedChunks(textChunks);
  }

  async compressMessages(promptArgs = {}, rawHistory = []) {
    const { messageArrayCompressor } = require("../../helpers/chat");
    const messageArray = this.constructPrompt(promptArgs);
    return await messageArrayCompressor(this, messageArray, rawHistory);
  }
}

module.exports = {
  XAiLLM,
};
