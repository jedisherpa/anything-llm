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
  { x1: 421.8, y1: 215.0, x2: 489.8, y2: 338.0, depth: -1.224 },
  { x1: 489.8, y1: 338.0, x2: 599.8, y2: 397.4, depth: -1.129 },
  { x1: 269.1, y1: 250.0, x2: 242.8, y2: 394.5, depth: -0.992 },
  { x1: 421.8, y1: 215.0, x2: 269.1, y2: 250.0, depth: -0.851 },
  { x1: 200.2, y1: 488.9, x2: 242.8, y2: 394.5, depth: -0.754 },
  { x1: 557.2, y1: 545.0, x2: 420.9, y2: 576.9, depth: -0.744 },
  { x1: 557.2, y1: 545.0, x2: 599.8, y2: 397.4, depth: -0.603 },
  { x1: 310.3, y1: 601.6, x2: 420.9, y2: 576.9, depth: -0.600 },
  { x1: 421.8, y1: 215.0, x2: 489.7, y2: 198.4, depth: -0.385 },
  { x1: 599.8, y1: 311.1, x2: 599.8, y2: 397.4, depth: -0.232 },
  { x1: 200.2, y1: 488.9, x2: 310.3, y2: 601.6, depth: -0.228 },
  { x1: 242.8, y1: 255.0, x2: 269.1, y2: 250.0, depth: -0.153 },
  { x1: 557.2, y1: 545.0, x2: 530.9, y2: 550.0, depth: 0.153 },
  { x1: 599.8, y1: 311.1, x2: 489.7, y2: 198.4, depth: 0.228 },
  { x1: 200.2, y1: 488.9, x2: 200.2, y2: 402.6, depth: 0.232 },
  { x1: 378.2, y1: 585.0, x2: 310.3, y2: 601.6, depth: 0.385 },
  { x1: 379.1, y1: 223.1, x2: 489.7, y2: 198.4, depth: 0.600 },
  { x1: 242.8, y1: 255.0, x2: 200.2, y2: 402.6, depth: 0.603 },
  { x1: 242.8, y1: 255.0, x2: 379.1, y2: 223.1, depth: 0.744 },
  { x1: 599.8, y1: 311.1, x2: 557.2, y2: 405.5, depth: 0.754 },
  { x1: 378.2, y1: 585.0, x2: 530.9, y2: 550.0, depth: 0.851 },
  { x1: 557.2, y1: 405.5, x2: 530.9, y2: 550.0, depth: 0.992 },
  { x1: 200.2, y1: 402.6, x2: 310.2, y2: 462.0, depth: 1.129 },
  { x1: 378.2, y1: 585.0, x2: 310.2, y2: 462.0, depth: 1.224 },
  { x1: 420.8, y1: 351.1, x2: 379.1, y2: 223.1, depth: 1.356 },
  { x1: 420.8, y1: 351.1, x2: 557.2, y2: 405.5, depth: 1.451 },
  { x1: 420.8, y1: 351.1, x2: 310.2, y2: 462.0, depth: 1.595 },
];

function getDodecahedronLineClass(depth) {
  if (depth < -0.7) return "metacanon-cathedral-backform__line metacanon-cathedral-backform__line--far";
  if (depth > 0.7) return "metacanon-cathedral-backform__line metacanon-cathedral-backform__line--near";
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
          </div>

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
          />
        </div>

        <div className="metacanon-home-footer flex w-full items-end justify-between gap-4">
          <div className="metacanon-home-footer__model">
            <WorkspaceModelPicker
              workspaceSlug={workspaceSlug}
              compact={true}
            />
          </div>
          <div className="metacanon-home-manifesto">{themeCopy.inscription}</div>
        </div>
      </div>
    </div>
  );
}
