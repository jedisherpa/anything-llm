import { useEffect } from "react";
import { PrismProvider, usePrism } from "@/PrismContext";
import { MetacanonHeroGlyph } from "@/components/Metacanon/Branding";
import MetacanonThemeSwitcher from "@/components/Metacanon/ThemeSwitcher";
import StatusResponse from "@/components/WorkspaceChat/ChatContainer/ChatHistory/StatusResponse";

const DELIBERATION_MESSAGES = [
  { content: "Watcher · mapped the evidence field and the primary unknowns." },
  {
    content:
      "Auditor · flagged the assumptions that still need human verification.",
  },
  {
    content:
      "Builder · proposed the next sequence with lower variance and clearer execution steps.",
  },
  {
    content:
      "Reflector · surfaced the emotional threshold and context the Sovereign should review.",
  },
  {
    content:
      "Prism · synthesized the four lenses into one grounded recommendation for the thread.",
  },
];

function PrismStateActivator({ state }) {
  const prism = usePrism();

  useEffect(() => {
    prism.resetState();
    if (state === "thinking") prism.beginThinking();
    if (state === "response") prism.pulseResponse();
    return () => prism.resetState();
  }, [prism, state]);

  return null;
}

function MotionPanel({ state, title, body }) {
  return (
    <PrismProvider>
      <PrismStateActivator state={state} />
      <div className="metacanon-page-frame relative overflow-hidden rounded-[28px] px-8 py-10">
        <div className="absolute right-6 top-6">
          <span className="rounded-full border border-theme-sidebar-border bg-theme-sidebar-item-default px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
            {state === "thinking" ? "Thinking pulse" : "Response flare"}
          </span>
        </div>
        <div className="flex flex-col items-center text-center">
          <MetacanonHeroGlyph className="h-[76px] w-[76px]" />
          <h2 className="metacanon-home-title mt-6 text-[38px] font-normal leading-[1.08] tracking-[-0.03em] text-theme-text-primary">
            How can I <span className="metacanon-home-title-accent">help</span>{" "}
            you today?
          </h2>
          <p className="metacanon-home-subtitle mt-3 text-[14px] uppercase tracking-[0.24em] text-theme-home-text-secondary">
            Structure &amp; Soul
          </p>
          <div className="mt-8 w-full max-w-[720px] rounded-[24px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-6 py-5 text-left shadow-[0_24px_56px_rgba(0,0,0,0.16)]">
            <div className="text-[15px] font-semibold text-theme-text-primary">
              {title}
            </div>
            <div className="mt-2 text-[14px] leading-7 text-theme-text-secondary">
              {body}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-[18px] border border-theme-sidebar-border bg-theme-bg-secondary px-5 py-4">
              <div className="text-[14px] text-theme-settings-input-placeholder">
                {state === "thinking"
                  ? "Prism is tracing tokens across the active lenses..."
                  : "Prism is returning a synthesized response to the thread..."}
              </div>
              <div className="metacanon-send-button flex h-10 w-10 items-center justify-center rounded-full">
                <span className="metacanon-send-button-icon text-sm font-bold">
                  ↑
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PrismProvider>
  );
}

export default function MetacanonAIManualPreviews() {
  return (
    <div className="metacanon-page-shell min-h-screen px-6 py-8 md:px-10">
      <div className="mx-auto flex max-w-[1440px] items-start justify-between gap-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-home-text-secondary">
            Hidden Manual Preview
          </div>
          <h1 className="mt-3 text-[40px] font-semibold leading-none text-theme-text-primary">
            PrismAI Manual States
          </h1>
          <p className="mt-4 max-w-[70ch] text-[15px] leading-7 text-theme-text-secondary">
            These preview boards exist only so we can capture the mythic manual
            against the real PrismAI visual system without polluting the
            shipping navigation.
          </p>
        </div>
        <MetacanonThemeSwitcher />
      </div>

      <section
        id="prism-motion-preview"
        className="mx-auto mt-10 grid max-w-[1440px] gap-6 lg:grid-cols-2"
      >
        <MotionPanel
          state="thinking"
          title="Prism in Motion · Thinking"
          body="The teal pulse signals active deliberation across the selected lenses while retrieved evidence and model reasoning are still in flight."
        />
        <MotionPanel
          state="response"
          title="Prism in Motion · Response"
          body="The gold flare confirms that the council pass is complete and the synthesis is now landing back into the thread."
        />
      </section>

      <section
        id="sub-sphere-action-preview"
        className="mx-auto mt-10 max-w-[1280px]"
      >
        <div className="metacanon-page-frame rounded-[28px] px-8 py-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-home-text-secondary">
            Sub-Sphere in Action
          </div>
          <div className="mt-3 max-w-[56ch] text-[15px] leading-7 text-theme-text-secondary">
            A preset council routes the same prompt through multiple lenses,
            then returns a single Prism synthesis into the active thread.
          </div>

          <div className="mt-8 space-y-5">
            <div className="ml-auto max-w-[720px] rounded-[22px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-5 py-4 text-theme-text-primary shadow-[0_18px_44px_rgba(0,0,0,0.14)]">
              I need a grounded recommendation for launching the next offer
              without overextending the team.
            </div>

            <StatusResponse
              messages={DELIBERATION_MESSAGES}
              isThinking={false}
            />

            <div className="max-w-[760px] rounded-[24px] border border-theme-sidebar-border bg-theme-bg-secondary px-6 py-5 text-theme-text-primary shadow-[0_20px_48px_rgba(0,0,0,0.16)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                Prism Synthesis
              </div>
              <div className="mt-3 text-[15px] leading-7 text-theme-text-secondary">
                Launch the smallest credible version first, validate demand with
                a tighter promise, and keep one human review checkpoint before
                scaling spend or commitments.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
