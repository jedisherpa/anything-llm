use rand::{distributions::Alphanumeric, Rng};
use std::{fs, path::Path};

use crate::runtime::{RuntimeConfig, RuntimeSecrets};

fn random_secret(length: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}

pub(crate) fn ensure_runtime_secrets(data_dir: &Path) -> Result<RuntimeSecrets, String> {
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

pub(crate) fn read_runtime_config(config_path: &Path) -> RuntimeConfig {
    let data = match fs::read_to_string(config_path) {
        Ok(data) => data,
        Err(_) => return RuntimeConfig::default(),
    };

    serde_json::from_str(&data).unwrap_or_default()
}

pub(crate) fn write_runtime_config(
    config_path: &Path,
    config: &RuntimeConfig,
) -> Result<(), String> {
    let content = serde_json::to_string_pretty(config)
        .map_err(|err| format!("Failed to serialize runtime config: {err}"))?;
    fs::write(config_path, content).map_err(|err| format!("Failed to write runtime config: {err}"))
}
