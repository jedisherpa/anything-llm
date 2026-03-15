const invoke = window.__TAURI__?.tauri?.invoke;

const modeValue = document.getElementById("modeValue");
const startupPhaseValue = document.getElementById("startupPhaseValue");
const appUrlValue = document.getElementById("appUrlValue");
const storageValue = document.getElementById("storageValue");
const coreValue = document.getElementById("coreValue");
const logsValue = document.getElementById("logsValue");
const telemetryValue = document.getElementById("telemetryValue");
const subtitle = document.getElementById("subtitle");
const startupBanner = document.getElementById("startupBanner");
const startupBannerTitle = document.getElementById("startupBannerTitle");
const startupBannerMessage = document.getElementById("startupBannerMessage");
const startupBannerHint = document.getElementById("startupBannerHint");
const startupError = document.getElementById("startupError");
const progressFill = document.getElementById("progressFill");
const progressPercent = document.getElementById("progressPercent");
const progressLabel = document.getElementById("progressLabel");
const phaseLabel = document.getElementById("phaseLabel");
const openApplicationsBtn = document.getElementById("openApplicationsBtn");
const openLogsBtn = document.getElementById("openLogsBtn");
const DEFAULT_SUBTITLE = subtitle.textContent;

let progressValue = 12;
let redirectStarted = false;
let refreshTimer = null;

function friendlyModeLabel(mode) {
  switch (String(mode || "").toLowerCase()) {
    case "desktop":
      return "Prism Desktop";
    case "web":
      return "Browser Companion";
    default:
      return mode || "unknown";
  }
}

function friendlyTelemetryLabel(disabled) {
  return disabled ? "Off" : "On";
}

function friendlyStartupPhaseLabel(phase) {
  const normalized = String(phase || "").trim().toLowerCase();
  switch (normalized) {
    case "bootstrapping":
      return "Bootstrapping";
    case "validating_install":
      return "Validating install";
    case "preparing_database":
      return "Preparing database";
    case "starting_collector":
      return "Starting collector";
    case "starting_server":
      return "Starting server";
    case "waiting_for_interface":
      return "Waiting for interface";
    case "ready":
      return "Ready";
    case "attention":
      return "Needs attention";
    default:
      return phase || "unknown";
  }
}

function setProgress(value, label, phase) {
  progressValue = Math.max(progressValue, Math.min(100, value));
  progressFill.style.width = `${progressValue}%`;
  progressPercent.textContent = `${Math.round(progressValue)}%`;
  progressFill.parentElement?.setAttribute("aria-valuenow", String(Math.round(progressValue)));
  if (label) progressLabel.textContent = label;
  if (phase) phaseLabel.textContent = phase;
}

function baseProgressForStatus(status) {
  const mode = String(status?.mode || "").toLowerCase();
  if (status?.startup_error) {
    return {
      value: 66,
      label: "Prism paused while startup needs attention.",
      phase: "Waiting for intervention",
    };
  }

  if (mode === "web") {
    return {
      value: 34,
      label: "Standing by in browser companion mode.",
      phase: "Loader held open",
    };
  }

  switch (String(status?.startup_phase || "").toLowerCase()) {
    case "bootstrapping":
      return {
        value: 14,
        label: status?.startup_detail || "Initializing PrismAI.",
        phase: "Booting local shell",
      };
    case "validating_install":
      return {
        value: 24,
        label: status?.startup_detail || "Checking bundled runtime and local ports.",
        phase: "Validating install",
      };
    case "preparing_database":
      return {
        value: 42,
        label: status?.startup_detail || "Preparing local data.",
        phase: "Restoring workspace",
      };
    case "starting_collector":
      return {
        value: 56,
        label: status?.startup_detail || "Starting collector service.",
        phase: "Collector startup",
      };
    case "starting_server":
      return {
        value: 66,
        label: status?.startup_detail || "Starting PrismAI server.",
        phase: "Server startup",
      };
    case "waiting_for_interface":
      return {
        value: 78,
        label: status?.startup_detail || "Waiting for the interface handoff.",
        phase: "Checking UI root",
      };
    case "ready":
      return {
        value: 90,
        label: status?.startup_detail || "PrismAI is ready.",
        phase: "Handing off to workspace",
      };
  }

  return {
    value: 62,
    label: status?.startup_detail || "Local runtime online. Checking interface handoff...",
    phase: "Validating app shell",
  };
}

async function rootResponds(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
    });
    const text = await response.text();
    return response.ok && /<html/i.test(text) && !/^Not Found\s*$/i.test(text.trim());
  } catch {
    return false;
  }
}

async function beginDesktopRedirect(appUrl) {
  if (redirectStarted) return;
  redirectStarted = true;
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
  setProgress(82, "Prism interface located. Preparing handoff...", "Syncing desktop window");
  await new Promise((resolve) => window.setTimeout(resolve, 220));
  setProgress(92, "Opening PrismAI...", "Transferring into live workspace");
  await new Promise((resolve) => window.setTimeout(resolve, 180));
  setProgress(100, "PrismAI is ready.", "Entering workspace");
  await new Promise((resolve) => window.setTimeout(resolve, 140));
  window.location.replace(appUrl);
}

function describeStartupError(message) {
  const normalized = String(message || "").toLowerCase();
  const portMatch = String(message || "").match(/port\s+(\d+)/i);
  const portLabel = portMatch ? `port ${portMatch[1]}` : "a required local port";

  if (normalized.includes("failed to reserve virtual memory for coderange")) {
    return {
      title: "Bundled runtime could not start cleanly",
      message:
        "The embedded PrismAI runtime could not start its Node engine on this Mac. This usually means the app needs a build signed with the updated PrismAI Mac signing flow.",
      hint: "Install the latest rebuilt PrismAI app, then relaunch it from Applications.",
      showApplicationsButton: true,
    };
  }

  if (
    normalized.includes("mounted installer volume") ||
    (normalized.includes("launch it from there") && normalized.includes("/applications"))
  ) {
    return {
      title: "Install PrismAI to Applications first",
      message:
        "PrismAI is running from the installer disk image. Copy it into Applications before trying to start the local runtime.",
      hint: "Use Open Applications Folder, drag PrismAI.app there, then eject the disk image and relaunch from Applications.",
      showApplicationsButton: true,
    };
  }

  if (normalized.includes("already in use")) {
    return {
      title: "Local service conflict detected",
      message: `PrismAI could not finish startup because ${portLabel} is already being used.`,
      hint: "Close the older local PrismAI process or any other app using that port, then click Restart Prism.",
    };
  }

  if (normalized.includes("not reachable")) {
    return {
      title: "PrismAI interface did not come online",
      message:
        "The desktop shell started, but the local PrismAI interface never answered on the selected local port before the startup timeout.",
      hint: "Check the runtime details and startup logs shown below, then relaunch with the latest signed build if the server exited during startup.",
      showApplicationsButton: false,
    };
  }

  if (normalized.includes("exited during startup")) {
    return {
      title: "A PrismAI service exited during startup",
      message:
        "One of the bundled local services crashed before the desktop interface could come online.",
      hint: "Use the startup details below to identify whether the server or collector exited, then relaunch with the updated signed build.",
      showApplicationsButton: false,
    };
  }

  if (normalized.includes("window could not be presented")) {
    return {
      title: "Desktop window needs attention",
      message: "PrismAI started, but macOS did not present the Prism window cleanly.",
      hint: "If the window is behind another app, bring PrismAI to the front and try again.",
      showApplicationsButton: false,
    };
  }

  return {
    title: "Prism needs attention",
    message:
      "The loader stayed in startup mode instead of handing off to the full PrismAI workspace.",
    hint: "Use Refresh Status for the latest state, or Restart Prism after correcting the issue below.",
    showApplicationsButton: false,
  };
}

function showStartupError(message) {
  if (!message) {
    startupBanner.classList.add("hidden");
    startupBannerHint.textContent = "";
    startupError.classList.add("hidden");
    startupError.textContent = "";
    openApplicationsBtn.classList.add("hidden");
    subtitle.textContent = DEFAULT_SUBTITLE;
    return;
  }

  const description = describeStartupError(message);
  startupBanner.classList.remove("hidden");
  startupBannerTitle.textContent = description.title;
  startupBannerMessage.textContent = description.message;
  startupBannerHint.textContent = description.hint;
  startupError.classList.remove("hidden");
  startupError.textContent = message;
  openApplicationsBtn.classList.toggle(
    "hidden",
    !description.showApplicationsButton
  );
  subtitle.textContent = description.message;
}

async function refreshStatus() {
  if (!invoke) {
    showStartupError("The PrismAI desktop bridge is not available in this context.");
    setProgress(72, "Desktop bridge unavailable.", "Startup interrupted");
    return;
  }

  try {
    const status = await invoke("get_runtime_status");
    modeValue.textContent = friendlyModeLabel(status.mode);
    startupPhaseValue.textContent = friendlyStartupPhaseLabel(status.startup_phase);
    appUrlValue.textContent = status.app_url;
    storageValue.textContent = status.storage_dir;
    coreValue.textContent = status.core_dir;
    logsValue.textContent = status.logs_dir || "Unavailable";
    telemetryValue.textContent = friendlyTelemetryLabel(status.telemetry_disabled);
    showStartupError(status.startup_error);

    const base = baseProgressForStatus(status);
    setProgress(base.value, base.label, base.phase);

    if (!status.startup_error && String(status.mode).toLowerCase() === "desktop") {
      const uiReady = await rootResponds(status.app_url);
      if (uiReady) {
        await beginDesktopRedirect(status.app_url);
        return;
      }
      setProgress(74, "Local runtime online. Waiting for the interface to answer...", "Checking UI root");
    }
  } catch (error) {
    showStartupError(`Unable to load PrismAI status: ${String(error)}`);
    setProgress(70, "Unable to inspect startup status.", "Status request failed");
  }
}

async function runAction(label, fn) {
  subtitle.textContent = label;
  try {
    await fn();
  } catch (error) {
    subtitle.textContent = `${label} failed`;
    showStartupError(String(error));
  }
}

document.getElementById("openBrowserBtn").addEventListener("click", () =>
  runAction("Opening PrismAI in browser...", () => invoke("open_anythingllm_in_browser"))
);

document.getElementById("openApplicationsBtn").addEventListener("click", () =>
  runAction("Opening Applications folder...", () => invoke("open_applications_folder"))
);

document.getElementById("openLogsBtn").addEventListener("click", () =>
  runAction("Opening PrismAI logs...", () => invoke("open_logs_folder"))
);

document.getElementById("toDesktopBtn").addEventListener("click", () =>
  runAction("Switching to Prism Desktop and restarting...", () =>
    invoke("set_runtime_mode", { mode: "desktop" })
  )
);

document.getElementById("toWebBtn").addEventListener("click", () =>
  runAction("Switching to browser companion mode and restarting...", () =>
    invoke("set_runtime_mode", { mode: "web" })
  )
);

document.getElementById("restartBtn").addEventListener("click", () =>
  runAction("Restarting Prism...", () => invoke("restart_app"))
);

document.getElementById("refreshBtn").addEventListener("click", refreshStatus);

refreshStatus();
refreshTimer = window.setInterval(() => {
  if (!redirectStarted) refreshStatus();
}, 1200);
