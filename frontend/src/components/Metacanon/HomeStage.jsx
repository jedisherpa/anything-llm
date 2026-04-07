import PromptInput from "@/components/WorkspaceChat/ChatContainer/PromptInput";
import WorkspaceModelPicker from "@/components/WorkspaceChat/ChatContainer/WorkspaceModelPicker";
import QuickActions from "@/components/lib/QuickActions";
import { MetacanonHeroGlyph } from "./Branding";
import MetacanonThemeSwitcher from "./ThemeSwitcher";
import { useTheme } from "@/hooks/useTheme";

const CATHEDRAL_DODECAHEDRON_LINES = [
  { x1: 379.2, y1: 448.9, x2: 489.8, y2: 338.0, depth: -1.595 },
  { x1: 379.2, y1: 448.9, x2: 242.8, y2: 394.5, depth: -1.451 },
  { x1: 379.2, y1: 448.9, x2: 420.9, y2: 576.9, depth: -1.356 },
  { x1: 421.8, y1: 215.0, x2: 489.8, y2: 338, depth: -1.224 },
  { x1: 489.8, y1: 338, x2: 599.8, y2: 397.4, depth: -1.129 },
  { x1: 269.1, y1: 250.0, x2: 242.8, y2: 394.5, depth: -0.992 },
  { x1: 421.8, y1: 215.0, x2: 269.1, y2: 250.0, depth: -0.851 },
  { x1: 200.2, y1: 488.9, x2: 242.8, y2: 394.5, depth: -0.754 },
  { x1: 557.2, y1: 545.0, x2: 420.9, y2: 576.9, depth: -0.744 },
  { x1: 557.2, y1: 545.0, x2: 599.8, y2: 397.4, depth: -0.603 },
  { x1: 310.3, y1: 601.6, x2: 420.9, y2: 576.9, depth: -0.6 },
  { x1: 421.8, y1: 215.0, x2: 489.7, y2: 198.4, depth: -0.385 },
  { x1: 599.8, y1: 311.1, x2: 599.8, y2: 397.4, depth: -0.232 },
  { x1: 200.2, y1: 488.9, x2: 310.3, y2: 601.6, depth: -0.228 },
  { x1: 242.8, y1: 255.0, x2: 269.1, y2: 250.0, depth: -0.153 },
  { x1: 557.2, y1: 545.0, x2: 530.9, y2: 550.0, depth: 0.153 },
  { x1: 599.8, y1: 311.1, x2: 489.7, y2: 198.4, depth: 0.228 },
  { x1: 200.2, y1: 488.9, x2: 200.2, y2: 402.6, depth: 0.232 },
  { x1: 378.2, y1: 585, x2: 310.3, y2: 601.6, depth: 0.385 },
  { x1: 379.1, y1: 223.1, x2: 489.7, y2: 198.4, depth: 0.6 },
  { x1: 242.8, y1: 255.0, x2: 200.2, y2: 402.6, depth: 0.603 },
  { x1: 242.8, y1: 255.0, x2: 379.1, y2: 223.1, depth: 0.744 },
  { x1: 599.8, y1: 311.1, x2: 557.2, y2: 405.5, depth: 0.754 },
  { x1: 378.2, y1: 585.0, x2: 530.9, y2: 550.0, depth: 0.851 },
  { x1: 557.2, y1: 405.5, x2: 530.9, y2: 550.0, depth: 0.992 },
  { x1: 200.2, y1: 402.6, x2: 310.2, y2: 462.0, depth: 1.129 },
  { x1: 378.2, y1: 585.0, x2: 310.2, y2: 462, depth: 1.224 },
  { x1: 420.8, y1: 351.1, x2: 379.1, y2: 223.1, depth: 1.356 },
  { x1: 420.8, y1: 351.1, x2: 557.2, y2: 405.5, depth: 1.451 },
  { x1: 420.8, y1: 351.1, x2: 310.2, y2: 462.0, depth: 1.595 },
];

function getDodecahedronLineClass(depth) {
  if (depth < -0.7)
    return "metacanon-cathedral-backform__line metacanon-cathedral-backform__line--far";
  if (depth > 0.7)
    return "metacanon-cathedral-backform__line metacanon-cathedral-backform__line--near";
  return "metacanon-cathedral-backform__line metacanon-cathedral-backform__line--mid";
}

function CathedralBackform() {
  return (
    <div className="metacanon-cathedral-backform" aria-hidden="true">
      <svg
        viewBox="0 0 800 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="metacanon-cathedral-backform__svg"
      >
        <g className="metacanon-cathedral-backform__core">
          {CATHEDRAL_DODECAHEDRON_LINES.map((line, index) => (
            <line
              key={`${line.x1}-${line.y1}-${line.x2}-${line.y2}-${index}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              className={getDodecahedronLineClass(line.depth)}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

export default function MetacanonHomeStage({
  submit,
  isStreaming,
  sendCommand,
  attachments = [],
  workspaceSlug = null,
  threadSlug = null,
  chatMode = "chat",
  onChatModeChange = null,
  hasAvailableWorkspace,
  onCreateAgent,
  onConnectLLM,
  onEditWorkspace,
  onUploadDocument,
  onOpenReadiness,
  onOpenSetup,
  showFirstRunHint = false,
  onDismissFirstRunHint = null,
  setupNeedsAttention = false,
}) {
  const { resolvedTheme } = useTheme();
  const themeCopy =
    resolvedTheme === "cathedral"
      ? {
          tagline: "structure & soul",
          inscription: "sovereignty is not a feature • it is the architecture",
        }
      : resolvedTheme === "light"
        ? {
            tagline: "Structure & Soul",
            inscription: "crafted with care",
          }
        : {
            tagline: "structure & soul",
            inscription: "the architecture of the self",
          };

  return (
    <div
      data-prism-theme={resolvedTheme}
      className="metacanon-home-stage relative flex h-full w-full items-center justify-center px-6 pt-10 pb-4"
    >
      {resolvedTheme === "cathedral" ? <CathedralBackform /> : null}
      <div className="absolute right-[64px] top-3 z-20 hidden md:flex">
        <MetacanonThemeSwitcher />
      </div>
      <div className="relative z-10 flex h-full w-full max-w-[1220px] flex-col">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-3 flex flex-col items-center">
            <MetacanonHeroGlyph className="h-[168px] w-[168px]" />
          </div>

          <div className="metacanon-home-copy flex flex-col items-center text-center">
            <h1 className="metacanon-home-title text-[42px] font-normal leading-[1.08] tracking-[-0.03em] text-theme-text-primary md:text-[50px]">
              How can I{" "}
              <span className="metacanon-home-title-accent font-medium">
                help
              </span>{" "}
              you today?
            </h1>
            <p className="metacanon-home-subtitle mt-3 text-[15px] font-normal tracking-[0.22em] text-theme-home-text-secondary uppercase">
              {themeCopy.tagline}
            </p>
            {setupNeedsAttention ? (
              <div className="mt-3 rounded-full border border-theme-primary-button/30 bg-theme-primary-button/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-primary-button">
                Guided setup needs attention
              </div>
            ) : null}
          </div>

          {showFirstRunHint ? (
            <div className="mt-5 w-full max-w-[816px] rounded-[22px] border border-theme-sidebar-border bg-theme-sidebar-item-default/70 px-5 py-4 text-left shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                    First run
                  </div>
                  <div className="mt-1 text-[15px] font-medium text-theme-text-primary">
                    Talk naturally. Prism will handle the routing.
                  </div>
                  <div className="mt-2 space-y-1 text-[13px] leading-6 text-theme-text-secondary">
                    <div>
                      Use{" "}
                      <span className="font-semibold text-theme-text-primary">
                        CHAT
                      </span>{" "}
                      for open-ended help and drafting.
                    </div>
                    <div>
                      Use{" "}
                      <span className="font-semibold text-theme-text-primary">
                        QUERY
                      </span>{" "}
                      when you want Prism to search this workspace.
                    </div>
                    <div>
                      Use{" "}
                      <span className="font-semibold text-theme-text-primary">
                        Align
                      </span>{" "}
                      when you want a lens or constellation voice.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onDismissFirstRunHint}
                  className="rounded-full border border-theme-sidebar-border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
                >
                  Dismiss
                </button>
              </div>
              <div className="mt-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onOpenSetup}
                    className="rounded-full bg-theme-primary-button px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white transition hover:opacity-90"
                  >
                    Run guided setup
                  </button>
                  <button
                    type="button"
                    onClick={onOpenReadiness}
                    className="rounded-full border border-theme-sidebar-border px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
                  >
                    Check setup status
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex w-full justify-center">
            <PromptInput
              submit={submit}
              isStreaming={isStreaming}
              sendCommand={sendCommand}
              attachments={attachments}
              centered={true}
              workspaceSlug={workspaceSlug}
              threadSlug={threadSlug}
              chatMode={chatMode}
              onChatModeChange={onChatModeChange}
            />
          </div>

          <QuickActions
            hasAvailableWorkspace={hasAvailableWorkspace}
            onCreateAgent={onCreateAgent}
            onConnectLLM={onConnectLLM}
            onEditWorkspace={onEditWorkspace}
            onUploadDocument={onUploadDocument}
            onOpenReadiness={onOpenReadiness}
            onOpenSetup={onOpenSetup}
          />
        </div>

        <div className="metacanon-home-footer flex w-full items-end justify-between gap-4">
          <div className="metacanon-home-footer__model">
            <WorkspaceModelPicker
              workspaceSlug={workspaceSlug}
              compact={true}
            />
          </div>
          <div className="metacanon-home-manifesto">
            {themeCopy.inscription}
          </div>
        </div>
      </div>
    </div>
  );
}
