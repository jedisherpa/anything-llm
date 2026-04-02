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
    #[serde(default)]
    pub(crate) execution_engine_url: Option<String>,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            mode: RuntimeMode::Desktop,
            execution_engine_url: None,
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
    pub(crate) execution_engine_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub(crate) struct BundledComponent {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) version: String,
    pub(crate) commit: Option<String>,
    pub(crate) source: String,
    pub(crate) bundled: bool,
    pub(crate) detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub(crate) struct BundleMetadata {
    pub(crate) generated_at: Option<String>,
    pub(crate) desktop_version: Option<String>,
    pub(crate) components: Vec<BundledComponent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ReleaseCheckState {
    Ready,
    Attention,
    Missing,
    NotConfigured,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct ReleaseCheck {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) state: ReleaseCheckState,
    pub(crate) detail: String,
    pub(crate) hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub(crate) struct ReleaseReadiness {
    pub(crate) bundle_metadata: BundleMetadata,
    pub(crate) dependency_checks: Vec<ReleaseCheck>,
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
