function tauriInvoke() {
  return window?.__TAURI__?.tauri?.invoke || null;
}

function hasDesktopShellQueryFlag() {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("prism_shell") === "desktop";
  } catch {
    return false;
  }
}

export function isPrismDesktopShell() {
  return (
    typeof window !== "undefined" &&
    (typeof tauriInvoke() === "function" || hasDesktopShellQueryFlag())
  );
}

export async function getDesktopRuntimeStatus() {
  const invoke = tauriInvoke();
  if (!invoke) {
    return null;
  }

  try {
    return await invoke("get_runtime_status");
  } catch {
    return null;
  }
}

export async function setDesktopExecutionEngineUrl(url = "") {
  const invoke = tauriInvoke();
  if (!invoke) {
    return {
      success: false,
      unsupported: true,
      error: "Prism desktop runtime is not available.",
    };
  }

  try {
    const status = await invoke("set_execution_engine_url", { url });
    return { success: true, status };
  } catch (error) {
    return {
      success: false,
      error: error?.message || "Failed to save execute engine URL.",
    };
  }
}

export async function restartDesktopApp() {
  const invoke = tauriInvoke();
  if (!invoke) {
    return {
      success: false,
      unsupported: true,
      error: "Prism desktop runtime is not available.",
    };
  }

  try {
    await invoke("restart_app");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error?.message || "Failed to restart Prism desktop.",
    };
  }
}

export async function runDesktopDependencyAction(action = "") {
  const invoke = tauriInvoke();
  if (!invoke || !action) {
    return {
      success: false,
      unsupported: true,
      error: "Prism desktop runtime is not available.",
    };
  }

  try {
    const detail = await invoke("run_dependency_action", { action });
    return { success: true, detail };
  } catch (error) {
    return {
      success: false,
      error: error?.message || "Dependency action failed.",
    };
  }
}
