use std::{
    fs,
    net::{TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};

use crate::{
    runtime::{
        BundleMetadata, ReleaseCheck, ReleaseCheckState, ReleaseReadiness,
    },
    AppState,
};

fn bundle_metadata_path(core_dir: &Path) -> PathBuf {
    if core_dir
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value == "core")
        .unwrap_or(false)
    {
        return core_dir
            .parent()
            .unwrap_or(core_dir)
            .join("bundle-metadata.json");
    }

    core_dir
        .join("desktop-tauri")
        .join("runtime")
        .join("bundle-metadata.json")
}

fn load_bundle_metadata(core_dir: &Path) -> BundleMetadata {
    let metadata_path = bundle_metadata_path(core_dir);
    let content = match fs::read_to_string(&metadata_path) {
        Ok(content) => content,
        Err(_) => return BundleMetadata::default(),
    };

    serde_json::from_str::<BundleMetadata>(&content).unwrap_or_default()
}

fn run_capture(command: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(command)
        .args(args)
        .output()
        .map_err(|err| format!("Failed to run `{command}`: {err}"))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if stdout.is_empty() {
            Ok(String::from_utf8_lossy(&output.stderr).trim().to_string())
        } else {
            Ok(stdout)
        }
    } else {
        let detail = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if detail.is_empty() {
            Err(format!("`{command}` exited with status {}", output.status))
        } else {
            Err(detail)
        }
    }
}

fn tcp_reachable(host: &str, port: u16) -> bool {
    let address = format!("{host}:{port}");
    let mut addrs = match address.to_socket_addrs() {
        Ok(addrs) => addrs,
        Err(_) => return false,
    };
    let Some(addr) = addrs.next() else {
        return false;
    };

    TcpStream::connect_timeout(&addr, Duration::from_millis(800)).is_ok()
}

fn check_docker_cli() -> ReleaseCheck {
    match run_capture("docker", &["--version"]) {
        Ok(output) => ReleaseCheck {
            id: "docker_cli".to_string(),
            label: "Docker CLI".to_string(),
            state: ReleaseCheckState::Ready,
            detail: output,
            hint: None,
        },
        Err(error) => ReleaseCheck {
            id: "docker_cli".to_string(),
            label: "Docker CLI".to_string(),
            state: ReleaseCheckState::Missing,
            detail: "Docker CLI is not available from the PrismAI desktop shell.".to_string(),
            hint: Some(error),
        },
    }
}

fn check_docker_daemon() -> ReleaseCheck {
    match run_capture("docker", &["info", "--format", "{{.ServerVersion}}"]) {
        Ok(output) if !output.trim().is_empty() => ReleaseCheck {
            id: "docker_daemon".to_string(),
            label: "Docker Daemon".to_string(),
            state: ReleaseCheckState::Ready,
            detail: format!("Docker Desktop is reachable (server {}).", output.trim()),
            hint: None,
        },
        Ok(_) => ReleaseCheck {
            id: "docker_daemon".to_string(),
            label: "Docker Daemon".to_string(),
            state: ReleaseCheckState::Attention,
            detail: "Docker responded without a server version.".to_string(),
            hint: Some("Open Docker Desktop and verify the daemon is healthy.".to_string()),
        },
        Err(error) => ReleaseCheck {
            id: "docker_daemon".to_string(),
            label: "Docker Daemon".to_string(),
            state: ReleaseCheckState::Attention,
            detail: "PrismAI could not talk to the local Docker daemon.".to_string(),
            hint: Some(error),
        },
    }
}

fn check_docker_model_runner() -> ReleaseCheck {
    if tcp_reachable("127.0.0.1", 12434) {
        ReleaseCheck {
            id: "docker_model_runner".to_string(),
            label: "Docker Model Runner".to_string(),
            state: ReleaseCheckState::Ready,
            detail: "The local Docker Model Runner endpoint answered on 127.0.0.1:12434."
                .to_string(),
            hint: None,
        }
    } else {
        ReleaseCheck {
            id: "docker_model_runner".to_string(),
            label: "Docker Model Runner".to_string(),
            state: ReleaseCheckState::Attention,
            detail: "The local Docker Model Runner endpoint did not answer on 127.0.0.1:12434."
                .to_string(),
            hint: Some(
                "Install or start Docker Model Runner, then refresh this loader status.".to_string(),
            ),
        }
    }
}

fn check_postgres_client() -> ReleaseCheck {
    match run_capture("psql", &["--version"]) {
        Ok(output) => ReleaseCheck {
            id: "postgres_client".to_string(),
            label: "PostgreSQL Client".to_string(),
            state: ReleaseCheckState::Ready,
            detail: output,
            hint: None,
        },
        Err(error) => ReleaseCheck {
            id: "postgres_client".to_string(),
            label: "PostgreSQL Client".to_string(),
            state: ReleaseCheckState::Missing,
            detail: "The `psql` client is not available from the PrismAI desktop shell.".to_string(),
            hint: Some(error),
        },
    }
}

fn check_postgres_reachability() -> ReleaseCheck {
    let connection_string = std::env::var("PGVECTOR_CONNECTION_STRING")
        .or_else(|_| std::env::var("DATABASE_URL"))
        .ok();

    let Some(connection_string) = connection_string else {
        return ReleaseCheck {
            id: "postgres_connection".to_string(),
            label: "PostgreSQL Connection".to_string(),
            state: ReleaseCheckState::NotConfigured,
            detail: "No PGVector/PostgreSQL connection string is configured in the desktop environment."
                .to_string(),
            hint: Some(
                "Set PGVECTOR_CONNECTION_STRING for pgvector-backed installs or complete setup first."
                    .to_string(),
            ),
        };
    };

    match run_capture("psql", &[connection_string.as_str(), "-tAc", "SELECT 1"]) {
        Ok(output) if output.contains('1') => ReleaseCheck {
            id: "postgres_connection".to_string(),
            label: "PostgreSQL Connection".to_string(),
            state: ReleaseCheckState::Ready,
            detail: "The configured PostgreSQL connection responded successfully.".to_string(),
            hint: None,
        },
        Ok(output) => ReleaseCheck {
            id: "postgres_connection".to_string(),
            label: "PostgreSQL Connection".to_string(),
            state: ReleaseCheckState::Attention,
            detail: "PostgreSQL responded, but the readiness query returned an unexpected value."
                .to_string(),
            hint: Some(output),
        },
        Err(error) => ReleaseCheck {
            id: "postgres_connection".to_string(),
            label: "PostgreSQL Connection".to_string(),
            state: ReleaseCheckState::Attention,
            detail: "PrismAI could not validate the configured PostgreSQL connection."
                .to_string(),
            hint: Some(error),
        },
    }
}

fn check_pgvector_extension() -> ReleaseCheck {
    let vector_db = std::env::var("VECTOR_DB").unwrap_or_else(|_| "lancedb".to_string());

    if vector_db != "pgvector" {
        return ReleaseCheck {
            id: "pgvector_extension".to_string(),
            label: "pgvector Extension".to_string(),
            state: ReleaseCheckState::NotConfigured,
            detail: format!("Current vector backend is `{vector_db}`, so pgvector is not active."),
            hint: Some(
                "Switch VECTOR_DB to pgvector during setup when you want the PostgreSQL profile."
                    .to_string(),
            ),
        };
    }

    let Some(connection_string) = std::env::var("PGVECTOR_CONNECTION_STRING").ok() else {
        return ReleaseCheck {
            id: "pgvector_extension".to_string(),
            label: "pgvector Extension".to_string(),
            state: ReleaseCheckState::NotConfigured,
            detail: "VECTOR_DB is pgvector, but PGVECTOR_CONNECTION_STRING is missing.".to_string(),
            hint: Some("Complete pgvector configuration before release validation.".to_string()),
        };
    };

    match run_capture(
        "psql",
        &[
            connection_string.as_str(),
            "-tAc",
            "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
        ],
    ) {
        Ok(output) if !output.trim().is_empty() => ReleaseCheck {
            id: "pgvector_extension".to_string(),
            label: "pgvector Extension".to_string(),
            state: ReleaseCheckState::Ready,
            detail: format!("pgvector extension detected (version {}).", output.trim()),
            hint: None,
        },
        Ok(_) => ReleaseCheck {
            id: "pgvector_extension".to_string(),
            label: "pgvector Extension".to_string(),
            state: ReleaseCheckState::Attention,
            detail: "The PostgreSQL connection answered, but the vector extension was not found."
                .to_string(),
            hint: Some("Install `pgvector` and run `CREATE EXTENSION vector;` on the target database.".to_string()),
        },
        Err(error) => ReleaseCheck {
            id: "pgvector_extension".to_string(),
            label: "pgvector Extension".to_string(),
            state: ReleaseCheckState::Attention,
            detail: "PrismAI could not verify the pgvector extension on the configured database."
                .to_string(),
            hint: Some(error),
        },
    }
}

pub(crate) fn collect_release_readiness(state: &AppState) -> ReleaseReadiness {
    ReleaseReadiness {
        bundle_metadata: load_bundle_metadata(&state.core_dir),
        dependency_checks: vec![
            check_docker_cli(),
            check_docker_daemon(),
            check_docker_model_runner(),
            check_postgres_client(),
            check_postgres_reachability(),
            check_pgvector_extension(),
        ],
    }
}
