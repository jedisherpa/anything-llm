import { useState } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { Lightning } from "@phosphor-icons/react/dist/csr/Lightning";

function MemberOutputCard({ member }) {
  return (
    <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-settings-input-bg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-theme-text-primary">{member.name}</span>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] border border-theme-sidebar-border text-theme-text-secondary">
            {member.provider_id}
          </span>
          <span className="text-[10px] text-theme-text-secondary">{member.latency_ms}ms</span>
        </div>
      </div>
      <p className="text-sm text-theme-text-secondary leading-relaxed whitespace-pre-wrap">
        {member.output_text}
      </p>
    </div>
  );
}

function SynthesisCard({ synthesis }) {
  if (!synthesis) return null;
  return (
    <div className="rounded-[16px] border-2 border-theme-primary-button/30 bg-theme-bg-sidebar p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lightning className="h-4 w-4 text-theme-primary-button" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
          Council Verdict
        </span>
      </div>
      <p className="text-sm text-theme-text-primary leading-relaxed whitespace-pre-wrap">
        {synthesis.output_text}
      </p>
      <p className="text-[10px] text-theme-text-secondary mt-3">
        Synthesized by {synthesis.provider_id} via {synthesis.model}
      </p>
    </div>
  );
}

export default function CouncilPage() {
  const [query, setQuery] = useState("");
  const [sphereInput, setSphereInput] = useState("analysis, risk, feasibility");
  const [mode, setMode] = useState("manual");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const convene = () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);

    // Simulate council deliberation — replace with MCP/Tauri call
    setTimeout(() => {
      const spheres = sphereInput.split(",").map(s => s.trim()).filter(Boolean);
      setResult({
        query: query,
        members_requested: spheres,
        member_outputs: spheres.map((name, i) => ({
          name,
          sub_sphere_id: `ss-${name}`,
          provider_id: "qwen_local",
          model: "Qwen 3.5 32B",
          output_text: `[${name}] Specialist perspective on: "${query}"\n\nThis is the ${name} council member's analysis. In a live environment, this would contain the actual LLM response routed through the MetaCanon runtime.`,
          latency_ms: 120 + i * 40,
        })),
        member_failures: [],
        synthesis: spheres.length >= 2 ? {
          provider_id: "qwen_local",
          model: "Qwen 3.5 32B",
          output_text: `Synthesized verdict from ${spheres.length} council members on: "${query}"\n\nThe council has deliberated across ${spheres.join(", ")} perspectives. In production, this would be the Prism-synthesized unified recommendation.`,
        } : null,
      });
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:px-6 md:py-6 py-20 gap-6">
          {/* Header */}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">
              PrismAI
            </div>
            <h1 className="text-2xl font-semibold text-theme-text-primary mt-1">
              Council Deliberation
            </h1>
            <p className="text-sm text-theme-text-secondary mt-2 max-w-xl">
              Convene a council of specialist agents to deliberate on complex queries.
              Each member contributes their perspective, then Prism synthesizes a unified verdict.
            </p>
          </div>

          {/* Controls */}
          <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6 flex flex-col gap-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
                Mode
              </span>
              <div className="flex rounded-full border border-theme-sidebar-border overflow-hidden">
                {["manual", "auto"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-all ${
                      mode === m
                        ? "bg-theme-primary-button/20 text-theme-primary-button"
                        : "text-theme-text-secondary hover:text-theme-text-primary"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <span className="text-xs text-theme-text-secondary">
                {mode === "auto" ? "Complex queries auto-route to council" : "Manually convene councils"}
              </span>
            </div>

            {/* Sphere Names */}
            <div>
              <label className="text-xs font-medium text-theme-text-secondary block mb-1">
                Council Members (comma-separated sphere names)
              </label>
              <input
                type="text"
                value={sphereInput}
                onChange={(e) => setSphereInput(e.target.value)}
                placeholder="analysis, risk, feasibility, compliance"
                className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2.5 text-sm text-theme-text-primary placeholder:text-theme-text-secondary/50 focus:outline-none focus:border-theme-primary-button/50"
              />
            </div>

            {/* Query Input */}
            <div>
              <label className="text-xs font-medium text-theme-text-secondary block mb-1">
                Deliberation Query
              </label>
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter a complex query for the council to deliberate on..."
                rows={3}
                className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2.5 text-sm text-theme-text-primary placeholder:text-theme-text-secondary/50 focus:outline-none focus:border-theme-primary-button/50 resize-none"
              />
            </div>

            {/* Convene Button */}
            <button
              onClick={convene}
              disabled={loading || !query.trim()}
              className="self-start rounded-[14px] bg-theme-primary-button px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-40 flex items-center gap-2"
            >
              <UsersThree className="h-4 w-4" />
              {loading ? "Convening..." : "Convene Council"}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="flex flex-col gap-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
                Member Outputs ({result.member_outputs.length})
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {result.member_outputs.map((member) => (
                  <MemberOutputCard key={member.sub_sphere_id} member={member} />
                ))}
              </div>

              {result.member_failures.length > 0 && (
                <div className="text-xs text-red-400">
                  {result.member_failures.length} member(s) failed to respond.
                </div>
              )}

              <SynthesisCard synthesis={result.synthesis} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
