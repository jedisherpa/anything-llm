import PromptInput from "@/components/WorkspaceChat/ChatContainer/PromptInput";
import QuickActions from "@/components/lib/QuickActions";
import { MetacanonHeroGlyph } from "./Branding";
import MetacanonThemeSwitcher from "./ThemeSwitcher";
import { useTheme } from "@/hooks/useTheme";

function CathedralBackform() {
  return (
    <div className="metacanon-cathedral-backform" aria-hidden="true">
      <svg
        viewBox="0 0 800 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="metacanon-cathedral-backform__svg"
      >
        <path
          d="M400 136L542 238L488 404H312L258 238L400 136Z"
          className="metacanon-cathedral-backform__outer"
        />
        <path
          d="M400 232L522 320L476 462H324L278 320L400 232Z"
          className="metacanon-cathedral-backform__inner"
        />
        <path
          d="M400 136V232M542 238L522 320M488 404L476 462M312 404L324 462M258 238L278 320"
          className="metacanon-cathedral-backform__edge"
        />
        <path
          d="M312 404L400 512L488 404M258 238L400 232L542 238"
          className="metacanon-cathedral-backform__edge"
        />
        <path
          d="M324 462L400 566L476 462"
          className="metacanon-cathedral-backform__inner"
        />
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
    <div className="metacanon-home-stage relative flex h-full w-full items-center justify-center px-6 py-10">
      {resolvedTheme === "cathedral" ? <CathedralBackform /> : null}
      <div className="absolute right-6 top-6 z-20 hidden md:flex">
        <MetacanonThemeSwitcher />
      </div>
      <div className="relative z-10 flex w-full max-w-[1220px] flex-col items-center">
        <div className="mb-5 flex flex-col items-center">
          <MetacanonHeroGlyph className="h-[84px] w-[84px]" />
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

        <div className="mt-10 flex w-full justify-center">
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

        <div className="metacanon-home-manifesto">{themeCopy.inscription}</div>
      </div>
    </div>
  );
}
