const fs = require("node:fs");
const path = require("node:path");

const addonPath = path.join(__dirname, "metacanon_ai.node");

// Gracefully attempt to load the native addon — never throw at module scope.
// If the addon is absent or fails to load, exports degrade to no-ops and the
// Sphere Thread Coordinator (pure-JS) remains fully accessible.
let native = null;
try {
  if (fs.existsSync(addonPath)) {
    native = require(addonPath);
  }
} catch (err) {
  console.warn(`[MetaCanon Runtime] Native addon failed to load: ${err.message}`);
}

// Sphere Thread Coordinator is always available — it degrades gracefully when
// the native runtime is absent.
const {
  SphereThreadCoordinator,
  getSphereThreadCoordinator,
} = require("./sphere-thread");

module.exports = {
  // Spread native exports when available (camelCase Rust-binding names)
  ...(native || {}),
  // snake_case aliases — only populated when the native addon loaded
  ...(native
    ? {
        genesis_rite: native.genesisRite,
        validate_action: native.validateAction,
        validate_action_with_context: native.validateActionWithContext,
        validate_action_constitutional: native.validateActionConstitutional,
        log_event: native.logEvent,
        get_code_snippet: native.getCodeSnippet,
        get_will_vector: native.getWillVector,
        update_soul_file: native.updateSoulFile,
        get_compute_options: native.getComputeOptions,
        set_global_compute_provider: native.setGlobalComputeProvider,
        set_provider_priority: native.setProviderPriority,
        update_provider_config: native.updateProviderConfig,
        create_task_sub_sphere: native.createTaskSubSphere,
        get_sub_sphere_list: native.getSubSphereList,
        get_sub_sphere_status: native.getSubSphereStatus,
        pause_sub_sphere: native.pauseSubSphere,
        dissolve_sub_sphere: native.dissolveSubSphere,
        submit_sub_sphere_query: native.submitSubSphereQuery,
        approve_hitl_action: native.approveHitlAction,
        reject_hitl_action: native.rejectHitlAction,
        update_telegram_integration: native.updateTelegramIntegration,
        update_discord_integration: native.updateDiscordIntegration,
        bind_agent_route: native.bindAgentRoute,
        bind_sub_sphere_prism_route: native.bindSubSpherePrismRoute,
        send_agent_message: native.sendAgentMessage,
        send_sub_sphere_prism_message: native.sendSubSpherePrismMessage,
        get_communication_status: native.getCommunicationStatus,
      }
    : {}),
  // Sphere Thread Coordinator (singleton accessor) — always exported
  SphereThreadCoordinator,
  getSphereThreadCoordinator,
};
