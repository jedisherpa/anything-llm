import { useState, useEffect } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";
import { XCircle } from "@phosphor-icons/react/dist/csr/XCircle";

function StatusPill({ status }) {
  const config = {
    pass: { label: "Pass", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
    warn: { label: "Warn", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
    fail: { label: "Fail", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
    ready: { label: "Ready", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
    setup: { label: "Setup", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  };
  const { label, cls } = config[status] || config.warn;
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] border ${cls}`}>
      {label}
    </span>
  );
}

function StatusIcon({ status }) {
  if (status === "pass" || status === "ready") return <CheckCircle className="h-4 w-4 text-green-400" />;
  if (status === "warn" || status === "setup") return <Warning className="h-4 w-4 text-yellow-400" />;
  return <XCircle className="h-4 w-4 text-red-400" />;
}

// Simulated data — in production, these would come from Tauri commands or MCP calls
function useSetupData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    // Simulate API call — replace with actual Tauri/MCP integration
    setTimeout(() => {
      setData({
        dependencies: [
          { check_id: "os", label: "Operating System", status: "pass", detail: `${navigator.platform} is supported.` },
          { check_id: "docker", label: "Docker", status: "warn", detail: "Check Docker status via CLI: metacanon check-setup" },
          { check_id: "postgres", label: "PostgreSQL", status: "warn", detail: "Check via CLI: metacanon check-setup" },
          { check_id: "node", label: "Node.js", status: "pass", detail: "Required for Sphere Thread Engine." },
          { check_id: "ollama", label: "Ollama Runtime", status: "warn", detail: "Check via CLI: metacanon check-setup" },
        ],
        features: [
          { feature_id: "local_llm", label: "Local LLM", ready: false, install_hint: "ollama pull qwen3.5:32b-instruct-q8_0" },
          { feature_id: "council", label: "Council Deliberation", ready: false, install_hint: "Create 2+ sub-spheres in Council page" },
          { feature_id: "sphere_thread", label: "Encrypted Agent Comms", ready: false, install_hint: "Create 2+ sub-spheres" },
          { feature_id: "mcp_server", label: "MCP Server", ready: true, install_hint: "Ready" },
          { feature_id: "file_tools", label: "File Agent Skills", ready: true, install_hint: "Ready" },
          { feature_id: "tool_scoring", label: "Tool Selection", ready: true, install_hint: "5 tools registered" },
          { feature_id: "sphere_engine", label: "Sphere Thread Engine", ready: false, install_hint: "Install Docker + PostgreSQL" },
          { feature_id: "telegram", label: "Telegram Integration", ready: false, install_hint: "Configure bot token" },
          { feature_id: "discord", label: "Discord Integration", ready: false, install_hint: "Configure bot token" },
        ],
      });
      setLoading(false);
    }, 600);
  };

  useEffect(() => { refresh(); }, []);
  return { data, loading, refresh };
}

export default function SetupStatusPage() {
  const { data, loading, refresh } = useSetupData();
  const readyCount = data?.features.filter(f => f.ready).length || 0;
  const totalFeatures = data?.features.length || 0;

  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:px-6 md:py-6 py-20 gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">
                PrismAI
              </div>
              <h1 className="text-2xl font-semibold text-theme-text-primary mt-1">
                Setup Status
              </h1>
              <p className="text-sm text-theme-text-secondary mt-2 max-w-xl">
                Check what's installed, what's missing, and how to set up each component for the full PrismAI experience.
              </p>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-action-menu-item-hover transition-all disabled:opacity-50"
            >
              <ArrowsClockwise className={`h-4 w-4 inline mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading && !data ? (
            <div className="text-theme-text-secondary text-sm">Checking system status...</div>
          ) : (
            <>
              {/* System Dependencies */}
              <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary mb-4">
                  System Dependencies
                </h2>
                <div className="flex flex-col gap-3">
                  {data?.dependencies.map((dep) => (
                    <div key={dep.check_id} className="flex items-center justify-between rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-3">
                      <div className="flex items-center gap-3">
                        <StatusIcon status={dep.status} />
                        <div>
                          <span className="text-sm font-medium text-theme-text-primary">{dep.label}</span>
                          <p className="text-xs text-theme-text-secondary mt-0.5">{dep.detail}</p>
                        </div>
                      </div>
                      <StatusPill status={dep.status} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Readiness */}
              <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
                    Feature Readiness
                  </h2>
                  <span className="text-sm text-theme-text-secondary">
                    {readyCount}/{totalFeatures} ready
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {data?.features.map((feature) => (
                    <div key={feature.feature_id} className="rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-theme-text-primary">{feature.label}</span>
                        <StatusPill status={feature.ready ? "ready" : "setup"} />
                      </div>
                      <p className="text-xs text-theme-text-secondary font-mono">{feature.install_hint}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Install */}
              {data?.features.some(f => !f.ready) && (
                <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary mb-4">
                    Quick Install
                  </h2>
                  <p className="text-xs text-theme-text-secondary mb-3">
                    Run <code className="text-theme-text-primary font-mono bg-theme-settings-input-bg px-1 py-0.5 rounded">metacanon check-setup</code> in your terminal for live dependency checks and install commands.
                  </p>
                  <div className="flex flex-col gap-2">
                    {data?.features.filter(f => !f.ready).map((feature) => (
                      <div key={feature.feature_id} className="flex items-center gap-3 text-xs">
                        <Warning className="h-3 w-3 text-yellow-400 shrink-0" />
                        <span className="text-theme-text-secondary">
                          <strong className="text-theme-text-primary">{feature.label}</strong> — {feature.install_hint}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
