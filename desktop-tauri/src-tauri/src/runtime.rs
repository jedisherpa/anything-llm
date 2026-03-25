use serde::{Deserialize, Serialize};
use std::process::Child;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum RuntimeMode {
    Desktop,
    Web,
}

impl Default for RuntimeMode {
    fn default() -> Self {
        Self::Desktop
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct RuntimeConfig {
    pub(crate) mode: RuntimeMode,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            mode: RuntimeMode::Desktop,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct RuntimeStatus {
    pub(crate) mode: RuntimeMode,
    pub(crate) app_url: String,
    pub(crate) storage_dir: String,
    pub(crate) core_dir: String,
    pub(crate) logs_dir: String,
    pub(crate) telemetry_disabled: bool,
    pub(crate) startup_phase: StartupPhase,
    pub(crate) startup_detail: Option<String>,
    pub(crate) startup_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub(crate) struct OpenSourceMetadata {
    pub(crate) product_name: String,
    pub(crate) version: String,
    pub(crate) repository_url: String,
    pub(crate) commit: String,
    pub(crate) dirty: bool,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct OpenSourceDocument {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) path: String,
    pub(crate) body: String,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct OpenSourceMaterials {
    pub(crate) project_name: String,
    pub(crate) upstream_version: String,
    pub(crate) upstream_commit: String,
    pub(crate) repository_url: String,
    pub(crate) documents: Vec<OpenSourceDocument>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum StartupPhase {
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

pub(crate) struct ManagedChildren {
    pub(crate) server: Child,
    pub(crate) collector: Child,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct RuntimeSecrets {
    pub(crate) jwt_secret: String,
    pub(crate) sig_key: String,
    pub(crate) sig_salt: String,
}
