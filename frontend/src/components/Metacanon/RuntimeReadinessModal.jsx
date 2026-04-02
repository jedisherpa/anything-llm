import { useEffect, useMemo, useState } from "react";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";

import ModalWrapper from "@/components/ModalWrapper";
import PreLoader from "@/components/Preloader";
import System from "@/models/system";
import { runDesktopDependencyAction } from "@/utils/desktopRuntime";
import { loadPrismSetupCompleted } from "@/utils/prismSetupState";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";

const DOCKER_DESKTOP_URL = "https://www.docker.com/products/docker-desktop/";
const POSTGRES_APP_URL = "https://postgresapp.com/";

function openExternal(url = "") {
  if (!url || typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
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
    await copyCommand(copyFallback, `${copyFallback} copied.`);
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

async function copyCommand(command = "", label = "Command copied.") {
  try {
    await navigator.clipboard.writeText(command);
    showToast(label, "success");
  } catch {
    showToast("Failed to copy command.", "error");
    return;
  }
}

function ReadinessRow({ label, state }) {
  const icon =
    state?.status === "ready" ? (
      <CheckCircle size={18} weight="fill" className="text-emerald-400" />
    ) : state?.status === "inactive" ? (
      <Clock size={18} weight="fill" className="text-amber-300" />
    ) : (
      <WarningCircle size={18} weight="fill" className="text-rose-300" />
    );

  return (
    <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
      <div className="flex items-center gap-3">
        {icon}
        <div className="text-[14px] font-semibold text-theme-text-primary">
          {label}
        </div>
      </div>
      <div className="mt-2 text-[13px] leading-6 text-theme-text-secondary">
        {state?.detail || "No status available."}
      </div>
    </div>
  );
}

function SurfaceLink({ href, label }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.assign(href);
      }}
      className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
    >
      {label}
    </button>
  );
}

export default function RuntimeReadinessModal({
  isOpen = false,
  onClose = () => {},
  workspaceSlug = null,
  onOpenSetup = () => {},
}) {
  const [loading, setLoading] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const lastSetup = useMemo(() => loadPrismSetupCompleted(), []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    System.prismReadiness(workspaceSlug)
      .then((result) => {
        if (!cancelled) setReadiness(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, workspaceSlug]);

  const headline = useMemo(() => {
    if (!readiness) return "Inspect the local stack before you rely on it.";
    if (readiness.error) return readiness.error;
    if (!readiness.onboardingComplete)
      return "Finish first-run setup and verify the local stack before relying on this profile.";
    return "Inspect the active Prism profile, local model path, database path, and workspace query readiness.";
  }, [readiness]);

  const rows = useMemo(() => {
    if (!readiness || readiness.error) return [];
    return [
      {
        label: "Runtime env",
        state: readiness.services?.runtimeConfig,
      },
      {
        label: "Document processor",
        state: readiness.services?.documentProcessor,
      },
      {
        label: "Docker Desktop",
        state: readiness.services?.dockerDesktop,
      },
      {
        label: "PostgreSQL desktop tools",
        state: readiness.services?.postgresDesktop,
      },
      {
        label: "Workspace query",
        state: readiness.workspaceQuery,
      },
      {
        label: "Docker Model Runner",
        state: readiness.llm?.dockerModelRunner,
      },
      {
        label: "pgvector",
        state: readiness.vector?.pgvector,
      },
    ];
  }, [readiness]);

  return (
    <ModalWrapper isOpen={isOpen}>
      <div className="metacanon-modal-panel relative flex max-h-[calc(100vh-2rem)] w-[min(92vw,960px)] flex-col overflow-hidden rounded-[28px] px-6 pb-7 pt-6 md:px-8 md:pb-8 md:pt-7">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border-none bg-transparent text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
          aria-label="Close readiness modal"
        >
          <X size={18} weight="bold" />
        </button>

        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-home-text-secondary">
          System Readiness
        </div>
        <h2 className="mt-3 text-[34px] font-semibold leading-[1.02] text-theme-text-primary md:text-[42px]">
          Prism setup and runtime status
        </h2>
        <p className="mt-4 max-w-[820px] text-[15px] leading-7 text-theme-text-secondary">
          {headline}
        </p>

        {loading ? (
          <div className="mt-8 flex min-h-[260px] flex-1 items-center justify-center">
            <PreLoader size="[88px]" />
          </div>
        ) : (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                  Storage profile
                </div>
                <div className="mt-2 text-lg font-semibold text-theme-text-primary">
                  {readiness?.storageProfile || "default"}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-theme-text-secondary">
                  {readiness?.machine?.storageDir ||
                    "No storage directory found."}
                </div>
              </div>
              <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                  Chat model
                </div>
                <div className="mt-2 text-lg font-semibold text-theme-text-primary">
                  {readiness?.llm?.provider || "unset"}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-theme-text-secondary">
                  {readiness?.llm?.model || "No model configured."}
                </div>
              </div>
              <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                  Data backend
                </div>
                <div className="mt-2 text-lg font-semibold text-theme-text-primary">
                  {readiness?.vector?.backend || "lancedb"}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-theme-text-secondary">
                  Embedder: {readiness?.embeddings?.engine || "native"} /{" "}
                  {readiness?.embeddings?.model || "default"}
                </div>
              </div>
              <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                  Last guided setup
                </div>
                <div className="mt-2 text-lg font-semibold text-theme-text-primary">
                  {lastSetup?.completedAt
                    ? new Date(lastSetup.completedAt).toLocaleString()
                    : "Not recorded"}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-theme-text-secondary">
                  {lastSetup
                    ? `${lastSetup.vectorBackend || "unknown"} / ${
                        lastSetup.embedder || "unknown"
                      } / ${lastSetup.dockerModel || "unset"}`
                    : "No completed guided setup has been recorded on this profile yet."}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {rows.map((row) => (
                <ReadinessRow
                  key={row.label}
                  label={row.label}
                  state={row.state}
                />
              ))}
            </div>

            <div className="mt-6 rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                Backend profiles
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(readiness?.vector?.profiles || []).map((profile) => (
                  <div
                    key={profile.id}
                    className={[
                      "rounded-[18px] border px-4 py-4",
                      profile.active
                        ? "border-theme-primary-button bg-theme-primary-button/10"
                        : "border-theme-sidebar-border bg-theme-bg-primary",
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
                    <div className="mt-2 text-[13px] leading-6 text-theme-text-secondary">
                      {profile.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                Next moves
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSetup();
                  }}
                  className="rounded-full bg-theme-primary-button px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-black transition hover:opacity-90"
                >
                  Run guided setup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSetup();
                  }}
                  className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
                >
                  Switch backend profile
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runDependencyAction({
                      action: "docker_install",
                      fallbackUrl: DOCKER_DESKTOP_URL,
                      successMessage:
                        "Opening Docker Desktop installer guidance.",
                    })
                  }
                  className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
                >
                  Install Docker Desktop
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runDependencyAction({
                      action: "postgres_install",
                      fallbackUrl: POSTGRES_APP_URL,
                      successMessage:
                        "Opening Postgres.app installer guidance.",
                    })
                  }
                  className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
                >
                  Install Postgres.app
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runDependencyAction({
                      action: "docker_open",
                      fallbackUrl: DOCKER_DESKTOP_URL,
                      copyFallback: "open -a Docker",
                      successMessage: "Opening Docker Desktop from Prism.",
                    })
                  }
                  className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
                >
                  Open Docker Desktop
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runDependencyAction({
                      action: "postgres_open",
                      fallbackUrl: POSTGRES_APP_URL,
                      copyFallback: "open -a Postgres",
                      successMessage: "Opening Postgres.app from Prism.",
                    })
                  }
                  className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
                >
                  Open Postgres.app
                </button>
                <button
                  type="button"
                  onClick={() => {
                    copyCommand(
                      "open -a Docker",
                      "Docker launch command copied."
                    );
                  }}
                  className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
                >
                  Copy open -a Docker
                </button>
                <SurfaceLink
                  href={paths.settings.llmPreference()}
                  label="Open LLM setup"
                />
                <SurfaceLink
                  href={paths.settings.embeddingPreference()}
                  label="Open embedder setup"
                />
                <SurfaceLink
                  href={paths.settings.vectorDatabase()}
                  label="Open vector setup"
                />
                <SurfaceLink
                  href={paths.settings.agentSkills()}
                  label="Open runtime controls"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
}
