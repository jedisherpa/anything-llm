const AIbitat = require("./aibitat");
const AgentPlugins = require("./aibitat/plugins");
const {
  WorkspaceAgentInvocation,
} = require("../../models/workspaceAgentInvocation");
const { User } = require("../../models/user");
const { WorkspaceChats } = require("../../models/workspaceChats");
const { safeJsonParse } = require("../http");
const {
    USER_AGENT,
    WORKSPACE_AGENT,
    getLensAgentDefinitions,
    getImportedLensDefinition,
  } = require("./defaults");
const {
  LENS_DELIBERATION_OVERVIEW,
} = require("./aibitat/prompts/lensAgents");
const {
    METACANON_COUNCIL_HANDLE,
    getConstellationByHandle,
    getConstellationExecutionPlan,
    getImportedLensByHandle,
    parseCouncilPackPrompt,
  } = require("./metacanon/library");
const ImportedPlugin = require("./imported");
const { AgentFlows } = require("../agentFlows");
const MCPCompatibilityLayer = require("../MCP");

class AgentHandler {
  #invocationUUID;
  #funcsToLoad = [];
  invocation = null;
  aibitat = null;
  channel = null;
  provider = null;
  model = null;
  sharedFunctions = [];

  constructor({ uuid }) {
    this.#invocationUUID = uuid;
  }

  log(text, ...args) {
    console.log(`\x1b[36m[AgentHandler]\x1b[0m ${text}`, ...args);
  }

  closeAlert() {
    this.log(`End ${this.#invocationUUID}::${this.provider}:${this.model}`);
  }

  async #chatHistory(limit = 10) {
    try {
      const rawHistory = (
        await WorkspaceChats.where(
          {
            workspaceId: this.invocation.workspace_id,
            user_id: this.invocation.user_id || null,
            thread_id: this.invocation.thread_id || null,
            api_session_id: null,
            include: true,
          },
          limit,
          { id: "desc" }
        )
      ).reverse();

      const agentHistory = [];
      rawHistory.forEach((chatLog) => {
        agentHistory.push(
          {
            from: USER_AGENT.name,
            to: WORKSPACE_AGENT.name,
            content: chatLog.prompt,
            state: "success",
          },
          {
            from: WORKSPACE_AGENT.name,
            to: USER_AGENT.name,
            content: safeJsonParse(chatLog.response)?.text || "",
            state: "success",
          }
        );
      });
      return agentHistory;
    } catch (e) {
      this.log("Error loading chat history", e.message);
      return [];
    }
  }

  checkSetup() {
    switch (this.provider) {
      case "openai":
        if (!process.env.OPEN_AI_KEY)
          throw new Error("OpenAI API key must be provided to use agents.");
        break;
      case "anthropic":
        if (!process.env.ANTHROPIC_API_KEY)
          throw new Error("Anthropic API key must be provided to use agents.");
        break;
      case "lmstudio":
        if (!process.env.LMSTUDIO_BASE_PATH)
          throw new Error("LMStudio base path must be provided to use agents.");
        break;
      case "ollama":
        if (!process.env.OLLAMA_BASE_PATH)
          throw new Error("Ollama base path must be provided to use agents.");
        break;
      case "groq":
        if (!process.env.GROQ_API_KEY)
          throw new Error("Groq API key must be provided to use agents.");
        break;
      case "togetherai":
        if (!process.env.TOGETHER_AI_API_KEY)
          throw new Error("TogetherAI API key must be provided to use agents.");
        break;
      case "azure":
        if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_KEY)
          throw new Error(
            "Azure OpenAI API endpoint and key must be provided to use agents."
          );
        break;
      case "koboldcpp":
        if (!process.env.KOBOLD_CPP_BASE_PATH)
          throw new Error(
            "KoboldCPP must have a valid base path to use for the api."
          );
        break;
      case "localai":
        if (!process.env.LOCAL_AI_BASE_PATH)
          throw new Error(
            "LocalAI must have a valid base path to use for the api."
          );
        break;
      case "openrouter":
        if (!process.env.OPENROUTER_API_KEY)
          throw new Error("OpenRouter API key must be provided to use agents.");
        break;
      case "mistral":
        if (!process.env.MISTRAL_API_KEY)
          throw new Error("Mistral API key must be provided to use agents.");
        break;
      case "generic-openai":
        if (!process.env.GENERIC_OPEN_AI_BASE_PATH)
          throw new Error("API base path must be provided to use agents.");
        break;
      case "perplexity":
        if (!process.env.PERPLEXITY_API_KEY)
          throw new Error("Perplexity API key must be provided to use agents.");
        break;
      case "textgenwebui":
        if (!process.env.TEXT_GEN_WEB_UI_BASE_PATH)
          throw new Error(
            "TextWebGenUI API base path must be provided to use agents."
          );
        break;
      case "bedrock":
        // No validations since there are many possible authentication methods
        break;
      case "fireworksai":
        if (!process.env.FIREWORKS_AI_LLM_API_KEY)
          throw new Error(
            "FireworksAI API Key must be provided to use agents."
          );
        break;
      case "deepseek":
        if (!process.env.DEEPSEEK_API_KEY)
          throw new Error("DeepSeek API Key must be provided to use agents.");
        break;
      case "litellm":
        if (!process.env.LITE_LLM_BASE_PATH)
          throw new Error(
            "LiteLLM API base path and key must be provided to use agents."
          );
        break;
      case "apipie":
        if (!process.env.APIPIE_LLM_API_KEY)
          throw new Error("ApiPie API Key must be provided to use agents.");
        break;
      case "xai":
        if (!process.env.XAI_LLM_API_KEY)
          throw new Error("xAI API Key must be provided to use agents.");
        break;
      case "zai":
        if (!process.env.ZAI_API_KEY)
          throw new Error("Z.AI API Key must be provided to use agents.");
        break;
      case "novita":
        if (!process.env.NOVITA_LLM_API_KEY)
          throw new Error("Novita API Key must be provided to use agents.");
        break;
      case "nvidia-nim":
        if (!process.env.NVIDIA_NIM_LLM_BASE_PATH)
          throw new Error(
            "NVIDIA NIM base path must be provided to use agents."
          );
        break;
      case "ppio":
        if (!process.env.PPIO_API_KEY)
          throw new Error("PPIO API Key must be provided to use agents.");
        break;
      case "gemini":
        if (!process.env.GEMINI_API_KEY)
          throw new Error("Gemini API key must be provided to use agents.");
        break;
      case "dpais":
        if (!process.env.DPAIS_LLM_BASE_PATH)
          throw new Error(
            "Dell Pro AI Studio base path must be provided to use agents."
          );
        if (!process.env.DPAIS_LLM_MODEL_PREF)
          throw new Error(
            "Dell Pro AI Studio model must be set to use agents."
          );
        break;
      case "moonshotai":
        if (!process.env.MOONSHOT_AI_MODEL_PREF)
          throw new Error("Moonshot AI model must be set to use agents.");
        break;
      case "cometapi":
        if (!process.env.COMETAPI_LLM_API_KEY)
          throw new Error("CometAPI API Key must be provided to use agents.");
        break;
      case "foundry":
        if (!process.env.FOUNDRY_BASE_PATH)
          throw new Error("Foundry base path must be provided to use agents.");
        break;
      case "giteeai":
        if (!process.env.GITEE_AI_API_KEY)
          throw new Error("GiteeAI API Key must be provided to use agents.");
        break;
      case "cohere":
        if (!process.env.COHERE_API_KEY)
          throw new Error("Cohere API key must be provided to use agents.");
        break;
      case "docker-model-runner":
        if (!process.env.DOCKER_MODEL_RUNNER_BASE_PATH)
          throw new Error(
            "Docker Model Runner base path must be provided to use agents."
          );
        break;
      case "privatemode":
        if (!process.env.PRIVATEMODE_LLM_BASE_PATH)
          throw new Error(
            "Privatemode base path must be provided to use agents."
          );
        break;
      case "sambanova":
        if (!process.env.SAMBANOVA_LLM_API_KEY)
          throw new Error("SambaNova API key must be provided to use agents.");
        break;
      case "lemonade":
        if (!process.env.LEMONADE_LLM_BASE_PATH)
          throw new Error("Lemonade base path must be provided to use agents.");
        break;
      default:
        throw new Error(
          "No workspace agent provider set. Please set your agent provider in the workspace's settings"
        );
    }
  }

  /**
   * Finds the default model for a given provider. If no default model is set for it's associated ENV then
   * it will return a reasonable base model for the provider if one exists.
   * @param {string} provider - The provider to find the default model for.
   * @returns {string|null} The default model for the provider.
   */
  providerDefault(provider = this.provider) {
    switch (provider) {
      case "openai":
        return process.env.OPEN_MODEL_PREF ?? "gpt-4o";
      case "anthropic":
        return process.env.ANTHROPIC_MODEL_PREF ?? "claude-3-sonnet-20240229";
      case "lmstudio":
        return process.env.LMSTUDIO_MODEL_PREF ?? null;
      case "ollama":
        return process.env.OLLAMA_MODEL_PREF ?? "llama3:latest";
      case "groq":
        return process.env.GROQ_MODEL_PREF ?? "llama3-70b-8192";
      case "togetherai":
        return (
          process.env.TOGETHER_AI_MODEL_PREF ??
          "mistralai/Mixtral-8x7B-Instruct-v0.1"
        );
      case "azure":
        return (
          process.env.AZURE_OPENAI_MODEL_PREF || process.env.OPEN_MODEL_PREF
        );
      case "koboldcpp":
        return process.env.KOBOLD_CPP_MODEL_PREF ?? null;
      case "localai":
        return process.env.LOCAL_AI_MODEL_PREF ?? null;
      case "openrouter":
        return process.env.OPENROUTER_MODEL_PREF ?? "openrouter/auto";
      case "mistral":
        return process.env.MISTRAL_MODEL_PREF ?? "mistral-medium";
      case "generic-openai":
        return process.env.GENERIC_OPEN_AI_MODEL_PREF ?? null;
      case "perplexity":
        return process.env.PERPLEXITY_MODEL_PREF ?? "sonar-small-online";
      case "textgenwebui":
        return "text-generation-webui";
      case "bedrock":
        return process.env.AWS_BEDROCK_LLM_MODEL_PREFERENCE ?? null;
      case "fireworksai":
        return process.env.FIREWORKS_AI_LLM_MODEL_PREF ?? null;
      case "deepseek":
        return process.env.DEEPSEEK_MODEL_PREF ?? "deepseek-chat";
      case "litellm":
        return process.env.LITE_LLM_MODEL_PREF ?? null;
      case "moonshotai":
        return process.env.MOONSHOT_AI_MODEL_PREF ?? "moonshot-v1-32k";
      case "apipie":
        return process.env.APIPIE_LLM_MODEL_PREF ?? null;
      case "xai":
        return process.env.XAI_LLM_MODEL_PREF ?? "grok-beta";
      case "zai":
        return process.env.ZAI_MODEL_PREF ?? "glm-4.5";
      case "novita":
        return process.env.NOVITA_LLM_MODEL_PREF ?? "deepseek/deepseek-r1";
      case "nvidia-nim":
        return process.env.NVIDIA_NIM_LLM_MODEL_PREF ?? null;
      case "ppio":
        return process.env.PPIO_MODEL_PREF ?? "qwen/qwen2.5-32b-instruct";
      case "gemini":
        return process.env.GEMINI_LLM_MODEL_PREF ?? "gemini-2.0-flash-lite";
      case "dpais":
        return process.env.DPAIS_LLM_MODEL_PREF;
      case "cometapi":
        return process.env.COMETAPI_LLM_MODEL_PREF ?? "gpt-5-mini";
      case "foundry":
        return process.env.FOUNDRY_MODEL_PREF ?? null;
      case "giteeai":
        return process.env.GITEE_AI_MODEL_PREF ?? null;
      case "cohere":
        return process.env.COHERE_MODEL_PREF ?? "command-r-08-2024";
      case "docker-model-runner":
        return process.env.DOCKER_MODEL_RUNNER_LLM_MODEL_PREF ?? null;
      case "privatemode":
        return process.env.PRIVATEMODE_LLM_MODEL_PREF ?? null;
      case "sambanova":
        return process.env.SAMBANOVA_LLM_MODEL_PREF ?? null;
      case "lemonade":
        return process.env.LEMONADE_LLM_MODEL_PREF ?? null;
      default:
        return null;
    }
  }

  /**
   * Attempts to find a fallback provider and model to use if the workspace
   * does not have an explicit `agentProvider` and `agentModel` set.
   * 1. Fallback to the workspace `chatProvider` and `chatModel` if they exist.
   * 2. Fallback to the system `LLM_PROVIDER` and try to load the associated default model via ENV params or a base available model.
   * 3. Otherwise, return null - will likely throw an error the user can act on.
   * @returns {object|null} - An object with provider and model keys.
   */
  #getFallbackProvider() {
    // First, fallback to the workspace chat provider and model if they exist
    if (
      this.invocation.workspace.chatProvider &&
      this.invocation.workspace.chatModel
    ) {
      return {
        provider: this.invocation.workspace.chatProvider,
        model: this.invocation.workspace.chatModel,
      };
    }

    // If workspace does not have chat provider and model fallback
    // to system provider and try to load provider default model
    const systemProvider = process.env.LLM_PROVIDER;
    const systemModel = this.providerDefault(systemProvider);
    if (systemProvider && systemModel) {
      return {
        provider: systemProvider,
        model: systemModel,
      };
    }

    return null;
  }

  /**
   * Finds or assumes the model preference value to use for API calls.
   * If multi-model loading is supported, we use their agent model selection of the workspace
   * If not supported, we attempt to fallback to the system provider value for the LLM preference
   * and if that fails - we assume a reasonable base model to exist.
   * @returns {string|null} the model preference value to use in API calls
   */
  #fetchModel() {
    // Provider was not explicitly set for workspace, so we are going to run our fallback logic
    // that will set a provider and model for us to use.
    if (!this.provider) {
      const fallback = this.#getFallbackProvider();
      if (!fallback) throw new Error("No valid provider found for the agent.");
      this.provider = fallback.provider; // re-set the provider to the fallback provider so it is not null.
      return fallback.model; // set its defined model based on fallback logic.
    }

    // The provider was explicitly set, so check if the workspace has an agent model set.
    if (this.invocation.workspace.agentModel)
      return this.invocation.workspace.agentModel;

    // Otherwise, we have no model to use - so guess a default model to use via the provider
    // and it's system ENV params and if that fails - we return either a base model or null.
    return this.providerDefault();
  }

  #providerSetupAndCheck() {
    this.provider = this.invocation.workspace.agentProvider ?? null; // set provider to workspace agent provider if it exists
    this.model = this.#fetchModel();

    if (!this.provider)
      throw new Error("No valid provider found for the agent.");
    this.log(`Start ${this.#invocationUUID}::${this.provider}:${this.model}`);
    this.checkSetup();
  }

  async #validInvocation() {
    const invocation = await WorkspaceAgentInvocation.getWithWorkspace({
      uuid: String(this.#invocationUUID),
    });
    if (invocation?.closed)
      throw new Error("This agent invocation is already closed");
    this.invocation = invocation ?? null;
  }

  parseCallOptions(args, config = {}, pluginName) {
    const callOpts = {};
    for (const [param, definition] of Object.entries(config)) {
      if (
        definition.required &&
        (!Object.prototype.hasOwnProperty.call(args, param) ||
          args[param] === null)
      ) {
        this.log(
          `'${param}' required parameter for '${pluginName}' plugin is missing. Plugin may not function or crash agent.`
        );
        continue;
      }
      callOpts[param] = Object.prototype.hasOwnProperty.call(args, param)
        ? args[param]
        : definition.default || null;
    }
    return callOpts;
  }

  resolveFunctionName(pluginName = "") {
    if (!pluginName.includes("#") && !pluginName.startsWith("@@"))
      return pluginName;
    if (pluginName.startsWith("@@")) return pluginName.replace("@@", "");
    return pluginName.split("#")[1];
  }

  agentFunctionsForConfig(config = {}) {
    return config.functions
      ?.map((name) => this.aibitat.functions.get(this.resolveFunctionName(name)))
      .filter((fn) => !!fn);
  }

  /**
   * Replace a placeholder function reference with one or many resolved names
   * across all loaded agents that include the placeholder.
   * @param {string} oldName
   * @param {string|string[]} replacementNames
   */
  replaceAgentFunctionReference(oldName = "", replacementNames = []) {
    if (!oldName || !this.aibitat) return;
    const replacements = Array.isArray(replacementNames)
      ? replacementNames
      : [replacementNames];

    this.aibitat.agents.forEach((config, agentName) => {
      if (!Array.isArray(config?.functions)) return;
      if (!config.functions.includes(oldName)) return;

      const nextFunctions = config.functions.filter((fn) => fn !== oldName);
      replacements.forEach((fn) => {
        if (!fn || nextFunctions.includes(fn)) return;
        nextFunctions.push(fn);
      });

      this.aibitat.agents.set(agentName, {
        ...config,
        functions: nextFunctions,
      });
    });
  }

  /**
   * If a specific preloaded lens handle is present in the invocation prompt,
   * route the initial turn directly to that lens agent.
   * @param {string} prompt
   */
  setInitialChannelFromPrompt(prompt = "") {
    const agentHandles = WorkspaceAgentInvocation.parseAgents(prompt);
    const explicitHandle = agentHandles.find((handle) => handle !== WORKSPACE_AGENT.name);
    if (!explicitHandle || !this.aibitat?.agents?.get(explicitHandle)) {
      this.channel = null;
      return;
    }

    this.channel = explicitHandle;
    this.log(`Routing agent session directly to ${explicitHandle}`);
  }

  stripInvocationHandles(prompt = "") {
    const tokens = String(prompt || "")
      .trim()
      .split(/\s+/);
    while (tokens.length && tokens[0].startsWith("@")) tokens.shift();
    return tokens.join(" ").trim();
  }

  shouldRunLensDeliberation(prompt = "") {
    const handles = WorkspaceAgentInvocation.parseAgents(prompt);
    return handles.length === 1 && handles[0] === WORKSPACE_AGENT.name;
  }

  shouldRunMetacanonConstellation(prompt = "") {
    const handles = WorkspaceAgentInvocation.parseAgents(prompt);
    return handles.length > 0 && !!getConstellationByHandle(handles[0]);
  }

  shouldRunCouncilPack(prompt = "") {
    const handles = WorkspaceAgentInvocation.parseAgents(prompt);
    return handles.length > 0 && handles[0] === METACANON_COUNCIL_HANDLE;
  }

  ensureImportedLensAgentLoaded(handle = "") {
    const normalizedHandle = String(handle || "").toLowerCase();
    if (!normalizedHandle || this.aibitat?.agents?.has(normalizedHandle)) return;

    const definition = getImportedLensDefinition(
      normalizedHandle,
      this.sharedFunctions
    );
    if (!definition) return;
    this.aibitat.agent(definition.name, definition.definition);
  }

  ensurePromptHandlesLoaded(prompt = "") {
    const handles = WorkspaceAgentInvocation.parseAgents(prompt).filter((handle) =>
      Boolean(getImportedLensByHandle(handle))
    );
    handles.forEach((handle) => this.ensureImportedLensAgentLoaded(handle));
  }

  async executeLensAgent(handle = "", input = "") {
    this.ensureImportedLensAgentLoaded(handle);
    const agentConfig = this.aibitat.getAgentConfig(handle);
    if (!agentConfig) throw new Error(`Lens ${handle} is not available.`);
    const provider = this.aibitat.getProviderForConfig({
      ...this.aibitat.defaultProvider,
      ...agentConfig,
    });
    provider.attachHandlerProps(this.aibitat.handlerProps);
    const functions = this.agentFunctionsForConfig(agentConfig);
    const messages = [
      { role: "system", content: agentConfig.role },
      { role: "user", content: input },
    ];
    return await this.aibitat.handleExecution(
      provider,
      messages,
      functions,
      handle
    );
  }

  async runMetacanonConstellation(prompt = "") {
    const handles = WorkspaceAgentInvocation.parseAgents(prompt);
    const constellationHandle = handles[0];
    const executionPlan = getConstellationExecutionPlan(constellationHandle);
    const userQuery = this.stripInvocationHandles(prompt) || prompt;

    if (!executionPlan) {
      throw new Error(`Constellation ${constellationHandle} could not be resolved.`);
    }

    const { constellation, projectManager, members } = executionPlan;
    executionPlan.handles.forEach((handle) =>
      this.ensureImportedLensAgentLoaded(handle)
    );

    this.aibitat.newMessage({
      from: USER_AGENT.name,
      to: WORKSPACE_AGENT.name,
      content: prompt,
    });

    this.aibitat.introspect?.(
      `Metacanon constellation engaged: ${constellation.name}.`
    );
    this.aibitat.introspect?.(
      `Purpose: ${constellation.purpose || "Run a coordinated multi-lens analysis."}`
    );

    let orchestrationBrief = "";
    if (projectManager?.handle) {
      this.aibitat.introspect?.(
        `Project manager briefing: ${projectManager.title}.`
      );
      orchestrationBrief = await this.executeLensAgent(
        projectManager.handle,
        `Constellation: ${constellation.name}\nPurpose: ${constellation.purpose}\nUser query:\n${userQuery}\n\nTask: As the project manager, create a concise orchestration brief for this constellation. Specify the key tensions to examine, the most important questions to answer, and what a strong final output should contain.`
      );
    }

    const memberOutputs = [];
    for (const member of members) {
      this.aibitat.introspect?.(`Running ${member.role}.`);
      const result = await this.executeLensAgent(
        member.lens.handle,
        `Constellation: ${constellation.name}\nPurpose: ${constellation.purpose}\nAssigned role: ${member.role}\nUser query:\n${userQuery}\n\nProject manager brief:\n${orchestrationBrief || "No explicit orchestration brief provided."}\n\nTask: Respond from this lens with a concise analysis, recommendations, blind spots, and 1-3 clarification questions.`
      );
      memberOutputs.push({
        role: member.role,
        handle: member.lens.handle,
        title: member.lens.title,
        content: result,
      });
    }

    const finalHandle = projectManager?.handle || "@prism";
    const finalLabel = projectManager?.title || "Prism";
    this.aibitat.introspect?.(`Synthesizing via ${finalLabel}.`);
    const finalResponse = await this.executeLensAgent(
      finalHandle,
      `Constellation: ${constellation.name}\nPurpose: ${constellation.purpose}\nUser query:\n${userQuery}\n\nProject manager brief:\n${orchestrationBrief || "No explicit orchestration brief provided."}\n\nMember outputs:\n${memberOutputs
        .map(
          (output) =>
            `[${output.role} | ${output.title}]\n${output.content}`
        )
        .join("\n\n")}\n\nTask: Produce the final response for the user. Integrate the constellation's perspectives into one coherent answer with practical guidance, meaningful blind spots, and end with human clarification questions.`
    );

    this.aibitat.newMessage({
      from: finalHandle,
      to: USER_AGENT.name,
      content: finalResponse,
    });
    this.aibitat.terminate(USER_AGENT.name);
    return this.aibitat;
  }

  async runCouncilPack(prompt = "") {
    const { packName, handles, userQuery } = parseCouncilPackPrompt(prompt);
    handles.forEach((handle) => this.ensureImportedLensAgentLoaded(handle));
    const resolvedHandles = handles.filter((handle) =>
      this.aibitat?.agents?.has(handle)
    );

    if (resolvedHandles.length === 0) {
      throw new Error("Council pack did not include any valid lens handles.");
    }

    this.aibitat.newMessage({
      from: USER_AGENT.name,
      to: WORKSPACE_AGENT.name,
      content: prompt,
    });

    this.aibitat.introspect?.(`Council pack engaged: ${packName}.`);
    const councilOutputs = [];

    for (const handle of resolvedHandles) {
      const lens = this.aibitat.getAgentConfig(handle);
      const label = lens?.lensTitle || handle;
      this.aibitat.introspect?.(`Running ${label}.`);
      const result = await this.executeLensAgent(
        handle,
        `Council pack: ${packName}\nUser query:\n${userQuery || this.stripInvocationHandles(prompt)}\n\nPrior council outputs:\n${councilOutputs
          .map((output) => `[${output.label}]\n${output.content}`)
          .join("\n\n") || "None yet."}\n\nTask: Contribute this lens's perspective concisely. Include analysis, recommendations, blind spots, and 1-3 clarification questions.`
      );
      councilOutputs.push({ handle, label, content: result });
    }

    const synthesisHandle = resolvedHandles.includes("@prism")
      ? "@prism"
      : "@prism";
    this.aibitat.introspect?.("Synthesizing council pack output.");
    const finalResponse = await this.executeLensAgent(
      synthesisHandle,
      `Council pack: ${packName}\nUser query:\n${userQuery || this.stripInvocationHandles(prompt)}\n\nCouncil outputs:\n${councilOutputs
        .map((output) => `[${output.label}]\n${output.content}`)
        .join("\n\n")}\n\nTask: Produce one unified final response for the user. Keep it structured, practical, and end with human clarification questions.`
    );

    this.aibitat.newMessage({
      from: synthesisHandle,
      to: USER_AGENT.name,
      content: finalResponse,
    });
    this.aibitat.terminate(USER_AGENT.name);
    return this.aibitat;
  }

  async runLensDeliberation(prompt = "") {
    const userQuery = this.stripInvocationHandles(prompt) || prompt;

    // Preserve the original invocation as the user message in chat history.
    this.aibitat.newMessage({
      from: USER_AGENT.name,
      to: WORKSPACE_AGENT.name,
      content: prompt,
    });

    this.aibitat.introspect?.("Lens deliberation engine engaged.");
    this.aibitat.introspect?.(LENS_DELIBERATION_OVERVIEW);
    this.aibitat.introspect?.("Running Watcher scan.");
    const watcher = await this.executeLensAgent(
      "@watcher",
      `User query:\n${userQuery}\n\nTask: Provide a concise vigilance report covering risk patterns, safety/compliance concerns, likely blind spots, and 1-3 clarification questions.`
    );

    this.aibitat.introspect?.("Running Auditor review.");
    const auditor = await this.executeLensAgent(
      "@auditor",
      `User query:\n${userQuery}\n\nWatcher report:\n${watcher}\n\nTask: Audit for integrity, alignment, policy boundaries, and material-impact flags. Provide calibrated findings, blind spots, and 1-3 clarification questions.`
    );

    this.aibitat.introspect?.("Running Synthesizer expansion.");
    const synthesizer = await this.executeLensAgent(
      "@synthesizer",
      `User query:\n${userQuery}\n\nWatcher report:\n${watcher}\n\nAuditor report:\n${auditor}\n\nTask: Generate concise, context-aware options and second-order consequences. Include blind spots and 1-3 clarification questions.`
    );

    this.aibitat.introspect?.("Running Torus integration.");
    const torus = await this.executeLensAgent(
      "@torus",
      `User query:\n${userQuery}\n\nCouncil inputs:\n[Watcher]\n${watcher}\n\n[Auditor]\n${auditor}\n\n[Synthesizer]\n${synthesizer}\n\nTask: Integrate these analyses topologically into a coherent synthesis with variance-aware confidence statements, blind spots, and 1-3 clarification questions.`
    );

    this.aibitat.introspect?.("Running Prism unification.");
    const prism = await this.executeLensAgent(
      "@prism",
      `User query:\n${userQuery}\n\nIntegrated inputs:\n[Watcher]\n${watcher}\n\n[Auditor]\n${auditor}\n\n[Synthesizer]\n${synthesizer}\n\n[Torus]\n${torus}\n\nTask: Produce one clear final response in a unified voice. Keep it concise but thorough. Include: integrated view, options, blind spots, and end with human clarification questions.`
    );

    this.aibitat.newMessage({
      from: "@prism",
      to: USER_AGENT.name,
      content: prism,
    });
    this.aibitat.terminate(USER_AGENT.name);
    return this.aibitat;
  }

  async #attachPlugins(args) {
    for (const name of this.#funcsToLoad) {
      // Load child plugin
      if (name.includes("#")) {
        const [parent, childPluginName] = name.split("#");
        if (!Object.prototype.hasOwnProperty.call(AgentPlugins, parent)) {
          this.log(
            `${parent} is not a valid plugin. Skipping inclusion to agent cluster.`
          );
          continue;
        }

        const childPlugin = AgentPlugins[parent].plugin.find(
          (child) => child.name === childPluginName
        );
        if (!childPlugin) {
          this.log(
            `${parent} does not have child plugin named ${childPluginName}. Skipping inclusion to agent cluster.`
          );
          continue;
        }

        const callOpts = this.parseCallOptions(
          args,
          childPlugin?.startupConfig?.params,
          name
        );
        this.aibitat.use(childPlugin.plugin(callOpts));
        this.log(
          `Attached ${parent}:${childPluginName} plugin to Agent cluster`
        );
        continue;
      }

      // Load flow plugin. This is marked by `@@flow_` in the array of functions to load.
      // Replace the @@flow_ placeholder in the agent's function list with the actual
      // tool name so the function lookup in reply() can find it.
      if (name.startsWith("@@flow_")) {
        const uuid = name.replace("@@flow_", "");
        const plugin = AgentFlows.loadFlowPlugin(uuid, this.aibitat);
        if (!plugin) {
          this.log(
            `Flow ${uuid} not found in flows directory. Skipping inclusion to agent cluster.`
          );
          continue;
        }

        this.replaceAgentFunctionReference(name, plugin.name);

        this.aibitat.use(plugin.plugin());
        this.log(
          `Attached flow ${plugin.name} (${plugin.flowName}) plugin to Agent cluster`
        );
        continue;
      }

      // Load MCP plugin. This is marked by `@@mcp_` in the array of functions to load.
      // All sub-tools are loaded here and are denoted by `pluginName:toolName` as their identifier.
      // This will replace the parent MCP server plugin with the sub-tools as child plugins so they
      // can be called directly by the agent when invoked.
      // Since to get to this point, the `activeMCPServers` method has already been called, we can
      // safely assume that the MCP server is running and the tools are available/loaded.
      if (name.startsWith("@@mcp_")) {
        const mcpPluginName = name.replace("@@mcp_", "");
        const plugins =
          await new MCPCompatibilityLayer().convertServerToolsToPlugins(
            mcpPluginName,
            this.aibitat
          );
        if (!plugins) {
          this.log(
            `MCP ${mcpPluginName} not found in MCP server config. Skipping inclusion to agent cluster.`
          );
          continue;
        }

        this.replaceAgentFunctionReference(
          name,
          plugins.map((plugin) => plugin.name)
        );

        plugins.forEach((plugin) => {
          this.aibitat.use(plugin.plugin());
          this.log(
            `Attached MCP::${plugin.toolName} MCP tool to Agent cluster`
          );
        });
        continue;
      }

      // Load imported plugin. This is marked by `@@` in the array of functions to load.
      // and is the @@hubID of the plugin.
      if (name.startsWith("@@")) {
        const hubId = name.replace("@@", "");
        const valid = ImportedPlugin.validateImportedPluginHandler(hubId);
        if (!valid) {
          this.log(
            `Imported plugin by hubId ${hubId} not found in plugin directory. Skipping inclusion to agent cluster.`
          );
          continue;
        }

        const plugin = ImportedPlugin.loadPluginByHubId(hubId);
        const callOpts = plugin.parseCallOptions();
        this.aibitat.use(plugin.plugin(callOpts));
        this.log(
          `Attached ${plugin.name} (${hubId}) imported plugin to Agent cluster`
        );
        continue;
      }

      // Load single-stage plugin.
      if (!Object.prototype.hasOwnProperty.call(AgentPlugins, name)) {
        this.log(
          `${name} is not a valid plugin. Skipping inclusion to agent cluster.`
        );
        continue;
      }

      const callOpts = this.parseCallOptions(
        args,
        AgentPlugins[name].startupConfig.params
      );
      const AIbitatPlugin = AgentPlugins[name];
      this.aibitat.use(AIbitatPlugin.plugin(callOpts));
      this.log(`Attached ${name} plugin to Agent cluster`);
    }
  }

  async #loadAgents() {
    // Default User agent and workspace agent
    this.log(`Attaching user and default agent to Agent cluster.`);
    const user = this.invocation.user_id
      ? await User.get({ id: Number(this.invocation.user_id) })
      : null;
    const userAgentDef = await USER_AGENT.getDefinition();
    const workspaceAgentDef = await WORKSPACE_AGENT.getDefinition(
      this.provider,
      this.invocation.workspace,
      user
    );
    const sharedFunctions = [...(workspaceAgentDef?.functions || [])];
    this.sharedFunctions = sharedFunctions;

    this.aibitat.agent(USER_AGENT.name, userAgentDef);
    this.aibitat.agent(WORKSPACE_AGENT.name, workspaceAgentDef);
    getLensAgentDefinitions(sharedFunctions).forEach(({ name, definition }) => {
      this.aibitat.agent(name, definition);
    });

    this.#funcsToLoad = [
      ...new Set([...(userAgentDef?.functions || []), ...sharedFunctions]),
    ];
  }

  async init() {
    await this.#validInvocation();
    this.#providerSetupAndCheck();
    return this;
  }

  async createAIbitat(
    args = {
      socket: null,
    }
  ) {
    this.aibitat = new AIbitat({
      provider: this.provider ?? "openai",
      model: this.model ?? "gpt-4o",
      chats: await this.#chatHistory(20),
      handlerProps: {
        invocation: this.invocation,
        log: this.log,
      },
    });

    // Attach standard websocket plugin for frontend communication.
    this.log(`Attached ${AgentPlugins.websocket.name} plugin to Agent cluster`);
    this.aibitat.use(
      AgentPlugins.websocket.plugin({
        socket: args.socket,
        muteUserReply: true,
        introspection: true,
      })
    );

    // Attach standard chat-history plugin for message storage.
    this.log(
      `Attached ${AgentPlugins.chatHistory.name} plugin to Agent cluster`
    );
    this.aibitat.use(AgentPlugins.chatHistory.plugin());

    // Load required agents (Default + custom)
    await this.#loadAgents();
    this.setInitialChannelFromPrompt(this.invocation.prompt);
    this.ensurePromptHandlesLoaded(this.invocation.prompt);

    // Attach all required plugins for functions to operate.
    await this.#attachPlugins(args);
  }

  startAgentCluster() {
    if (this.shouldRunMetacanonConstellation(this.invocation.prompt)) {
      return this.runMetacanonConstellation(this.invocation.prompt).catch(
        (error) => {
          this.log(
            `Constellation execution failed (${error.message}). Falling back to standard flow.`
          );
          this.aibitat.introspect?.(
            "Constellation fallback: continuing with standard routing."
          );
          return this.aibitat.start({
            from: USER_AGENT.name,
            to: this.channel ?? WORKSPACE_AGENT.name,
            content: this.invocation.prompt,
          });
        }
      );
    }

    if (this.shouldRunCouncilPack(this.invocation.prompt)) {
      return this.runCouncilPack(this.invocation.prompt).catch((error) => {
        this.log(
          `Council pack execution failed (${error.message}). Falling back to standard flow.`
        );
        this.aibitat.introspect?.(
          "Council pack fallback: continuing with standard routing."
        );
        return this.aibitat.start({
          from: USER_AGENT.name,
          to: this.channel ?? WORKSPACE_AGENT.name,
          content: this.invocation.prompt,
        });
      });
    }

    if (this.shouldRunLensDeliberation(this.invocation.prompt)) {
      return this.runLensDeliberation(this.invocation.prompt).catch((error) => {
        this.log(
          `Lens deliberation failed (${error.message}). Falling back to standard @agent flow.`
        );
        this.aibitat.introspect?.(
          "Lens deliberation fallback: continuing with standard @agent flow."
        );
        return this.aibitat.start({
          from: USER_AGENT.name,
          to: this.channel ?? WORKSPACE_AGENT.name,
          content: this.invocation.prompt,
        });
      });
    }

    return this.aibitat.start({
      from: USER_AGENT.name,
      to: this.channel ?? WORKSPACE_AGENT.name,
      content: this.invocation.prompt,
    });
  }
}

module.exports.AgentHandler = AgentHandler;
