#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config;
mod database;
mod logs;
mod paths;
mod processes;
mod runtime;
mod startup;

use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::Duration,
};
use tauri::{api::shell::open, CustomMenuItem, Manager, Menu, MenuItem, RunEvent, Submenu};

use crate::{
    config::{ensure_runtime_secrets, read_runtime_config, write_runtime_config},
    database::ensure_runtime_database,
    logs::{format_child_failure, read_log_excerpt, reset_log_file},
    paths::{
        app_url_for_port, default_server_port, resolve_core_dir, resolve_data_dir,
        resolve_node_bin, validate_core_dir,
    },
    processes::{
        cleanup_orphan_processes, select_collector_port, select_server_port, spawn_collector,
        spawn_server, terminate_child,
    },
    runtime::{
        ManagedChildren, OpenSourceDocument, OpenSourceMaterials, OpenSourceMetadata,
        RuntimeConfig, RuntimeMode, RuntimeSecrets, RuntimeStatus, StartupPhase,
    },
    startup::wait_for_server_ready,
};

const SERVER_PORT_CANDIDATES: [u16; 3] = [3033, 3032, 3031];
const COLLECTOR_PORT_CANDIDATES: [u16; 1] = [8899];

const MODE_DESKTOP_MENU_ID: &str = "mode_desktop";
const MODE_WEB_MENU_ID: &str = "mode_web";
const OPEN_BROWSER_MENU_ID: &str = "open_browser";
const RESTART_APP_MENU_ID: &str = "restart_app";
const OPEN_SOURCE_LICENSES_MENU_ID: &str = "open_source_licenses";
const OPEN_LOGS_MENU_ID: &str = "open_logs";
const OPEN_SOURCE_WINDOW_LABEL: &str = "open_source_licenses";
const APPLICATIONS_FOLDER: &str = "/Applications";
const DATA_DIR_OVERRIDE_ENV: &str = "PRISMAI_DATA_DIR";
const DATA_DIR_OVERRIDE_ARG: &str = "--prismai-data-dir";

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
        let collector_port = select_collector_port(Duration::from_secs(10))?;
        self.set_server_port(server_port);

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
            collector_port,
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
            collector_port,
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
fn get_open_source_materials(
    state: tauri::State<'_, AppState>,
) -> Result<OpenSourceMaterials, String> {
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
    let open_logs_item = CustomMenuItem::new(OPEN_LOGS_MENU_ID, "Open Logs Folder");
    let open_source_item =
        CustomMenuItem::new(OPEN_SOURCE_LICENSES_MENU_ID, "Open Source Licenses");

    let mode_submenu = Submenu::new(
        "Runtime",
        Menu::new()
            .add_item(desktop_mode)
            .add_item(web_mode)
            .add_native_item(MenuItem::Separator)
            .add_item(open_browser_item.clone())
            .add_item(open_logs_item.clone())
            .add_item(restart_item),
    );

    let help_submenu = Submenu::new("Help", Menu::new().add_item(open_source_item));

    Menu::os_default("PrismAI")
        .add_submenu(mode_submenu)
        .add_submenu(help_submenu)
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
        OPEN_LOGS_MENU_ID => {
            let state = app.state::<AppState>();
            open(
                &app.shell_scope(),
                state.logs_dir.display().to_string(),
                None,
            )
            .map_err(|err| format!("Failed to open PrismAI logs folder: {err}"))
        }
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
