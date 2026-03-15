#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::ErrorKind,
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Output, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::{
    api::{path::app_data_dir, shell::open},
    CustomMenuItem, Manager, Menu, MenuItem, RunEvent, Submenu,
};

#[cfg(unix)]
use std::os::unix::fs::symlink;
#[cfg(windows)]
use std::os::windows::fs::symlink_file;

const SERVER_PORT_CANDIDATES: [u16; 3] = [3033, 3032, 3031];
const COLLECTOR_PORT: u16 = 8888;

const MODE_DESKTOP_MENU_ID: &str = "mode_desktop";
const MODE_WEB_MENU_ID: &str = "mode_web";
const OPEN_BROWSER_MENU_ID: &str = "open_browser";
const RESTART_APP_MENU_ID: &str = "restart_app";
const OPEN_SOURCE_LICENSES_MENU_ID: &str = "open_source_licenses";
const OPEN_SOURCE_WINDOW_LABEL: &str = "open_source_licenses";
const APPLICATIONS_FOLDER: &str = "/Applications";
const DATA_DIR_OVERRIDE_ENV: &str = "PRISMAI_DATA_DIR";
const DATA_DIR_OVERRIDE_ARG: &str = "--prismai-data-dir";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum RuntimeMode {
    Desktop,
    Web,
}

impl Default for RuntimeMode {
    fn default() -> Self {
        Self::Desktop
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RuntimeConfig {
    mode: RuntimeMode,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            mode: RuntimeMode::Desktop,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct RuntimeStatus {
    mode: RuntimeMode,
    app_url: String,
    storage_dir: String,
    core_dir: String,
    logs_dir: String,
    telemetry_disabled: bool,
    startup_phase: StartupPhase,
    startup_detail: Option<String>,
    startup_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct OpenSourceMetadata {
    product_name: String,
    version: String,
    repository_url: String,
    commit: String,
    dirty: bool,
}

#[derive(Debug, Clone, Serialize)]
struct OpenSourceDocument {
    id: String,
    title: String,
    path: String,
    body: String,
}

#[derive(Debug, Clone, Serialize)]
struct OpenSourceMaterials {
    project_name: String,
    upstream_version: String,
    upstream_commit: String,
    repository_url: String,
    documents: Vec<OpenSourceDocument>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
enum StartupPhase {
    Bootstrapping,
    ValidatingInstall,
    PreparingDatabase,
    StartingCollector,
    StartingServer,
    WaitingForInterface,
    Ready,
    Attention,
}

impl Default for StartupPhase {
    fn default() -> Self {
        Self::Bootstrapping
    }
}

struct ManagedChildren {
    server: Child,
    collector: Child,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RuntimeSecrets {
    jwt_secret: String,
    sig_key: String,
    sig_salt: String,
}

struct AppState {
    config_path: PathBuf,
    storage_dir: PathBuf,
    logs_dir: PathBuf,
    core_dir: PathBuf,
    node_bin: String,
    runtime_secrets: RuntimeSecrets,
    bootstrap_log_path: PathBuf,
    server_log_path: PathBuf,
    collector_log_path: PathBuf,
    server_port: Mutex<u16>,
    startup_phase: Mutex<StartupPhase>,
    startup_detail: Mutex<Option<String>>,
    startup_error: Mutex<Option<String>>,
    children: Mutex<Option<ManagedChildren>>,
}

impl AppState {
    fn bootstrap(app: &tauri::App) -> Result<Self, String> {
        let data_dir = resolve_data_dir(app)?;
        fs::create_dir_all(&data_dir)
            .map_err(|err| format!("Failed to create app data directory: {err}"))?;

        let storage_dir = data_dir.join("storage");
        let logs_dir = data_dir.join("logs");
        let collector_hotdir = data_dir.join("collector").join("hotdir");
        let collector_tmp_dir = data_dir.join("collector").join("storage").join("tmp");
        fs::create_dir_all(&storage_dir)
            .map_err(|err| format!("Failed to create storage directory: {err}"))?;
        fs::create_dir_all(&logs_dir)
            .map_err(|err| format!("Failed to create logs directory: {err}"))?;
        fs::create_dir_all(&collector_hotdir)
            .map_err(|err| format!("Failed to create collector hotdir: {err}"))?;
        fs::create_dir_all(&collector_tmp_dir)
            .map_err(|err| format!("Failed to create collector temp directory: {err}"))?;

        let config_path = data_dir.join("runtime-mode.json");
        if !config_path.exists() {
            write_runtime_config(&config_path, &RuntimeConfig::default())?;
        }

        let core_dir = resolve_core_dir(app)?;
        validate_core_dir(&core_dir)?;
        let node_bin = resolve_node_bin(app)?;
        let runtime_secrets = ensure_runtime_secrets(&data_dir)?;

        Ok(Self {
            config_path,
            storage_dir,
            logs_dir: logs_dir.clone(),
            core_dir,
            node_bin,
            runtime_secrets,
            bootstrap_log_path: logs_dir.join("bootstrap.log"),
            server_log_path: logs_dir.join("server.log"),
            collector_log_path: logs_dir.join("collector.log"),
            server_port: Mutex::new(default_server_port()),
            startup_phase: Mutex::new(StartupPhase::Bootstrapping),
            startup_detail: Mutex::new(Some("Initializing the PrismAI desktop shell.".to_string())),
            startup_error: Mutex::new(None),
            children: Mutex::new(None),
        })
    }

    fn get_runtime_mode(&self) -> RuntimeMode {
        read_runtime_config(&self.config_path).mode
    }

    fn set_runtime_mode(&self, mode: RuntimeMode) -> Result<(), String> {
        write_runtime_config(&self.config_path, &RuntimeConfig { mode })
    }

    fn set_startup_error(&self, error: Option<String>) {
        if let Ok(mut guard) = self.startup_error.lock() {
            *guard = error;
        }
    }

    fn set_startup_phase(&self, phase: StartupPhase, detail: Option<String>) {
        if let Ok(mut guard) = self.startup_phase.lock() {
            *guard = phase;
        }
        if let Ok(mut guard) = self.startup_detail.lock() {
            *guard = detail;
        }
    }

    fn server_port(&self) -> u16 {
        self.server_port
            .lock()
            .map(|guard| *guard)
            .unwrap_or_else(|_| default_server_port())
    }

    fn set_server_port(&self, port: u16) {
        if let Ok(mut guard) = self.server_port.lock() {
            *guard = port;
        }
    }

    fn get_runtime_status(&self) -> RuntimeStatus {
        let startup_phase = self
            .startup_phase
            .lock()
            .map(|guard| (*guard).clone())
            .unwrap_or_default();
        let startup_detail = self
            .startup_detail
            .lock()
            .ok()
            .and_then(|guard| (*guard).clone());
        let startup_error = self
            .startup_error
            .lock()
            .ok()
            .and_then(|guard| (*guard).clone());

        RuntimeStatus {
            mode: self.get_runtime_mode(),
            app_url: app_url_for_port(self.server_port()),
            storage_dir: self.storage_dir.display().to_string(),
            core_dir: self.core_dir.display().to_string(),
            logs_dir: self.logs_dir.display().to_string(),
            telemetry_disabled: true,
            startup_phase,
            startup_detail,
            startup_error,
        }
    }

    fn start_services(&self) -> Result<(), String> {
        self.stop_services();
        self.set_startup_error(None);
        self.set_startup_phase(
            StartupPhase::ValidatingInstall,
            Some("Checking bundled runtime files, local ports, and log surfaces.".to_string()),
        );
        reset_log_file(&self.bootstrap_log_path)?;
        reset_log_file(&self.server_log_path)?;
        reset_log_file(&self.collector_log_path)?;
        cleanup_orphan_processes(&self.core_dir);
        let server_port = select_server_port(Duration::from_secs(10))?;
        self.set_server_port(server_port);
        wait_for_port_available(
            COLLECTOR_PORT,
            "PrismAI collector",
            "Close the existing process using port 8888 and relaunch PrismAI.",
            Duration::from_secs(10),
        )?;

        self.set_startup_phase(
            StartupPhase::PreparingDatabase,
            Some(
                "Preparing the local AnythingLLM database and restoring runtime state.".to_string(),
            ),
        );
        ensure_runtime_database(
            &self.core_dir,
            &self.storage_dir,
            &self.node_bin,
            &self.bootstrap_log_path,
        )?;
        self.set_startup_phase(
            StartupPhase::StartingCollector,
            Some("Starting the local PrismAI collector service.".to_string()),
        );
        let collector = spawn_collector(
            &self.core_dir,
            &self.storage_dir,
            &self.node_bin,
            &self.collector_log_path,
        )?;
        self.set_startup_phase(
            StartupPhase::StartingServer,
            Some(format!(
                "Starting the PrismAI server on {}.",
                app_url_for_port(server_port)
            )),
        );
        let server = spawn_server(
            &self.core_dir,
            &self.storage_dir,
            &self.node_bin,
            &self.runtime_secrets,
            server_port,
            &self.server_log_path,
        )?;

        let mut guard = self
            .children
            .lock()
            .map_err(|_| "Failed to lock process manager state.".to_string())?;
        *guard = Some(ManagedChildren { server, collector });
        self.set_startup_phase(
            StartupPhase::WaitingForInterface,
            Some(format!(
                "Waiting for the PrismAI interface to answer on {}.",
                app_url_for_port(server_port)
            )),
        );
        Ok(())
    }

    fn detect_startup_failure(&self) -> Option<String> {
        let mut failures = Vec::new();
        let mut guard = self.children.lock().ok()?;
        let children = guard.as_mut()?;

        if let Ok(Some(status)) = children.server.try_wait() {
            failures.push(format_child_failure(
                "PrismAI server",
                status.code(),
                &self.server_log_path,
            ));
        }

        if let Ok(Some(status)) = children.collector.try_wait() {
            failures.push(format_child_failure(
                "PrismAI collector",
                status.code(),
                &self.collector_log_path,
            ));
        }

        if failures.is_empty() {
            None
        } else {
            Some(failures.join("\n\n"))
        }
    }

    fn recent_runtime_summary(&self) -> String {
        let mut sections = Vec::new();

        for (label, path) in [
            ("Bootstrap log", &self.bootstrap_log_path),
            ("Server log", &self.server_log_path),
            ("Collector log", &self.collector_log_path),
        ] {
            let excerpt = read_log_excerpt(path);
            if !excerpt.is_empty() {
                sections.push(format!("{label}: {excerpt}"));
            }
        }

        sections.join("\n\n")
    }

    fn stop_services(&self) {
        if let Ok(mut guard) = self.children.lock() {
            if let Some(children) = guard.as_mut() {
                terminate_child("server", &mut children.server);
                terminate_child("collector", &mut children.collector);
            }
            *guard = None;
        }
    }
}

fn desktop_data_dir_override() -> Option<PathBuf> {
    if let Ok(value) = std::env::var(DATA_DIR_OVERRIDE_ENV) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Some(PathBuf::from(trimmed));
        }
    }

    let mut args = std::env::args().peekable();
    while let Some(arg) = args.next() {
        if arg == DATA_DIR_OVERRIDE_ARG {
            if let Some(value) = args.next() {
                let trimmed = value.trim();
                if !trimmed.is_empty() {
                    return Some(PathBuf::from(trimmed));
                }
            }
            continue;
        }

        if let Some(value) = arg.strip_prefix(&format!("{DATA_DIR_OVERRIDE_ARG}=")) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Some(PathBuf::from(trimmed));
            }
        }
    }

    None
}

fn resolve_data_dir(app: &tauri::App) -> Result<PathBuf, String> {
    if let Some(path) = desktop_data_dir_override() {
        return Ok(path);
    }

    app_data_dir(&app.config()).ok_or_else(|| "Unable to resolve app data directory.".to_string())
}

#[tauri::command]
fn get_runtime_status(state: tauri::State<'_, AppState>) -> RuntimeStatus {
    state.get_runtime_status()
}

#[tauri::command]
fn set_runtime_mode(
    mode: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let mode = parse_runtime_mode(&mode)?;
    state.set_runtime_mode(mode)?;
    restart_application(&app)
}

#[tauri::command]
fn open_anythingllm_in_browser(app: tauri::AppHandle) -> Result<(), String> {
    open_app_in_browser(&app)
}

#[tauri::command]
fn open_applications_folder(app: tauri::AppHandle) -> Result<(), String> {
    open(&app.shell_scope(), APPLICATIONS_FOLDER.to_string(), None)
        .map_err(|err| format!("Failed to open Applications folder: {err}"))
}

#[tauri::command]
fn open_logs_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    open(
        &app.shell_scope(),
        state.logs_dir.display().to_string(),
        None,
    )
    .map_err(|err| format!("Failed to open PrismAI logs folder: {err}"))
}

#[tauri::command]
fn get_open_source_materials(state: tauri::State<'_, AppState>) -> Result<OpenSourceMaterials, String> {
    resolve_open_source_materials(&state)
}

#[tauri::command]
fn open_open_source_document(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let materials = resolve_open_source_materials(&state)?;
    let document = materials
        .documents
        .into_iter()
        .find(|document| document.id == id)
        .ok_or_else(|| format!("Unknown open source document id: {id}"))?;

    if document.path.is_empty() {
        return Err("The requested document is generated in-memory for development and has no bundled file path.".to_string());
    }

    open(&app.shell_scope(), document.path, None)
        .map_err(|err| format!("Failed to open bundled open source document: {err}"))
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    restart_application(&app)
}

fn parse_runtime_mode(mode: &str) -> Result<RuntimeMode, String> {
    match mode.trim().to_lowercase().as_str() {
        "desktop" => Ok(RuntimeMode::Desktop),
        "web" => Ok(RuntimeMode::Web),
        _ => Err(format!(
            "Unsupported mode '{mode}'. Valid values: desktop, web."
        )),
    }
}

fn build_app_menu() -> Menu {
    let desktop_mode = CustomMenuItem::new(MODE_DESKTOP_MENU_ID, "Switch to Desktop Mode");
    let web_mode = CustomMenuItem::new(MODE_WEB_MENU_ID, "Switch to Web Mode");
    let open_browser_item = CustomMenuItem::new(OPEN_BROWSER_MENU_ID, "Open in Browser");
    let restart_item = CustomMenuItem::new(RESTART_APP_MENU_ID, "Restart App");
    let open_source_item =
        CustomMenuItem::new(OPEN_SOURCE_LICENSES_MENU_ID, "Open Source Licenses");

    let mode_submenu = Submenu::new(
        "Mode",
        Menu::new().add_item(desktop_mode).add_item(web_mode),
    );

    let help_submenu = Submenu::new(
        "Help",
        Menu::new()
            .add_item(open_browser_item)
            .add_item(open_source_item),
    );

    Menu::new()
        .add_submenu(mode_submenu)
        .add_submenu(help_submenu)
        .add_native_item(MenuItem::Separator)
        .add_item(restart_item)
        .add_native_item(MenuItem::Quit)
}

fn handle_menu_event(app: &tauri::AppHandle, menu_id: &str) -> Result<(), String> {
    match menu_id {
        MODE_DESKTOP_MENU_ID => {
            let state = app.state::<AppState>();
            state.set_runtime_mode(RuntimeMode::Desktop)?;
            restart_application(app)
        }
        MODE_WEB_MENU_ID => {
            let state = app.state::<AppState>();
            state.set_runtime_mode(RuntimeMode::Web)?;
            restart_application(app)
        }
        OPEN_BROWSER_MENU_ID => open_app_in_browser(app),
        OPEN_SOURCE_LICENSES_MENU_ID => open_open_source_window(app),
        RESTART_APP_MENU_ID => restart_application(app),
        _ => Ok(()),
    }
}

fn open_app_in_browser(app: &tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    open(
        &app.shell_scope(),
        app_url_for_port(state.server_port()),
        None,
    )
    .map_err(|err| format!("Failed to open browser: {err}"))
}

fn open_open_source_window(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_window(OPEN_SOURCE_WINDOW_LABEL) {
        window
            .show()
            .map_err(|err| format!("Failed to show the open source licenses window: {err}"))?;
        window
            .set_focus()
            .map_err(|err| format!("Failed to focus the open source licenses window: {err}"))?;
        return Ok(());
    }

    tauri::WindowBuilder::new(
        app,
        OPEN_SOURCE_WINDOW_LABEL,
        tauri::WindowUrl::App("legal.html".into()),
    )
    .title("PrismAI Open Source Licenses")
    .inner_size(1060.0, 780.0)
    .min_inner_size(760.0, 560.0)
    .resizable(true)
    .build()
    .map(|_| ())
    .map_err(|err| format!("Failed to build the open source licenses window: {err}"))
}

fn restart_application(app: &tauri::AppHandle) -> Result<(), String> {
    let current_exe = std::env::current_exe()
        .map_err(|err| format!("Could not resolve current executable: {err}"))?;
    Command::new(current_exe)
        .spawn()
        .map_err(|err| format!("Failed to spawn app restart process: {err}"))?;
    app.exit(0);
    Ok(())
}

fn launch_from_installer_volume_message() -> Result<Option<String>, String> {
    let current_exe = std::env::current_exe()
        .map_err(|err| format!("Could not resolve current executable: {err}"))?;
    let normalized = current_exe
        .canonicalize()
        .unwrap_or(current_exe)
        .to_string_lossy()
        .replace('\\', "/");

    if normalized.starts_with("/Volumes/") {
        return Ok(Some(format!(
            "PrismAI is running from a mounted installer volume.\n\nDrag PrismAI.app into {APPLICATIONS_FOLDER}, launch it from there, then eject the PrismAI disk image."
        )));
    }

    Ok(None)
}

fn bundled_runtime_root(app: &tauri::App) -> Option<PathBuf> {
    let resolver = app.path_resolver();
    [
        resolver.resolve_resource("runtime"),
        resolver.resolve_resource("_up_/runtime"),
        resolver.resource_dir().map(|dir| dir.join("runtime")),
        resolver
            .resource_dir()
            .map(|dir| dir.join("_up_").join("runtime")),
    ]
    .into_iter()
    .flatten()
    .find(|path| path.exists())
}

fn default_server_port() -> u16 {
    SERVER_PORT_CANDIDATES[0]
}

fn app_url_for_port(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

fn resolve_core_dir(app: &tauri::App) -> Result<PathBuf, String> {
    if let Ok(override_path) = std::env::var("ANYTHINGLLM_CORE_DIR") {
        let candidate = PathBuf::from(&override_path);
        if candidate.exists() {
            return Ok(candidate);
        }
        return Err(format!(
            "ANYTHINGLLM_CORE_DIR does not exist: {}",
            candidate.display()
        ));
    }

    if let Some(runtime_root) = bundled_runtime_root(app) {
        let bundled_core_dir = runtime_root.join("core");
        if bundled_core_dir.exists() {
            return Ok(bundled_core_dir
                .canonicalize()
                .unwrap_or_else(|_| bundled_core_dir.to_path_buf()));
        }
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let desktop_dir = manifest_dir
        .parent()
        .ok_or_else(|| "Unable to resolve desktop-tauri directory.".to_string())?;
    let core_dir = desktop_dir
        .parent()
        .ok_or_else(|| "Unable to resolve the PrismAI core directory.".to_string())?;

    Ok(core_dir
        .canonicalize()
        .unwrap_or_else(|_| core_dir.to_path_buf()))
}

fn resolve_node_bin(app: &tauri::App) -> Result<String, String> {
    if let Ok(override_path) = std::env::var("ANYTHINGLLM_NODE_BIN") {
        let candidate = PathBuf::from(&override_path);
        if candidate.exists() {
            return Ok(candidate.display().to_string());
        }
        return Err(format!(
            "ANYTHINGLLM_NODE_BIN does not exist: {}",
            candidate.display()
        ));
    }

    if let Some(runtime_root) = bundled_runtime_root(app) {
        let bundled_node = runtime_root.join("bin").join("node");
        if bundled_node.exists() {
            return Ok(bundled_node
                .canonicalize()
                .unwrap_or_else(|_| bundled_node.to_path_buf())
                .display()
                .to_string());
        }
    }

    Ok("node".to_string())
}

fn random_secret(length: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}

fn ensure_runtime_secrets(data_dir: &Path) -> Result<RuntimeSecrets, String> {
    let secrets_path = data_dir.join("runtime-secrets.json");

    if secrets_path.exists() {
        let content = fs::read_to_string(&secrets_path)
            .map_err(|err| format!("Failed to read runtime secrets: {err}"))?;
        return serde_json::from_str(&content)
            .map_err(|err| format!("Failed to parse runtime secrets: {err}"));
    }

    let secrets = RuntimeSecrets {
        jwt_secret: random_secret(48),
        sig_key: random_secret(64),
        sig_salt: random_secret(64),
    };
    let content = serde_json::to_string_pretty(&secrets)
        .map_err(|err| format!("Failed to serialize runtime secrets: {err}"))?;
    fs::write(&secrets_path, content)
        .map_err(|err| format!("Failed to persist runtime secrets: {err}"))?;
    Ok(secrets)
}

fn validate_core_dir(core_dir: &Path) -> Result<(), String> {
    let required_files = [
        ("server/index.js", core_dir.join("server").join("index.js")),
        (
            "collector/index.js",
            core_dir.join("collector").join("index.js"),
        ),
        (
            "server/public/index.js",
            core_dir.join("server").join("public").join("index.js"),
        ),
        (
            "server/public/index.css",
            core_dir.join("server").join("public").join("index.css"),
        ),
    ];

    for (label, target) in required_files {
        if !target.exists() {
            return Err(format!(
                "Missing required core file: {label}. Run `npm run prepare:core` from desktop-tauri."
            ));
        }
    }

    Ok(())
}

fn resolve_packaged_open_source_dir(state: &AppState) -> Option<PathBuf> {
    state
        .core_dir
        .parent()
        .map(|root| root.join("OpenSource").join("AnythingLLM"))
        .filter(|path| path.exists())
}

fn load_open_source_metadata_from_package(path: &Path) -> Option<OpenSourceMetadata> {
    let metadata_path = path.join("metadata.json");
    let content = fs::read_to_string(metadata_path).ok()?;
    serde_json::from_str(&content).ok()
}

fn load_fallback_open_source_metadata(core_dir: &Path) -> OpenSourceMetadata {
    let package_path = core_dir.join("package.json");
    let mut metadata = OpenSourceMetadata {
        product_name: "anything-llm".to_string(),
        version: "unknown".to_string(),
        repository_url: "https://github.com/mintplex-labs/anything-llm".to_string(),
        commit: "unknown".to_string(),
        dirty: false,
    };

    if let Ok(content) = fs::read_to_string(&package_path) {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(name) = value.get("name").and_then(|value| value.as_str()) {
                metadata.product_name = name.to_string();
            }
            if let Some(version) = value.get("version").and_then(|value| value.as_str()) {
                metadata.version = version.to_string();
            }
            if let Some(repository_url) = value
                .get("repository")
                .and_then(|value| value.get("url"))
                .and_then(|value| value.as_str())
            {
                metadata.repository_url = repository_url.to_string();
            }
        }
    }

    if let Ok(output) = Command::new("git")
        .arg("-C")
        .arg(core_dir)
        .arg("rev-parse")
        .arg("HEAD")
        .output()
    {
        if output.status.success() {
            metadata.commit = String::from_utf8_lossy(&output.stdout).trim().to_string();
        }
    }

    if let Ok(output) = Command::new("git")
        .arg("-C")
        .arg(core_dir)
        .arg("status")
        .arg("--porcelain")
        .output()
    {
        if output.status.success() {
            metadata.dirty = !String::from_utf8_lossy(&output.stdout).trim().is_empty();
        }
    }

    metadata
}

fn generated_notice(metadata: &OpenSourceMetadata) -> String {
    format!(
        "PrismAI Open Source Notice\n\nPrismAI is a modified distribution of AnythingLLM ({version}) made available under the MIT License.\nUpstream project: {repo}\nSource commit used for this packaged release: {commit}{dirty}\n\nThe original upstream LICENSE and README are bundled alongside this notice in packaged builds.",
        version = metadata.version,
        repo = metadata.repository_url,
        commit = metadata.commit,
        dirty = if metadata.dirty {
            " (dirty working tree)"
        } else {
            ""
        }
    )
}

fn resolve_open_source_materials(state: &AppState) -> Result<OpenSourceMaterials, String> {
    let packaged_dir = resolve_packaged_open_source_dir(state);
    let metadata = packaged_dir
        .as_ref()
        .and_then(|path| load_open_source_metadata_from_package(path))
        .unwrap_or_else(|| load_fallback_open_source_metadata(&state.core_dir));

    let notice_path = packaged_dir
        .as_ref()
        .map(|path| path.join("NOTICE-PrismAI.md"))
        .filter(|path| path.exists());
    let license_path = packaged_dir
        .as_ref()
        .map(|path| path.join("LICENSE"))
        .filter(|path| path.exists())
        .or_else(|| {
            let path = state.core_dir.join("LICENSE");
            path.exists().then_some(path)
        });
    let readme_path = packaged_dir
        .as_ref()
        .map(|path| path.join("README.md"))
        .filter(|path| path.exists())
        .or_else(|| {
            let path = state.core_dir.join("README.md");
            path.exists().then_some(path)
        });

    let documents = vec![
        OpenSourceDocument {
            id: "notice".to_string(),
            title: "PrismAI Notice".to_string(),
            path: notice_path
                .as_ref()
                .map(|path| path.display().to_string())
                .unwrap_or_default(),
            body: notice_path
                .as_ref()
                .and_then(|path| fs::read_to_string(path).ok())
                .unwrap_or_else(|| generated_notice(&metadata)),
        },
        OpenSourceDocument {
            id: "license".to_string(),
            title: "AnythingLLM MIT License".to_string(),
            path: license_path
                .as_ref()
                .map(|path| path.display().to_string())
                .unwrap_or_default(),
            body: license_path
                .as_ref()
                .and_then(|path| fs::read_to_string(path).ok())
                .unwrap_or_else(|| "LICENSE file unavailable.".to_string()),
        },
        OpenSourceDocument {
            id: "readme".to_string(),
            title: "AnythingLLM README".to_string(),
            path: readme_path
                .as_ref()
                .map(|path| path.display().to_string())
                .unwrap_or_default(),
            body: readme_path
                .as_ref()
                .and_then(|path| fs::read_to_string(path).ok())
                .unwrap_or_else(|| "README file unavailable.".to_string()),
        },
    ];

    Ok(OpenSourceMaterials {
        project_name: "AnythingLLM".to_string(),
        upstream_version: metadata.version,
        upstream_commit: format!(
            "{}{}",
            metadata.commit,
            if metadata.dirty {
                " (dirty working tree)"
            } else {
                ""
            }
        ),
        repository_url: metadata.repository_url,
        documents,
    })
}

fn read_runtime_config(config_path: &Path) -> RuntimeConfig {
    let data = match fs::read_to_string(config_path) {
        Ok(data) => data,
        Err(_) => return RuntimeConfig::default(),
    };

    serde_json::from_str(&data).unwrap_or_default()
}

fn write_runtime_config(config_path: &Path, config: &RuntimeConfig) -> Result<(), String> {
    let content = serde_json::to_string_pretty(config)
        .map_err(|err| format!("Failed to serialize runtime config: {err}"))?;
    fs::write(config_path, content).map_err(|err| format!("Failed to write runtime config: {err}"))
}

fn wait_for_server_ready(state: &AppState, timeout: Duration) -> Result<(), String> {
    let server_port = state.server_port();
    let app_url = app_url_for_port(server_port);
    let started = Instant::now();
    while started.elapsed() <= timeout {
        if TcpStream::connect(("127.0.0.1", server_port)).is_ok() {
            state.set_startup_phase(
                StartupPhase::Ready,
                Some(format!("PrismAI is ready at {app_url}.")),
            );
            return Ok(());
        }

        if let Some(error) = state.detect_startup_failure() {
            return Err(error);
        }

        thread::sleep(Duration::from_millis(300));
    }

    let recent_summary = state.recent_runtime_summary();
    if recent_summary.is_empty() {
        return Err(format!(
            "PrismAI was not reachable at {} within {} seconds.",
            app_url,
            timeout.as_secs()
        ));
    }

    Err(format!(
        "PrismAI was not reachable at {} within {} seconds.\n\n{}",
        app_url,
        timeout.as_secs(),
        recent_summary
    ))
}

fn port_bind_conflicts(port: u16) -> Vec<String> {
    let mut conflicts = Vec::new();

    for address in ["127.0.0.1", "::1"] {
        match TcpListener::bind((address, port)) {
            Ok(listener) => drop(listener),
            Err(error) => {
                if address == "::1"
                    && matches!(
                        error.kind(),
                        ErrorKind::AddrNotAvailable
                            | ErrorKind::Unsupported
                            | ErrorKind::InvalidInput
                    )
                {
                    continue;
                }
                conflicts.push(format!("{address}: {error}"));
            }
        }
    }

    conflicts
}

fn wait_for_port_available(
    port: u16,
    service_name: &str,
    recovery_hint: &str,
    timeout: Duration,
) -> Result<(), String> {
    let started = Instant::now();
    let mut last_conflicts = Vec::new();

    while started.elapsed() <= timeout {
        let conflicts = port_bind_conflicts(port);
        if conflicts.is_empty() {
            return Ok(());
        }
        last_conflicts = conflicts;
        thread::sleep(Duration::from_millis(250));
    }

    Err(format!(
        "{service_name} could not start because port {port} is already in use. {recovery_hint} ({})",
        last_conflicts.join("; ")
    ))
}

fn select_server_port(timeout: Duration) -> Result<u16, String> {
    let started = Instant::now();
    let mut last_busy_ports = Vec::new();

    while started.elapsed() <= timeout {
        let mut busy_ports = Vec::new();
        for port in SERVER_PORT_CANDIDATES {
            if port_bind_conflicts(port).is_empty() {
                return Ok(port);
            }
            busy_ports.push(port);
        }
        last_busy_ports = busy_ports;
        thread::sleep(Duration::from_millis(250));
    }

    Err(format!(
        "PrismAI server could not start because all preferred ports are already in use. Close the existing process using ports {} and relaunch PrismAI.",
        last_busy_ports
            .iter()
            .map(u16::to_string)
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

fn cleanup_orphan_processes(core_dir: &Path) {
    #[cfg(unix)]
    for (port, expected_cwd) in SERVER_PORT_CANDIDATES
        .into_iter()
        .map(|port| (port, core_dir.join("server")))
        .chain(std::iter::once((
            COLLECTOR_PORT,
            core_dir.join("collector"),
        )))
    {
        for pid in listening_pids_for_port(port) {
            if process_cwd_matches(pid, &expected_cwd) {
                terminate_pid(pid);
            }
        }
    }

    thread::sleep(Duration::from_millis(300));
}

#[cfg(unix)]
fn listening_pids_for_port(port: u16) -> Vec<u32> {
    let output = match Command::new("lsof")
        .arg(format!("-tiTCP:{port}"))
        .arg("-sTCP:LISTEN")
        .output()
    {
        Ok(output) if output.status.success() => output,
        _ => return Vec::new(),
    };

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().parse::<u32>().ok())
        .collect()
}

#[cfg(unix)]
fn process_cwd_matches(pid: u32, expected_cwd: &Path) -> bool {
    let output = match Command::new("lsof")
        .arg("-a")
        .arg("-p")
        .arg(pid.to_string())
        .arg("-d")
        .arg("cwd")
        .output()
    {
        Ok(output) if output.status.success() => output,
        _ => return false,
    };

    let expected = expected_cwd.to_string_lossy();
    String::from_utf8_lossy(&output.stdout).contains(expected.as_ref())
}

#[cfg(unix)]
fn terminate_pid(pid: u32) {
    let _ = Command::new("kill")
        .arg("-TERM")
        .arg(pid.to_string())
        .output();

    let started = Instant::now();
    while started.elapsed() <= Duration::from_secs(2) {
        if !process_exists(pid) {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }

    let _ = Command::new("kill")
        .arg("-KILL")
        .arg(pid.to_string())
        .output();
}

#[cfg(unix)]
fn process_exists(pid: u32) -> bool {
    Command::new("kill")
        .arg("-0")
        .arg(pid.to_string())
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn present_main_window(window: &tauri::Window, state: &AppState) {
    let mut presentation_errors = Vec::new();

    if let Err(error) = window.center() {
        presentation_errors.push(format!("center failed: {error}"));
    }
    if let Err(error) = window.show() {
        presentation_errors.push(format!("show failed: {error}"));
    }
    if let Err(error) = window.unminimize() {
        presentation_errors.push(format!("unminimize failed: {error}"));
    }
    if let Err(error) = window.set_focus() {
        presentation_errors.push(format!("focus failed: {error}"));
    }

    if !presentation_errors.is_empty() {
        state.set_startup_error(Some(format!(
            "PrismAI started, but the desktop window could not be presented cleanly: {}",
            presentation_errors.join("; ")
        )));
    }
}

fn sqlite_database_url(db_path: &Path) -> String {
    let normalized = db_path.to_string_lossy().replace('\\', "/");
    if normalized.starts_with('/') {
        format!("file://{normalized}")
    } else {
        format!("file:///{normalized}")
    }
}

fn sqlite_alias_root() -> PathBuf {
    #[cfg(unix)]
    {
        PathBuf::from("/tmp").join("anythingllm-sovereign-desktop")
    }

    #[cfg(not(unix))]
    {
        std::env::temp_dir().join("anythingllm-sovereign-desktop")
    }
}

fn ensure_database_alias(storage_dir: &Path) -> Result<PathBuf, String> {
    let target = storage_dir.join("anythingllm.db");
    if !target.exists() {
        fs::File::create(&target)
            .map_err(|err| format!("Failed to create desktop database file: {err}"))?;
    }
    let alias_root = sqlite_alias_root();
    fs::create_dir_all(&alias_root)
        .map_err(|err| format!("Failed to create database alias directory: {err}"))?;

    let alias_path = alias_root.join("anythingllm.db");
    if let Ok(metadata) = fs::symlink_metadata(&alias_path) {
        let should_replace = if metadata.file_type().is_symlink() {
            fs::read_link(&alias_path)
                .map(|current| current != target)
                .unwrap_or(true)
        } else {
            true
        };

        if should_replace {
            if metadata.is_dir() {
                fs::remove_dir_all(&alias_path)
                    .map_err(|err| format!("Failed to replace database alias directory: {err}"))?;
            } else {
                fs::remove_file(&alias_path)
                    .map_err(|err| format!("Failed to replace database alias file: {err}"))?;
            }
        } else {
            return Ok(alias_path);
        }
    }

    #[cfg(unix)]
    symlink(&target, &alias_path)
        .map_err(|err| format!("Failed to create database alias symlink: {err}"))?;

    #[cfg(windows)]
    symlink_file(&target, &alias_path)
        .map_err(|err| format!("Failed to create database alias symlink: {err}"))?;

    Ok(alias_path)
}

fn reset_log_file(path: &Path) -> Result<(), String> {
    fs::write(path, "").map_err(|err| format!("Failed to reset log file {}: {err}", path.display()))
}

fn append_log(path: &Path, entry: &str) -> Result<(), String> {
    use std::io::Write;

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|err| format!("Failed to open log file {}: {err}", path.display()))?;
    file.write_all(entry.as_bytes())
        .map_err(|err| format!("Failed to write log file {}: {err}", path.display()))
}

fn read_log_excerpt(path: &Path) -> String {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(_) => return String::new(),
    };

    let lines: Vec<_> = content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();

    let start = lines.len().saturating_sub(12);
    lines[start..].join("\n")
}

fn humanize_runtime_issue(details: &str) -> String {
    let normalized = details.to_lowercase();

    if normalized.contains("failed to reserve virtual memory for coderange") {
        return format!(
            "Bundled PrismAI runtime could not start its embedded Node engine on this Mac. \
This usually means the app bundle was signed without the JIT entitlements required by the bundled runtime.\n\n{}",
            details.trim()
        );
    }

    details.trim().to_string()
}

fn format_child_failure(service_name: &str, exit_code: Option<i32>, log_path: &Path) -> String {
    let exit_label = exit_code
        .map(|code| format!("exit code {code}"))
        .unwrap_or_else(|| "an unknown exit status".to_string());
    let excerpt = read_log_excerpt(log_path);

    if excerpt.is_empty() {
        return format!("{service_name} exited during startup with {exit_label}.");
    }

    let details = humanize_runtime_issue(&excerpt);
    format!("{service_name} exited during startup with {exit_label}.\n\n{details}")
}

fn run_bootstrap_command(
    mut command: Command,
    label: &str,
    log_path: &Path,
) -> Result<Output, String> {
    command.stdout(Stdio::piped()).stderr(Stdio::piped());
    let output = command
        .output()
        .map_err(|err| format!("Failed to run {label}: {err}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let mut log_entry = format!("== {label} ==\nstatus: {}\n", output.status);
    if !stdout.is_empty() {
        log_entry.push_str(&format!("stdout:\n{stdout}\n"));
    }
    if !stderr.is_empty() {
        log_entry.push_str(&format!("stderr:\n{stderr}\n"));
    }
    log_entry.push('\n');
    let _ = append_log(log_path, &log_entry);

    if output.status.success() {
        return Ok(output);
    }

    let details = if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        format!("exit status {}", output.status)
    };

    Err(format!(
        "{label} failed: {}",
        humanize_runtime_issue(&details)
    ))
}

fn ensure_runtime_database(
    core_dir: &Path,
    storage_dir: &Path,
    node_bin: &str,
    bootstrap_log_path: &Path,
) -> Result<(), String> {
    let target = storage_dir.join("anythingllm.db");
    let should_restore_template = !target.exists()
        || target
            .metadata()
            .map(|metadata| metadata.len() == 0)
            .unwrap_or(true);

    if should_restore_template {
        let template_db = core_dir
            .parent()
            .map(|root| root.join("template").join("anythingllm.db"))
            .ok_or_else(|| "Unable to resolve runtime template directory.".to_string())?;

        if template_db.exists() {
            fs::copy(&template_db, &target).map_err(|err| {
                format!(
                    "Failed to restore bundled template database from {}: {err}",
                    template_db.display()
                )
            })?;
            ensure_database_alias(storage_dir)?;
            return Ok(());
        }
    }

    let server_dir = core_dir.join("server");
    let prisma_cli = server_dir
        .join("node_modules")
        .join("prisma")
        .join("build")
        .join("index.js");
    let runtime_schema = server_dir.join("prisma").join("runtime.prisma");

    if !prisma_cli.exists() {
        return Err(format!(
            "Missing Prisma CLI at {}. Run `npm run prepare:core` from desktop-tauri.",
            prisma_cli.display()
        ));
    }

    if !runtime_schema.exists() {
        return Err(format!(
            "Missing runtime Prisma schema at {}. Run `npm run prepare:core` from desktop-tauri.",
            runtime_schema.display()
        ));
    }

    let database_alias = ensure_database_alias(storage_dir)?;
    let database_url = sqlite_database_url(&database_alias);

    let mut migrate = Command::new(node_bin);
    migrate
        .current_dir(&server_dir)
        .arg(&prisma_cli)
        .arg("migrate")
        .arg("deploy")
        .arg("--schema")
        .arg(&runtime_schema)
        .env("DATABASE_URL", &database_url)
        .env("STORAGE_DIR", storage_dir);
    if let Err(error) =
        run_bootstrap_command(migrate, "desktop database migration", bootstrap_log_path)
    {
        if error.contains("P3005") {
            let mut db_push = Command::new(node_bin);
            db_push
                .current_dir(&server_dir)
                .arg(&prisma_cli)
                .arg("db")
                .arg("push")
                .arg("--schema")
                .arg(&runtime_schema)
                .arg("--skip-generate")
                .env("DATABASE_URL", &database_url)
                .env("STORAGE_DIR", storage_dir);
            run_bootstrap_command(db_push, "desktop database schema push", bootstrap_log_path)?;
        } else {
            return Err(error);
        }
    }

    let mut seed = Command::new(node_bin);
    seed.current_dir(&server_dir)
        .arg("prisma/seed.js")
        .env("DATABASE_URL", &database_url)
        .env("STORAGE_DIR", storage_dir);
    run_bootstrap_command(seed, "desktop database seed", bootstrap_log_path)?;

    Ok(())
}

fn terminate_child(_name: &str, child: &mut Child) {
    if child.try_wait().ok().flatten().is_some() {
        return;
    }
    let _ = child.kill();
    let _ = child.wait();
}

fn apply_stdio(command: &mut Command, log_path: &Path) -> Result<(), String> {
    if cfg!(debug_assertions) {
        command.stdout(Stdio::inherit()).stderr(Stdio::inherit());
    } else {
        let stdout_log = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(log_path)
            .map_err(|err| format!("Failed to open runtime log {}: {err}", log_path.display()))?;
        let stderr_log = stdout_log.try_clone().map_err(|err| {
            format!(
                "Failed to clone runtime log handle {}: {err}",
                log_path.display()
            )
        })?;
        command
            .stdout(Stdio::from(stdout_log))
            .stderr(Stdio::from(stderr_log));
    }
    Ok(())
}

fn spawn_collector(
    core_dir: &Path,
    storage_dir: &Path,
    node_bin: &str,
    log_path: &Path,
) -> Result<Child, String> {
    let app_data_dir = storage_dir
        .parent()
        .ok_or_else(|| "Unable to resolve application data directory for collector.".to_string())?;
    let collector_data_dir = app_data_dir.join("collector");
    let collector_hotdir = collector_data_dir.join("hotdir");
    let collector_tmp_dir = collector_data_dir.join("storage").join("tmp");
    fs::create_dir_all(&collector_hotdir)
        .map_err(|err| format!("Failed to create collector hotdir: {err}"))?;
    fs::create_dir_all(&collector_tmp_dir)
        .map_err(|err| format!("Failed to create collector temp directory: {err}"))?;

    let mut command = Command::new(node_bin);
    command
        .current_dir(core_dir.join("collector"))
        .arg("index.js")
        .env("NODE_ENV", "production")
        .env("STORAGE_DIR", storage_dir)
        .env("COLLECTOR_DATA_DIR", &collector_data_dir)
        .env("COLLECTOR_HOTDIR", &collector_hotdir)
        .env("COLLECTOR_TMP_DIR", &collector_tmp_dir)
        .env("COLLECTOR_PORT", COLLECTOR_PORT.to_string())
        .env("COLLECTOR_BIND_HOST", "127.0.0.1");
    apply_stdio(&mut command, log_path)?;
    command
        .spawn()
        .map_err(|err| format!("Failed to spawn collector process: {err}"))
}

fn spawn_server(
    core_dir: &Path,
    storage_dir: &Path,
    node_bin: &str,
    runtime_secrets: &RuntimeSecrets,
    server_port: u16,
    log_path: &Path,
) -> Result<Child, String> {
    let jwt_secret = std::env::var("ANYTHINGLLM_JWT_SECRET")
        .unwrap_or_else(|_| runtime_secrets.jwt_secret.clone());
    let sig_key =
        std::env::var("ANYTHINGLLM_SIG_KEY").unwrap_or_else(|_| runtime_secrets.sig_key.clone());
    let sig_salt =
        std::env::var("ANYTHINGLLM_SIG_SALT").unwrap_or_else(|_| runtime_secrets.sig_salt.clone());
    let database_alias = ensure_database_alias(storage_dir)?;
    let database_url = sqlite_database_url(&database_alias);

    let mut command = Command::new(node_bin);
    command
        .current_dir(core_dir.join("server"))
        .arg("index.js")
        .env("NODE_ENV", "production")
        .env("SERVER_PORT", server_port.to_string())
        .env("SERVER_BIND_HOST", "127.0.0.1")
        .env("COLLECTOR_PORT", COLLECTOR_PORT.to_string())
        .env("COLLECTOR_HOST", "127.0.0.1")
        .env("DISABLE_TELEMETRY", "true")
        .env("DATABASE_URL", database_url)
        .env("STORAGE_DIR", storage_dir)
        .env("JWT_SECRET", jwt_secret)
        .env("SIG_KEY", sig_key)
        .env("SIG_SALT", sig_salt);
    apply_stdio(&mut command, log_path)?;
    command
        .spawn()
        .map_err(|err| format!("Failed to spawn server process: {err}"))
}

fn main() {
    tauri::Builder::default()
        .menu(build_app_menu())
        .on_menu_event(|event| {
            let app = event.window().app_handle();
            if let Err(error) = handle_menu_event(&app, event.menu_item_id()) {
                eprintln!("menu event error: {error}");
            }
        })
        .setup(|app| {
            let state = AppState::bootstrap(app)?;
            let configured_mode = state.get_runtime_mode();
            let mut launch_mode = configured_mode;
            if let Some(message) = launch_from_installer_volume_message()? {
                state.set_startup_error(Some(message));
                state.set_startup_phase(
                    StartupPhase::Attention,
                    Some(
                        "Install PrismAI into Applications before launching the local runtime."
                            .to_string(),
                    ),
                );
                launch_mode = RuntimeMode::Web;
            } else if let Err(error) = state.start_services() {
                state.set_startup_error(Some(error));
                state.set_startup_phase(
                    StartupPhase::Attention,
                    Some("PrismAI paused before the local runtime could fully start.".to_string()),
                );
                launch_mode = RuntimeMode::Web;
            }

            if launch_mode == RuntimeMode::Desktop {
                if let Err(error) = wait_for_server_ready(&state, Duration::from_secs(75)) {
                    state.set_startup_error(Some(error));
                    state.set_startup_phase(
                        StartupPhase::Attention,
                        Some(
                            "PrismAI paused while waiting for the local interface to answer."
                                .to_string(),
                        ),
                    );
                }
            }

            if let Some(window) = app.get_window("main") {
                present_main_window(&window, &state);
            } else {
                state.set_startup_error(Some(
                    "Main window was not available during startup.".to_string(),
                ));
                state.set_startup_phase(
                    StartupPhase::Attention,
                    Some("PrismAI started, but the desktop window was unavailable.".to_string()),
                );
            }

            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_runtime_status,
            set_runtime_mode,
            open_anythingllm_in_browser,
            open_applications_folder,
            open_logs_folder,
            get_open_source_materials,
            open_open_source_document,
            restart_app
        ])
        .build(tauri::generate_context!())
        .expect("failed to build PrismAI desktop app")
        .run(|app_handle, event| match event {
            RunEvent::ExitRequested { .. } | RunEvent::Exit => {
                let state = app_handle.state::<AppState>();
                state.stop_services();
            }
            _ => {}
        });
}
