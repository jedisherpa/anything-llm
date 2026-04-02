use std::path::{Path, PathBuf};

use tauri::api::path::app_data_dir;

use crate::{DATA_DIR_OVERRIDE_ARG, DATA_DIR_OVERRIDE_ENV, SERVER_PORT_CANDIDATES};

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

pub(crate) fn resolve_data_dir(app: &tauri::App) -> Result<PathBuf, String> {
    if let Some(path) = desktop_data_dir_override() {
        return Ok(path);
    }

    app_data_dir(&app.config()).ok_or_else(|| "Unable to resolve app data directory.".to_string())
}

pub(crate) fn bundled_runtime_root(app: &tauri::App) -> Option<PathBuf> {
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

pub(crate) fn default_server_port() -> u16 {
    SERVER_PORT_CANDIDATES[0]
}

pub(crate) fn app_url_for_port(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

pub(crate) fn resolve_core_dir(app: &tauri::App) -> Result<PathBuf, String> {
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

pub(crate) fn resolve_node_bin(app: &tauri::App) -> Result<String, String> {
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

pub(crate) fn validate_core_dir(core_dir: &Path) -> Result<(), String> {
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
