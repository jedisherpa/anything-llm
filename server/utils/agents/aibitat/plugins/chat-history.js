const { WorkspaceChats } = require("../../../../models/workspaceChats");

/**
 * Plugin to save chat history to AnythingLLM DB.
 */
const chatHistory = {
  name: "chat-history",
  startupConfig: {
    params: {},
  },
  plugin: function () {
    return {
      name: this.name,
      setup: function (aibitat) {
        // Capture any deliberationComplete event emitted before the terminal message.
        // AgentHandler emits this on aibitat.emitter so we listen via the standard
        // aibitat event pattern rather than monkey-patching the socket.
        let _pendingDeliberationData = null;
        aibitat.emitter.on("deliberationComplete", (data) => {
          _pendingDeliberationData = data;
        });

        aibitat.onMessage(async () => {
          try {
            const lastResponses = aibitat.chats.slice(-2);
            if (lastResponses.length !== 2) return;
            const [prev, last] = lastResponses;

            // We need a full conversation reply with prev being from
            // the USER and the last being from anyone other than the user.
            if (prev.from !== "USER" || last.from === "USER") return;

            // Consume any pending deliberation data emitted before this terminal message.
            const deliberationData = _pendingDeliberationData;
            _pendingDeliberationData = null;

            // If we have a post-reply flow we should save the chat using this special flow
            // so that post save cleanup and other unique properties can be run as opposed to regular chat.
            if (aibitat.hasOwnProperty("_replySpecialAttributes")) {
              await this._storeSpecial(aibitat, {
                prompt: prev.content,
                response: last.content,
                options: aibitat._replySpecialAttributes,
                deliberationData,
              });
              delete aibitat._replySpecialAttributes;
              return;
            }

            await this._store(aibitat, {
              prompt: prev.content,
              response: last.content,
              deliberationData,
            });
          } catch {}
        });
      },
      _store: async function (aibitat, { prompt, response, deliberationData = null } = {}) {
        const invocation = aibitat.handlerProps.invocation;
        await WorkspaceChats.new({
          workspaceId: Number(invocation.workspace_id),
          prompt,
          response: {
            text: response,
            sources: [],
            type: "chat",
            ...(deliberationData ? { deliberationData } : {}),
          },
          user: { id: invocation?.user_id || null },
          threadId: invocation?.thread_id || null,
        });
      },
      _storeSpecial: async function (
        aibitat,
        { prompt, response, options = {}, deliberationData = null } = {}
      ) {
        const invocation = aibitat.handlerProps.invocation;
        await WorkspaceChats.new({
          workspaceId: Number(invocation.workspace_id),
          prompt,
          response: {
            sources: options?.sources ?? [],
            // when we have a _storeSpecial called the options param can include a storedResponse() function
            // that will override the text property to store extra information in, depending on the special type of chat.
            text: options.hasOwnProperty("storedResponse")
              ? options.storedResponse(response)
              : response,
            type: options?.saveAsType ?? "chat",
            ...(deliberationData ? { deliberationData } : {}),
          },
          user: { id: invocation?.user_id || null },
          threadId: invocation?.thread_id || null,
        });
        options?.postSave();
      },
    };
  },
};

module.exports = { chatHistory };
