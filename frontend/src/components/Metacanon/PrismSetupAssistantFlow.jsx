import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { X } from "@phosphor-icons/react/dist/csr/X";

import PreLoader from "@/components/Preloader";
import System from "@/models/system";
import DMRUtils from "@/models/utils/dmrUtils";
import { runDesktopDependencyAction } from "@/utils/desktopRuntime";
import {
  loadPrismSetupDraft,
  savePrismSetupCompleted,
  savePrismSetupDraft,
} from "@/utils/prismSetupState";
import showToast from "@/utils/toast";

const OPENAI_EMBEDDING_MODELS = [
  "text-embedding-3-small",
  "text-embedding-3-large",
  "text-embedding-ada-002",
];
const DOCKER_DEFAULT_BASE_PATH = "http://localhost:12434/engines/v1";
const DEFAULT_PGVECTOR_TABLE = "anythingllm_vectors";
const STEP_LABELS = ["Backend", "Embedder", "Local model", "Review"];
const DOCKER_DESKTOP_URL = "https://www.docker.com/products/docker-desktop/";
const POSTGRES_APP_URL = "https://postgresapp.com/";
const PREFERRED_DOCKER_MODEL_SUFFIXES = [
  "docker.io/ai/qwen3:latest",
  "ai/qwen3",
  "docker.io/ai/qwen2.5:latest",
  "ai/qwen2.5",
  "docker.io/ai/smollm2:latest",
  "ai/smollm2",
];

function openExternal(url = "") {
  if (!url || typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function copyText(value = "", successMessage = "Copied.") {
  try {
    await navigator.clipboard.writeText(String(value || ""));
    showToast(successMessage, "success");
  } catch {
    showToast("Failed to copy text.", "error");
  }
}

async function runDependencyAction({
  action = "",
  fallbackUrl = "",
  copyFallback = "",
  successMessage = "",
}) {
  const result = await runDesktopDependencyAction(action);
  if (result.success) {
    if (successMessage) showToast(successMessage, "success");
    return true;
  }

  if (copyFallback) {
    await copyText(copyFallback, `${copyFallback} copied.`);
  }

  if (fallbackUrl) {
    openExternal(fallbackUrl);
    return false;
  }

  if (result.error && !result.unsupported) {
    showToast(result.error, "error");
  }

  return false;
}

function StepPill({ index, active, complete, label }) {
  return (
    <div
      className={[
        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        active
          ? "border-theme-primary-button bg-theme-primary-button/15 text-theme-primary-button"
          : complete
            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
            : "border-theme-sidebar-border text-theme-text-secondary",
      ].join(" ")}
    >
      {index + 1}. {label}
    </div>
  );
}

function ChoiceCard({
  active = false,
  title,
  body,
  onClick = () => {},
  footer = null,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-[20px] border p-4 text-left transition",
        active
          ? "border-theme-primary-button bg-theme-primary-button/10"
          : "border-theme-sidebar-border bg-theme-sidebar-item-default hover:bg-theme-sidebar-item-hover",
      ].join(" ")}
    >
      <div className="text-sm font-semibold text-theme-text-primary">
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
        {body}
      </div>
      {footer ? (
        <div className="mt-3 text-xs text-theme-home-text-secondary">
          {footer}
        </div>
      ) : null}
    </button>
  );
}

function GuidanceCard({ title, body, status = null, actions = [] }) {
  return (
    <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-theme-text-primary">
          {title}
        </div>
        {status ? (
          <div className="rounded-full border border-theme-sidebar-border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
            {status}
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
        {body}
      </div>
      {actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={[
                "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                action.variant === "primary"
                  ? "bg-theme-primary-button text-white hover:opacity-90"
                  : "border border-theme-sidebar-border text-theme-text-primary hover:border-theme-primary-button hover:text-theme-primary-button",
              ].join(" ")}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function modelIds(models = []) {
  return Array.from(
    new Set(
      models
        .map((model) =>
          typeof model === "string"
            ? model
            : model?.id || model?.name || String(model || "")
        )
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

function choosePreferredDockerModel(models = [], desiredModel = "") {
  const normalizedDesired = String(desiredModel || "").trim();
  if (normalizedDesired) {
    const exact = models.find((model) => model === normalizedDesired);
    if (exact) return exact;
    const suffixMatch = models.find((model) =>
      model.endsWith(normalizedDesired)
    );
    if (suffixMatch) return suffixMatch;
  }

  for (const preferred of PREFERRED_DOCKER_MODEL_SUFFIXES) {
    const exact = models.find((model) => model === preferred);
    if (exact) return exact;
    const suffixMatch = models.find((model) => model.endsWith(preferred));
    if (suffixMatch) return suffixMatch;
  }

  return models[0] || "";
}

function buildInitialState(settings = {}) {
  return normalizeFormState({
    vectorBackend: settings?.VectorDB || "lancedb",
    pgConnectionString: settings?.PGVectorConnectionString || "",
    pgTableName: settings?.PGVectorTableName || DEFAULT_PGVECTOR_TABLE,
    embedder: settings?.EmbeddingEngine || "native",
    embeddingModel:
      (settings?.EmbeddingEngine || "native") === "native"
        ? (settings?.EmbeddingModelPref || "Xenova/all-MiniLM-L6-v2")
        : (settings?.EmbeddingModelPref || OPENAI_EMBEDDING_MODELS[1]),
    openAiKey: settings?.OpenAiKey || "",
    dockerBasePath:
      settings?.DockerModelRunnerBasePath || DOCKER_DEFAULT_BASE_PATH,
    dockerModel: settings?.DockerModelRunnerModelPref || "",
    dockerTokenLimit:
      settings?.DockerModelRunnerModelTokenLimit?.toString?.() || "8192",
  });
}

function normalizeFormState(state = {}) {
  const asText = (value, fallback = "") => {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (
        ["true", "false", "null", "undefined", "[object Object]"].includes(
          normalized
        )
      ) {
        return fallback;
      }
      return normalized;
    }
    if (typeof value === "number") return String(value);
    return fallback;
  };

  const resolvedEmbedder =
    state?.embedder === "openai" ? "openai" : "native";
  const embeddingModelFallback =
    resolvedEmbedder === "openai"
      ? OPENAI_EMBEDDING_MODELS[1]
      : "Xenova/all-MiniLM-L6-v2";
  return {
    vectorBackend: state?.vectorBackend === "pgvector" ? "pgvector" : "lancedb",
    pgConnectionString: asText(state?.pgConnectionString),
    pgTableName: asText(state?.pgTableName, DEFAULT_PGVECTOR_TABLE),
    embedder: resolvedEmbedder,
    embeddingModel: asText(state?.embeddingModel, embeddingModelFallback),
    openAiKey: asText(state?.openAiKey),
    dockerBasePath: asText(state?.dockerBasePath, DOCKER_DEFAULT_BASE_PATH),
    dockerModel: asText(state?.dockerModel),
    dockerTokenLimit: asText(state?.dockerTokenLimit, "8192"),
  };
}

function summarizeEmbedder(formState) {
  if (formState.embedder === "openai") {
    return `OpenAI / ${formState.embeddingModel || "unset"}`;
  }
  return `Prism AI native / ${formState.embeddingModel || "unset"}`;
}

export default function PrismSetupAssistantFlow({
  mode = "modal",
  onClose = () => {},
  onApplied = () => {},
  onBack = null,
}) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState(buildInitialState());
  const [nativeModels, setNativeModels] = useState([]);
  const [dockerModels, setDockerModels] = useState([]);
  const [dependencySequence, setDependencySequence] = useState(null);
  const [refreshingNative, setRefreshingNative] = useState(false);
  const [refreshingDocker, setRefreshingDocker] = useState(false);
  const [refreshingDependencies, setRefreshingDependencies] = useState(false);
  const [installingDockerModel, setInstallingDockerModel] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [bootstrappingPgvector, setBootstrappingPgvector] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const isModal = mode === "modal";

  const persistDraft = async (draft = null) => {
    await savePrismSetupDraft(draft);
  };

  const persistCurrentDraft = async (
    nextStep = step,
    nextFormState = formState
  ) => {
    await persistDraft({
      step: nextStep,
      formState: nextFormState,
      updatedAt: new Date().toISOString(),
    });
  };

  const resetDraft = async () => {
    await persistDraft(null);
    showToast("Prism setup draft cleared.", "success");
  };

  const loadDependencySequence = async () => {
    setRefreshingDependencies(true);
    const sequence = await System.prismDependencySequence();
    setDependencySequence(sequence);
    setRefreshingDependencies(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setDraftReady(false);
      setLoading(true);
      const [settings, sequence] = await Promise.all([
        System.keys(),
        System.prismDependencySequence(),
      ]);
      if (cancelled) return;
      const nextSettings = settings || {};
      const draft = await loadPrismSetupDraft();
      if (cancelled) return;
      const initialState = normalizeFormState({
        ...buildInitialState(nextSettings),
        ...(draft?.formState || {}),
      });
      setFormState(initialState);
      setDependencySequence(sequence);
      setStep(Number.isInteger(draft?.step) ? draft.step : 0);
      setLoading(false);
      setDraftReady(true);
    }

    load();
    return () => {
      cancelled = true;
      setDraftReady(false);
    };
  }, []);

  useEffect(() => {
    if (loading || !draftReady) return;
    void persistCurrentDraft(step, formState);
  }, [draftReady, formState, loading, step]);

  const selectedDockerModelInstalled = useMemo(
    () =>
      !!formState.dockerModel &&
      dockerModels.includes(String(formState.dockerModel || "").trim()),
    [dockerModels, formState.dockerModel]
  );

  useEffect(() => {
    if (formState.embedder !== "native" || nativeModels.length > 0) return;
    refreshNativeModels();
  }, [formState.embedder]);

  const updateField = (key, value) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const refreshNativeModels = async () => {
    setRefreshingNative(true);
    const { models = [], error } = await System.customModels(
      "native-embedder",
      null,
      null,
      15000
    );

    if (error) {
      showToast(`Failed to inspect native embedder models: ${error}`, "error");
      setRefreshingNative(false);
      return;
    }

    const ids = modelIds(models);
    setNativeModels(ids);
    if (!formState.embeddingModel && ids[0]) {
      updateField("embeddingModel", ids[0]);
    }
    setRefreshingNative(false);
  };

  const refreshDockerModels = async () => {
    setRefreshingDocker(true);
    const { models = [], error } = await System.customModels(
      "docker-model-runner",
      null,
      formState.dockerBasePath || DOCKER_DEFAULT_BASE_PATH,
      15000
    );

    if (error) {
      showToast(
        `Failed to inspect Docker Model Runner models: ${error}`,
        "error"
      );
      setRefreshingDocker(false);
      return [];
    }

    const ids = modelIds(models);
    setDockerModels(ids);
    const nextModel = choosePreferredDockerModel(ids, formState.dockerModel);
    if (nextModel && nextModel !== formState.dockerModel) {
      updateField("dockerModel", nextModel);
    }
    showToast(
      ids.length > 0
        ? `${ids.length} Docker model${ids.length === 1 ? "" : "s"} available.`
        : "Docker Model Runner is reachable but no models were found.",
      ids.length > 0 ? "success" : "info"
    );
    setRefreshingDocker(false);
    return ids;
  };

  const validationError = useMemo(() => {
    if (step === 0 && formState.vectorBackend === "pgvector") {
      if (!formState.pgConnectionString.trim()) {
        return "Add the PostgreSQL connection string for pgvector.";
      }
      if (!formState.pgTableName.trim()) {
        return "Add the pgvector table name.";
      }
    }

    if (step === 1) {
      if (!formState.embedder) return "Choose an embedder.";
      if (!formState.embeddingModel.trim()) {
        return "Pick or enter an embedding model.";
      }
      if (formState.embedder === "openai" && !formState.openAiKey.trim()) {
        return "Add the OpenAI API key for the embedder.";
      }
    }

    if (step === 2) {
      if (!selectedDockerModelInstalled) {
        return "Install or choose a local Docker model before continuing.";
      }
      if (!formState.dockerBasePath.trim()) {
        return "Add the Docker Model Runner base URL.";
      }
      if (!formState.dockerModel.trim()) {
        return "Pick or enter the local Docker model.";
      }
      if (!formState.dockerTokenLimit.trim()) {
        return "Set the local model context window.";
      }
    }

    return null;
  }, [formState, selectedDockerModelInstalled, step]);

  const installDockerModel = async () => {
    if (!formState.dockerModel.trim()) {
      showToast("Choose or enter a Docker model first.", "warning");
      return;
    }

    setInstallingDockerModel(true);
    setInstallProgress(0);
    const result = await DMRUtils.downloadModel(
      formState.dockerModel,
      formState.dockerBasePath || DOCKER_DEFAULT_BASE_PATH,
      (percentage) => setInstallProgress(percentage || 0)
    );

    if (!result.success) {
      showToast(
        `Failed to install Docker model: ${result.error || "Unknown error"}`,
        "error"
      );
      setInstallingDockerModel(false);
      return;
    }

    showToast("Docker model installed successfully.", "success");
    const [ids] = await Promise.all([
      refreshDockerModels(),
      loadDependencySequence(),
    ]);
    const resolvedModel = choosePreferredDockerModel(
      ids,
      formState.dockerModel
    );
    if (resolvedModel) updateField("dockerModel", resolvedModel);
    setInstallProgress(100);
    setInstallingDockerModel(false);
  };

  const bootstrapPgvector = async () => {
    if (!formState.pgConnectionString.trim()) {
      showToast("Add the PostgreSQL connection string first.", "warning");
      return;
    }
    if (!formState.pgTableName.trim()) {
      showToast("Add the pgvector table name first.", "warning");
      return;
    }

    setBootstrappingPgvector(true);
    const result = await System.prismBootstrapPgvector({
      connectionString: formState.pgConnectionString.trim(),
      tableName: formState.pgTableName.trim(),
      embeddingEngine: formState.embedder,
      embeddingModel: formState.embeddingModel,
    });

    if (!result?.success) {
      showToast(
        `Failed to bootstrap pgvector for model "${formState.embeddingModel}": ${result?.error || "Unknown error"}`,
        "error"
      );
      setBootstrappingPgvector(false);
      return;
    }

    showToast(result.detail || "pgvector bootstrap complete.", "success");
    await loadDependencySequence();
    setBootstrappingPgvector(false);
  };

  const applySetup = async () => {
    const payload = {
      VectorDB: formState.vectorBackend,
      EmbeddingEngine: formState.embedder,
      EmbeddingModelPref: formState.embeddingModel,
      LLMProvider: "docker-model-runner",
      DockerModelRunnerBasePath:
        formState.dockerBasePath || DOCKER_DEFAULT_BASE_PATH,
      DockerModelRunnerModelPref: formState.dockerModel,
      DockerModelRunnerModelTokenLimit: formState.dockerTokenLimit,
    };

    if (formState.vectorBackend === "pgvector") {
      payload.PGVectorConnectionString = formState.pgConnectionString;
      payload.PGVectorTableName =
        formState.pgTableName || DEFAULT_PGVECTOR_TABLE;
    }

    if (formState.embedder === "openai") {
      payload.OpenAiKey = formState.openAiKey;
    }

    setSaving(true);
    const { error } = await System.updateSystem(payload);
    if (error) {
      showToast(`Failed to apply Prism setup: ${error}`, "error");
      setSaving(false);
      return;
    }

    await persistDraft(null);
    savePrismSetupCompleted({
      completedAt: new Date().toISOString(),
      vectorBackend: formState.vectorBackend,
      embedder: formState.embedder,
      embeddingModel: formState.embeddingModel,
      dockerModel: formState.dockerModel,
    });
    showToast("Prism setup saved successfully.", "success");
    setSaving(false);
    onApplied(formState);
  };

  const shellClassName = isModal
    ? "metacanon-modal-panel relative my-4 flex max-h-[calc(100vh-2rem)] w-[min(92vw,980px)] self-start flex-col rounded-[28px] px-6 pb-0 pt-6 md:max-h-[calc(100vh-3rem)] md:px-8 md:pb-0 md:pt-7"
    : "relative flex w-full max-w-[920px] flex-col px-2 pb-6";
  const bodyClassName = isModal
    ? "mt-6 min-h-0 flex-1 overflow-y-auto pr-1 pb-4"
    : "mt-6";

  return (
    <div className={shellClassName}>
      {isModal ? (
        <>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border-none bg-transparent text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
            aria-label="Close guided setup"
          >
            <X size={18} weight="bold" />
          </button>

          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-home-text-secondary">
            Guided Setup
          </div>
          <h2 className="mt-3 text-[34px] font-semibold leading-[1.02] text-theme-text-primary md:text-[42px]">
            Configure Prism AI
          </h2>
          <p className="mt-4 max-w-[820px] text-[15px] leading-7 text-theme-text-secondary">
            This guided setup configures the real Prism AI storage, embedder,
            and local-model settings through the existing underlying system
            settings path. It does not create a parallel setup layer.
          </p>
        </>
      ) : (
        <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4 text-sm leading-6 text-theme-text-secondary">
          This setup step configures Prism AI through the same underlying system
          settings used by the main settings pages. The backend, embedder, and
          local model you choose here become the real starting profile for this
          install.
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={resetDraft}
          className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
        >
          Reset draft
        </button>
        <button
          type="button"
          onClick={loadDependencySequence}
          disabled={refreshingDependencies}
          className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshingDependencies ? "Refreshing checks..." : "Refresh checks"}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {STEP_LABELS.map((label, index) => (
          <StepPill
            key={label}
            index={index}
            label={label}
            active={step === index}
            complete={index < step}
          />
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex min-h-[320px] flex-1 items-center justify-center">
          <PreLoader size="[88px]" />
        </div>
      ) : (
        <>
          <div className={bodyClassName}>
            {step === 0 ? (
              <div className="space-y-4">
                <div className="text-lg font-semibold text-theme-text-primary">
                  Choose the active data backend
                </div>
                <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4 text-sm leading-6 text-theme-text-secondary">
                  Prism AI supports two explicit backend profiles. Choose the
                  retrieval/storage lane you want this install to run against,
                  then apply it through the normal settings path. You can switch
                  later without hunting through raw env values.
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <ChoiceCard
                    active={formState.vectorBackend === "lancedb"}
                    title="LanceDB"
                    body="Use the local Prism AI vector store inside this profile. This is the lowest-friction lane for fully local installs."
                    footer="Good when you want everything self-contained in the app profile."
                    onClick={() => updateField("vectorBackend", "lancedb")}
                  />
                  <ChoiceCard
                    active={formState.vectorBackend === "pgvector"}
                    title="pgvector"
                    body="Use PostgreSQL with pgvector for shared or larger retrieval corpora. This matches the stronger multi-runtime Prism lane."
                    footer="Good when you want a durable database-backed retrieval lane."
                    onClick={() => updateField("vectorBackend", "pgvector")}
                  />
                </div>

                {formState.vectorBackend === "pgvector" ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <GuidanceCard
                        title="Docker Desktop"
                        status={
                          dependencySequence?.dockerDesktop?.ok
                            ? "ready"
                            : dependencySequence?.dockerDesktop?.installed
                              ? "start it"
                              : "install"
                        }
                        body={
                          dependencySequence?.dockerDesktop?.detail ||
                          "Prism AI needs Docker Desktop for local model installation and Docker Model Runner."
                        }
                        actions={[
                          {
                            label: "Install Docker Desktop",
                            onClick: () =>
                              runDependencyAction({
                                action: "docker_install",
                                fallbackUrl: DOCKER_DESKTOP_URL,
                                successMessage:
                                  "Opening Docker Desktop installer guidance.",
                              }),
                          },
                          {
                            label: "Open Docker Desktop",
                            onClick: () =>
                              runDependencyAction({
                                action: "docker_open",
                                fallbackUrl: DOCKER_DESKTOP_URL,
                                copyFallback: "open -a Docker",
                                successMessage:
                                  "Opening Docker Desktop from Prism AI.",
                              }),
                          },
                          {
                            label: "Copy open -a Docker",
                            onClick: () =>
                              copyText(
                                "open -a Docker",
                                "Docker launch command copied."
                              ),
                          },
                        ]}
                      />
                      <GuidanceCard
                        title="PostgreSQL"
                        status={
                          dependencySequence?.postgresDesktop?.ok
                            ? "ready"
                            : "install"
                        }
                        body={
                          dependencySequence?.postgresDesktop?.detail ||
                          "Prism AI needs PostgreSQL client tools available before the pgvector lane is practical."
                        }
                        actions={[
                          {
                            label: "Install Postgres.app",
                            onClick: () =>
                              runDependencyAction({
                                action: "postgres_install",
                                fallbackUrl: POSTGRES_APP_URL,
                                successMessage:
                                  "Opening Postgres.app installer guidance.",
                              }),
                          },
                          {
                            label: "Open Postgres.app",
                            onClick: () =>
                              runDependencyAction({
                                action: "postgres_open",
                                fallbackUrl: POSTGRES_APP_URL,
                                copyFallback: "open -a Postgres",
                                successMessage:
                                  "Opening Postgres.app from Prism AI.",
                              }),
                          },
                          {
                            label: "Copy psql --version",
                            onClick: () =>
                              copyText(
                                "psql --version",
                                "psql check command copied."
                              ),
                          },
                        ]}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
                      <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                        PostgreSQL connection string
                        <input
                          value={formState.pgConnectionString}
                          onChange={(event) =>
                            updateField(
                              "pgConnectionString",
                              event.target.value
                            )
                          }
                          placeholder="postgresql://username:password@host:5432/database"
                          className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                        Vector table name
                        <input
                          value={formState.pgTableName}
                          onChange={(event) =>
                            updateField("pgTableName", event.target.value)
                          }
                          placeholder={DEFAULT_PGVECTOR_TABLE}
                          className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                        />
                      </label>
                    </div>

                    <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-theme-text-primary">
                            Bootstrap pgvector
                          </div>
                          <div className="mt-1 text-sm text-theme-text-secondary">
                            Create the `vector` extension and ensure the target
                            embedding table exists for the selected embedder
                            dimensions before you finish setup.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={bootstrapPgvector}
                          disabled={bootstrappingPgvector}
                          className="rounded-full bg-theme-primary-button px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {bootstrappingPgvector
                            ? "Bootstrapping..."
                            : "Bootstrap pgvector"}
                        </button>
                      </div>
                      <div className="mt-3 text-xs text-theme-text-secondary">
                        {dependencySequence?.pgvector?.detail ||
                          "Bootstrap status will appear here after inspection."}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                <div className="text-lg font-semibold text-theme-text-primary">
                  Pick the embedder lane
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <ChoiceCard
                    active={formState.embedder === "native"}
                    title="Prism AI native embedder"
                    body="Use the built-in local embedder. This keeps retrieval self-contained and avoids cloud dependency for embeddings."
                    onClick={() => updateField("embedder", "native")}
                  />
                  <ChoiceCard
                    active={formState.embedder === "openai"}
                    title="OpenAI embedder"
                    body="Use OpenAI embeddings, including the common text-embedding-3-large lane you used previously."
                    onClick={() => updateField("embedder", "openai")}
                  />
                </div>

                {formState.embedder === "native" ? (
                  <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-theme-text-primary">
                          Native embedding model
                        </div>
                        <div className="mt-1 text-sm text-theme-text-secondary">
                          Pull the supported native model list from the current
                          profile.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={refreshNativeModels}
                        disabled={refreshingNative}
                        className="rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary transition hover:border-theme-primary-button hover:text-theme-primary-button disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {refreshingNative ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>
                    <div className="mt-4">
                      {nativeModels.length > 0 ? (
                        <select
                          value={formState.embeddingModel}
                          onChange={(event) =>
                            updateField("embeddingModel", event.target.value)
                          }
                          className="w-full rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                        >
                          {nativeModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={formState.embeddingModel}
                          onChange={(event) =>
                            updateField("embeddingModel", event.target.value)
                          }
                          placeholder="native embedding model id"
                          className="w-full rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                        />
                      )}
                    </div>
                  </div>
                ) : null}

                {formState.embedder === "openai" ? (
                  <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
                    <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                      OpenAI API key
                      <input
                        type="password"
                        value={formState.openAiKey}
                        onChange={(event) =>
                          updateField("openAiKey", event.target.value)
                        }
                        placeholder="sk-..."
                        className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                      Embedding model
                      <select
                        value={formState.embeddingModel}
                        onChange={(event) =>
                          updateField("embeddingModel", event.target.value)
                        }
                        className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                      >
                        {OPENAI_EMBEDDING_MODELS.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}

                <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4 text-sm leading-6 text-theme-text-secondary">
                  This first pass keeps the embedder step focused on the two
                  most important Prism AI 1.2 lanes: fully local native
                  retrieval and OpenAI-backed embeddings. Advanced embedder
                  providers remain available in the full settings surface.
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                      Docker Desktop
                    </div>
                    <div className="mt-2 text-sm font-semibold text-theme-text-primary">
                      {dependencySequence?.dockerDesktop?.status || "unknown"}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
                      {dependencySequence?.dockerDesktop?.detail ||
                        "Docker readiness has not been inspected yet."}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                      pgvector readiness
                    </div>
                    <div className="mt-2 text-sm font-semibold text-theme-text-primary">
                      {dependencySequence?.pgvector?.status || "unknown"}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
                      {dependencySequence?.pgvector?.detail ||
                        "pgvector readiness has not been inspected yet."}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {(dependencySequence?.backendProfiles || []).map(
                    (profile) => (
                      <div
                        key={profile.id}
                        className={[
                          "rounded-[18px] border px-4 py-4",
                          profile.active
                            ? "border-theme-primary-button bg-theme-primary-button/10"
                            : "border-theme-sidebar-border bg-theme-sidebar-item-default",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-theme-text-primary">
                            {profile.label}
                          </div>
                          {profile.active ? (
                            <div className="rounded-full border border-theme-primary-button/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-primary-button">
                              Active
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
                          {profile.detail}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="text-lg font-semibold text-theme-text-primary">
                  Connect the local chat model
                </div>
                <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                  <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                    Docker Model Runner base URL
                    <input
                      value={formState.dockerBasePath}
                      onChange={(event) =>
                        updateField("dockerBasePath", event.target.value)
                      }
                      placeholder={DOCKER_DEFAULT_BASE_PATH}
                      className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-theme-text-secondary">
                    Context window
                    <input
                      value={formState.dockerTokenLimit}
                      onChange={(event) =>
                        updateField("dockerTokenLimit", event.target.value)
                      }
                      placeholder="8192"
                      className="rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                    />
                  </label>
                </div>

                <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-theme-text-primary">
                        Local Docker model
                      </div>
                      <div className="mt-1 text-sm text-theme-text-secondary">
                        Refresh the models currently exposed by Docker Model
                        Runner.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={refreshDockerModels}
                      disabled={refreshingDocker}
                      className="rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary transition hover:border-theme-primary-button hover:text-theme-primary-button disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {refreshingDocker ? "Refreshing..." : "Refresh Models"}
                    </button>
                  </div>
                  <div className="mt-4">
                    {dockerModels.length > 0 ? (
                      <select
                        value={formState.dockerModel}
                        onChange={(event) =>
                          updateField("dockerModel", event.target.value)
                        }
                        className="w-full rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                      >
                        <option value="">Select a model</option>
                        {dockerModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={formState.dockerModel}
                        onChange={(event) =>
                          updateField("dockerModel", event.target.value)
                        }
                        placeholder="docker.io/ai/qwen3:latest"
                        className="w-full rounded-xl border border-theme-sidebar-border bg-theme-bg-primary px-3 py-3 text-sm text-theme-text-primary outline-none"
                      />
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={installDockerModel}
                      disabled={
                        installingDockerModel || !formState.dockerModel.trim()
                      }
                      className="rounded-full bg-theme-primary-button px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {installingDockerModel
                        ? `Installing... ${installProgress}%`
                        : "Install selected model"}
                    </button>
                    <button
                      type="button"
                      onClick={loadDependencySequence}
                      disabled={refreshingDependencies}
                      className="rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary transition hover:border-theme-primary-button hover:text-theme-primary-button disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {refreshingDependencies
                        ? "Refreshing status..."
                        : "Refresh dependency status"}
                    </button>
                    <div className="text-xs text-theme-text-secondary">
                      {selectedDockerModelInstalled
                        ? "Selected model is installed locally."
                        : "Selected model is not installed yet. Prism AI will prefer qwen3, qwen2.5, or smollm2 when available."}
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4 text-sm leading-6 text-theme-text-secondary">
                  This step uses the existing underlying Docker Model Runner
                  installation flow so the local model you install here is the
                  same one Prism AI will use after onboarding completes.
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="text-lg font-semibold text-theme-text-primary">
                  Review the setup that will be applied
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                      Data backend
                    </div>
                    <div className="mt-2 text-lg font-semibold text-theme-text-primary">
                      {formState.vectorBackend}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
                      {formState.vectorBackend === "pgvector"
                        ? `${formState.pgTableName || DEFAULT_PGVECTOR_TABLE} / shared PostgreSQL profile`
                        : "Local LanceDB profile in this app storage directory"}
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                      Embedder
                    </div>
                    <div className="mt-2 text-lg font-semibold text-theme-text-primary">
                      {summarizeEmbedder(formState)}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
                      {formState.embedder === "openai"
                        ? "OpenAI credentials will be stored through the normal Prism AI settings path."
                        : "Native embeddings stay fully local."}
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                      Local chat model
                    </div>
                    <div className="mt-2 text-lg font-semibold text-theme-text-primary">
                      {formState.dockerModel || "unset"}
                    </div>
                    <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
                      Docker Model Runner /{" "}
                      {formState.dockerTokenLimit || "8192"} tokens
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-emerald-400/35 bg-emerald-400/10 px-4 py-4 text-sm leading-6 text-theme-text-primary">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle
                      size={18}
                      weight="fill"
                      className="text-emerald-300"
                    />
                    Apply real profile settings
                  </div>
                  <div className="mt-2 text-theme-text-secondary">
                    This will update the active Prism AI profile through the
                    existing underlying system settings path, then continue the
                    onboarding sequence with those real settings in place.
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex shrink-0 items-center justify-between gap-4 border-t border-theme-sidebar-border px-6 pb-7 pt-5 md:px-8 md:pb-8">
            <div className="text-sm text-rose-300">{validationError || ""}</div>
            <div className="flex flex-wrap items-center gap-3">
              {step > 0 || onBack ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (step > 0) {
                      const nextStep = Math.max(0, step - 1);
                      await persistCurrentDraft(nextStep, formState);
                      setStep(nextStep);
                      return;
                    }
                    onBack();
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-theme-sidebar-border px-4 py-2 text-sm font-medium text-theme-text-primary transition hover:border-theme-primary-button hover:text-theme-primary-button"
                >
                  <ArrowLeft size={16} weight="bold" />
                  Back
                </button>
              ) : null}

              {step < STEP_LABELS.length - 1 ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!validationError) {
                      const nextStep = Math.min(
                        STEP_LABELS.length - 1,
                        step + 1
                      );
                      await persistCurrentDraft(nextStep, formState);
                      setStep(nextStep);
                    }
                  }}
                  disabled={!!validationError}
                  className="inline-flex items-center gap-2 rounded-full bg-theme-primary-button px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ArrowRight size={16} weight="bold" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applySetup}
                  disabled={saving}
                  className="rounded-full bg-theme-primary-button px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? "Applying setup..." : "Apply setup"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
