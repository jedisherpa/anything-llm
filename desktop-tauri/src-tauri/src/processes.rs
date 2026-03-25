use std::{
    fs,
    io::ErrorKind,
    net::TcpListener,
    path::Path,
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use crate::{
    database::{ensure_database_alias, sqlite_database_url},
    runtime::RuntimeSecrets,
    COLLECTOR_PORT_CANDIDATES, SERVER_PORT_CANDIDATES,
};

pub(crate) fn select_server_port(timeout: Duration) -> Result<u16, String> {
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

pub(crate) fn select_collector_port(timeout: Duration) -> Result<u16, String> {
    let started = Instant::now();
    let mut last_busy_ports = Vec::new();

    while started.elapsed() <= timeout {
        let mut busy_ports = Vec::new();
        for port in COLLECTOR_PORT_CANDIDATES {
            if port_bind_conflicts(port).is_empty() {
                return Ok(port);
            }
            busy_ports.push(port);
        }
        last_busy_ports = busy_ports;
        thread::sleep(Duration::from_millis(250));
    }

    Err(format!(
        "PrismAI collector could not start because all preferred ports are already in use. Close the existing process using ports {} and relaunch PrismAI.",
        last_busy_ports
            .iter()
            .map(u16::to_string)
            .collect::<Vec<_>>()
            .join(", ")
    ))
}

pub(crate) fn cleanup_orphan_processes(core_dir: &Path) {
    #[cfg(unix)]
    for (port, expected_cwd) in SERVER_PORT_CANDIDATES
        .into_iter()
        .map(|port| (port, core_dir.join("server")))
        .chain(
            COLLECTOR_PORT_CANDIDATES
                .into_iter()
                .map(|port| (port, core_dir.join("collector"))),
        )
    {
        for pid in listening_pids_for_port(port) {
            if process_cwd_matches(pid, &expected_cwd) {
                terminate_pid(pid);
            }
        }
    }

    thread::sleep(Duration::from_millis(300));
}

pub(crate) fn terminate_child(_name: &str, child: &mut Child) {
    if child.try_wait().ok().flatten().is_some() {
        return;
    }
    let _ = child.kill();
    let _ = child.wait();
}

pub(crate) fn spawn_collector(
    core_dir: &Path,
    storage_dir: &Path,
    node_bin: &str,
    collector_port: u16,
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
        .env("COLLECTOR_PORT", collector_port.to_string())
        .env("COLLECTOR_BIND_HOST", "127.0.0.1");
    apply_stdio(&mut command, log_path)?;
    command
        .spawn()
        .map_err(|err| format!("Failed to spawn collector process: {err}"))
}

pub(crate) fn spawn_server(
    core_dir: &Path,
    storage_dir: &Path,
    node_bin: &str,
    runtime_secrets: &RuntimeSecrets,
    server_port: u16,
    collector_port: u16,
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
        .env("COLLECTOR_PORT", collector_port.to_string())
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
