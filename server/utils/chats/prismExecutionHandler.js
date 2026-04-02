const { v4: uuidv4 } = require("uuid");
const { WorkspaceChats } = require("../../models/workspaceChats");
const { writeResponseChunk } = require("../helpers/chat/responses");

const EXECUTION_ENGINE_CONFIG_ERROR =
  "Execute mode is not configured yet. Set PRISM_EXECUTION_ENGINE_URL or METACANON_ENGINE_URL to the sphere-thread-engine runtime and refresh execute status.";

function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function resolveExecutionEngineTarget() {
  const prismUrl = process.env.PRISM_EXECUTION_ENGINE_URL?.trim();
  if (prismUrl) {
    return {
      configured: true,
      baseUrl: normalizeBaseUrl(prismUrl),
      source: "PRISM_EXECUTION_ENGINE_URL",
      error: null,
    };
  }

  const legacyUrl = process.env.METACANON_ENGINE_URL?.trim();
  if (legacyUrl) {
    return {
      configured: true,
      baseUrl: normalizeBaseUrl(legacyUrl),
      source: "METACANON_ENGINE_URL",
      error: null,
    };
  }

  return {
    configured: false,
    baseUrl: null,
    source: null,
    error: EXECUTION_ENGINE_CONFIG_ERROR,
  };
}

function buildHeaders() {
  const headers = {
    "Content-Type": "application/json",
  };
  const controlKey = process.env.METACANON_CONTROL_API_KEY?.trim();
  if (controlKey) {
    headers["x-metacanon-key"] = controlKey;
  }
  return headers;
}

function buildEngineConnection(target, reachable, error = null) {
  return {
    configured: target.configured,
    reachable,
    base_url: target.baseUrl,
    source: target.source,
    error,
  };
}

function buildStatusFallback(target, error) {
  return {
    ok: true,
    summary: error,
    session: null,
    bridge: {
      ready: false,
      mode: "detached",
      commands_module_path: null,
      load_error: error,
      engine_url: target.baseUrl,
      engine_source: target.source,
      configured: target.configured,
    },
    demo_mode: null,
    versions: null,
    backends: [],
    execution_router: null,
    setup_checks: [
      {
        id: "execution_engine_url",
        label: "Execution engine URL",
        status: target.configured ? "ready" : "attention",
        detail: target.configured
          ? `Prism is targeting ${target.baseUrl} via ${target.source}.`
          : EXECUTION_ENGINE_CONFIG_ERROR,
      },
      {
        id: "execution_engine_reachability",
        label: "Execution engine reachability",
        status: target.configured ? "attention" : "optional",
        detail: error,
      },
    ],
    deliberation: null,
    backend_health_summary: target.configured
      ? "Execution engine is not currently reachable."
      : "Execution engine URL is not configured yet.",
    engine_connection: buildEngineConnection(target, false, error),
  };
}

function mergeStatusPayload(payload, target) {
  return {
    ...payload,
    bridge: {
      ...(payload?.bridge ?? {}),
      engine_url: target.baseUrl,
      engine_source: target.source,
      configured: target.configured,
    },
    engine_connection: buildEngineConnection(target, true, null),
  };
}

function formatExecutionApiError({ baseUrl, status, payload, operation }) {
  const explicitMessage = payload?.message || payload?.error;
  if (explicitMessage) {
    return explicitMessage;
  }

  if (status === 404) {
    return `Configured execute engine at ${baseUrl} responded, but the prism-execute routes were not found. Point Prism at the sphere-thread-engine runtime.`;
  }

  return `${operation} failed with status ${status} from ${baseUrl}.`;
}

function formatExecutionConnectionError(baseUrl, error) {
  const detail = error?.message || "Unknown connection error.";
  return `Unable to reach execute engine at ${baseUrl}: ${detail}`;
}

async function requestExecutionEngine(
  path,
  {
    method = "GET",
    body = null,
    operation = "Execute request",
    allowStatusFallback = false,
  } = {}
) {
  const target = resolveExecutionEngineTarget();
  if (!target.configured) {
    if (allowStatusFallback) {
      return { payload: buildStatusFallback(target, target.error), target };
    }
    throw new Error(target.error);
  }

  let response;
  try {
    response = await fetch(`${target.baseUrl}${path}`, {
      method,
      headers: buildHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const message = formatExecutionConnectionError(target.baseUrl, error);
    if (allowStatusFallback) {
      return { payload: buildStatusFallback(target, message), target };
    }
    throw new Error(message);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = formatExecutionApiError({
      baseUrl: target.baseUrl,
      status: response.status,
      payload,
      operation,
    });
    if (allowStatusFallback) {
      return { payload: buildStatusFallback(target, message), target };
    }
    throw new Error(message);
  }

  return { payload, target };
}

async function fetchExecutionSession({
  workspace,
  thread = null,
  message,
  trustedSessionId = null,
  executionContext = {},
}) {
  const selectedWorktreeRoot =
    executionContext?.selectedWorktreeRoot ||
    executionContext?.selected_worktree_root;
  if (!selectedWorktreeRoot || !String(selectedWorktreeRoot).trim()) {
    throw new Error("Execute mode requires a selected worktree root.");
  }

  const { payload } = await requestExecutionEngine(
    "/api/v1/runtime/prism-execute",
    {
      method: "POST",
      operation: "Execute mode",
      body: {
        workspace_slug: workspace.slug,
        chat_thread_slug: thread?.slug ?? null,
        prompt: message,
        trusted_session_id: trustedSessionId,
        execution_context: {
          selected_worktree_root: String(selectedWorktreeRoot).trim(),
        },
      },
    }
  );

  return payload;
}

async function fetchExecutionSessionAction({
  workspace,
  thread = null,
  trustedSessionId,
  action,
  pendingActionId = null,
  reason = null,
}) {
  if (!trustedSessionId || !String(trustedSessionId).trim()) {
    throw new Error("Execute session action requires a trusted session id.");
  }

  const { payload } = await requestExecutionEngine(
    "/api/v1/runtime/prism-execute/session-action",
    {
      method: "POST",
      operation: "Execute session action",
      body: {
        workspace_slug: workspace.slug,
        chat_thread_slug: thread?.slug ?? null,
        trusted_session_id: String(trustedSessionId).trim(),
        action,
        pending_action_id: pendingActionId,
        reason,
      },
    }
  );

  return payload;
}

async function fetchExecutionStatus({
  workspace,
  thread = null,
  trustedSessionId = null,
}) {
  const params = new URLSearchParams({
    workspace_slug: workspace.slug,
  });

  if (thread?.slug) {
    params.set("chat_thread_slug", thread.slug);
  }

  if (trustedSessionId && String(trustedSessionId).trim()) {
    params.set("trusted_session_id", String(trustedSessionId).trim());
  }

  const { payload, target } = await requestExecutionEngine(
    `/api/v1/runtime/prism-execute/status?${params.toString()}`,
    {
      method: "GET",
      operation: "Execute status",
      allowStatusFallback: true,
    }
  );

  if (!target.configured || payload?.engine_connection) {
    return payload;
  }

  return mergeStatusPayload(payload, target);
}

async function updateExecutionConfig({ demoModeEnabled }) {
  const { payload } = await requestExecutionEngine(
    "/api/v1/runtime/prism-execute/config",
    {
      method: "POST",
      operation: "Execute config update",
      body: {
        demo_mode_enabled: demoModeEnabled,
      },
    }
  );

  return payload;
}

async function streamExecution({
  response,
  workspace,
  message,
  user = null,
  thread = null,
  sessionId = null,
  attachments = [],
  trustedSessionId = null,
  executionContext = {},
}) {
  const uuid = uuidv4();
  const payload = await fetchExecutionSession({
    workspace,
    thread,
    message,
    trustedSessionId,
    executionContext,
  });

  const session = payload?.session ?? {};
  const executionResult = payload?.execution_result ?? {};
  const reusedSession = Boolean(payload?.reused_session);
  const nextTrustedSessionId = session?.trustedSessionId ?? trustedSessionId;
  const sessionExpiresAt = session?.expiresAt ?? null;
  const subSphereId = session?.subSphereId ?? null;
  const selectedWorktreeRoot = session?.selectedWorktreeRoot ?? null;
  const artifactRefs = Array.isArray(executionResult?.artifact_refs)
    ? executionResult.artifact_refs
    : [];
  const executionSteps = Array.isArray(executionResult?.execution_steps)
    ? executionResult.execution_steps
    : [];

  writeResponseChunk(response, {
    uuid,
    type: "statusResponse",
    textResponse: reusedSession
      ? `Trusted session reused for ${session.selectedWorktreeRoot}.`
      : `Trusted session opened for ${session.selectedWorktreeRoot}.`,
    close: false,
    error: false,
    trustedSessionId: nextTrustedSessionId,
    sessionExpiresAt,
    subSphereId,
    selectedWorktreeRoot,
    artifactRefs,
  });

  for (const step of executionSteps) {
    writeResponseChunk(response, {
      uuid,
      type: "statusResponse",
      textResponse: `${step.title}: ${step.detail}`,
      close: false,
      error: false,
      stepId: step.step_id,
      actionClass: step.action_class,
      requiresApproval: step.requires_approval,
      trustedSessionId: nextTrustedSessionId,
      sessionExpiresAt,
      subSphereId,
      selectedWorktreeRoot,
      artifactRefs: step.artifact_refs ?? [],
    });
  }

  if (executionResult?.pending_approval) {
    const pendingApprovalText =
      executionResult.pending_approval.reason ||
      "Execute mode is awaiting approval.";

    writeResponseChunk(response, {
      uuid,
      type: "statusResponse",
      textResponse: pendingApprovalText,
      close: false,
      error: false,
      actionClass: "approval",
      requiresApproval: true,
      trustedSessionId: nextTrustedSessionId,
      sessionExpiresAt,
      subSphereId,
      selectedWorktreeRoot,
      pendingActionId: executionResult.pending_approval.pending_action_id,
      artifactRefs,
    });

    await WorkspaceChats.new({
      workspaceId: workspace.id,
      prompt: String(message),
      response: {
        text: pendingApprovalText,
        sources: [],
        attachments,
        type: "statusResponse",
        execution: {
          executionMode: "execute",
          trustedSessionId: nextTrustedSessionId,
          sessionExpiresAt,
          subSphereId,
          selectedWorktreeRoot,
          artifactRefs,
          requiresApproval: true,
          pendingActionId: executionResult.pending_approval.pending_action_id,
        },
      },
      include: true,
      threadId: thread?.id || null,
      apiSessionId: sessionId,
      user,
    });
    return;
  }

  const finalText =
    executionResult?.final_deliverable_summary ||
    executionResult?.convergence_summary ||
    "Execute mode completed.";

  await WorkspaceChats.new({
    workspaceId: workspace.id,
    prompt: String(message),
    response: {
      text: finalText,
      sources: [],
      attachments,
      type: "chat",
      execution: {
        executionMode: "execute",
        trustedSessionId: nextTrustedSessionId,
        sessionExpiresAt,
        subSphereId,
        selectedWorktreeRoot,
        artifactRefs,
      },
    },
    include: true,
    threadId: thread?.id || null,
    apiSessionId: sessionId,
    user,
  });

  writeResponseChunk(response, {
    uuid,
    type: "textResponse",
    textResponse: finalText,
    close: true,
    error: false,
    trustedSessionId: nextTrustedSessionId,
    sessionExpiresAt,
    subSphereId,
    selectedWorktreeRoot,
    artifactRefs,
  });
}

async function applySessionAction({
  workspace,
  thread = null,
  trustedSessionId,
  action,
  pendingActionId = null,
  reason = null,
}) {
  return await fetchExecutionSessionAction({
    workspace,
    thread,
    trustedSessionId,
    action,
    pendingActionId,
    reason,
  });
}

module.exports.PrismExecutionHandler = {
  applySessionAction,
  getStatus: fetchExecutionStatus,
  updateConfig: updateExecutionConfig,
  streamExecution,
};
