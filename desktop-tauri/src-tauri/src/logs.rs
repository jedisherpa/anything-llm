use std::{
    fs,
    path::Path,
    process::{Command, Output, Stdio},
};

pub(crate) fn reset_log_file(path: &Path) -> Result<(), String> {
    fs::write(path, "").map_err(|err| format!("Failed to reset log file {}: {err}", path.display()))
}

pub(crate) fn append_log(path: &Path, entry: &str) -> Result<(), String> {
    use std::io::Write;

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|err| format!("Failed to open log file {}: {err}", path.display()))?;
    file.write_all(entry.as_bytes())
        .map_err(|err| format!("Failed to write log file {}: {err}", path.display()))
}

pub(crate) fn read_log_excerpt(path: &Path) -> String {
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

pub(crate) fn humanize_runtime_issue(details: &str) -> String {
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

pub(crate) fn format_child_failure(
    service_name: &str,
    exit_code: Option<i32>,
    log_path: &Path,
) -> String {
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

pub(crate) fn run_bootstrap_command(
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
