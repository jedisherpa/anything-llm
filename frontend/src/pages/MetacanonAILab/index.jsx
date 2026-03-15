import Footer from "@/components/Footer";
import MetacanonThemeSwitcher from "@/components/Metacanon/ThemeSwitcher";
import PrismPresence from "@/components/PrismPresence";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { useTheme } from "@/hooks/useTheme";
import useLogo from "@/hooks/useLogo";
import paths from "@/utils/paths";
import { isMobile } from "react-device-detect";
import { Link } from "react-router-dom";

function MetacanonMark({ className = "h-11 w-11" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M32 6 54 22l-8.4 26H18.4L10 22 32 6Z"
        fill="rgba(214,180,107,0.12)"
        stroke="rgba(214,180,107,0.95)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill="rgba(39,30,17,0.95)"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        MC
      </text>
    </svg>
  );
}

function LabPanel({ title, eyebrow = null, children, className = "" }) {
  return (
    <section
      className={`rounded-[22px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5 shadow-[0_12px_36px_rgba(15,10,4,0.06)] ${className}`}
    >
      {(eyebrow || title) && (
        <div className="mb-4 flex flex-col gap-1">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">
              {eyebrow}
            </div>
          ) : null}
          {title ? (
            <h2 className="text-lg font-semibold text-theme-text-primary">
              {title}
            </h2>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

function ChecklistItem({ index, title, detail }) {
  return (
    <div className="flex gap-3 rounded-[18px] border border-theme-sidebar-border px-4 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-theme-sidebar-footer-icon text-xs font-semibold text-theme-text-primary">
        {index}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-theme-text-primary">
          {title}
        </div>
        <div className="text-sm leading-6 text-theme-text-secondary">
          {detail}
        </div>
      </div>
    </div>
  );
}

function FrameSpec({ label, size, note }) {
  return (
    <div className="rounded-[18px] border border-theme-sidebar-border px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-theme-text-primary">
        {size}
      </div>
      <div className="mt-1 text-sm leading-6 text-theme-text-secondary">
        {note}
      </div>
    </div>
  );
}

function TokenSwatch({ label, value, swatchClassName }) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-theme-sidebar-border px-4 py-3">
      <span
        className={`h-10 w-10 rounded-[12px] border border-black/5 ${swatchClassName}`}
      />
      <div className="flex flex-col">
        <div className="text-sm font-semibold text-theme-text-primary">
          {label}
        </div>
        <div className="text-sm text-theme-text-secondary">{value}</div>
      </div>
    </div>
  );
}

function MiniSidebarPreview() {
  const { logo } = useLogo();

  return (
    <div className="rounded-[24px] border border-theme-sidebar-border bg-[#111111] p-3 shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
      <div className="flex h-[420px] w-full max-w-[290px] flex-col rounded-[20px] border border-theme-sidebar-border bg-[#242424] p-3">
        <div className="flex items-start gap-2">
          <PrismPresence
            surface="ui-lab-sidebar-preview"
            size="xs"
            label="Prism"
            caption="Standby"
            showState={false}
            align="left"
          />
          <img
            src={logo}
            alt="PrismAI"
            className="max-h-[42px] max-w-[170px] object-contain"
          />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-[14px] bg-[#1B1B1B] px-3 py-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[#FFD700]/75" />
          <div className="h-3 w-16 rounded-full bg-white/12" />
          <div className="ml-auto h-7 w-7 rounded-full bg-white/10" />
        </div>
        <div className="mt-4 flex flex-1 flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-10 rounded-[12px] border border-[#FFD700]/15 bg-[#1A1A1A]"
            />
          ))}
        </div>
        <div className="mt-3 rounded-[18px] border border-theme-sidebar-border bg-[#1A1A1A] px-1.5 py-1.5">
          <Footer />
        </div>
      </div>
    </div>
  );
}

function CardPreview() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-[20px] border border-theme-sidebar-border bg-[#242424] px-5 py-5 shadow-[0_10px_26px_rgba(0,0,0,0.24)]">
        <div className="flex items-center gap-3">
          <MetacanonMark className="h-10 w-10" />
          <div>
            <div className="text-sm font-semibold text-theme-text-primary">
              Hero Card
            </div>
            <div className="text-sm text-theme-text-secondary">
              Use this for primary intent blocks.
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-theme-text-secondary">
          Keep this card for the lead action on a screen: one title, one
          sentence of context, one strong CTA.
        </p>
        <div className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-theme-primary-button">
          Primary direction
        </div>
      </div>
      <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5 shadow-[0_10px_26px_rgba(15,10,4,0.04)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
          Secondary card
        </div>
        <div className="mt-2 text-lg font-semibold text-theme-text-primary">
          Supporting surface
        </div>
        <p className="mt-3 text-sm leading-6 text-theme-text-secondary">
          Use this one for supporting controls, notes, and layout experiments.
          It should never visually overpower the hero card.
        </p>
        <div className="mt-4 flex gap-2">
          <span className="rounded-full bg-theme-sidebar-footer-icon px-3 py-1 text-xs font-medium text-theme-text-primary">
            chip
          </span>
          <span className="rounded-full bg-theme-sidebar-footer-icon px-3 py-1 text-xs font-medium text-theme-text-primary">
            chip
          </span>
        </div>
      </div>
    </div>
  );
}

function ComposerPreview() {
  return (
    <div className="rounded-[24px] border border-theme-sidebar-border bg-theme-bg-container px-5 py-5">
      <div className="mx-auto flex max-w-[640px] flex-col items-center">
        <div className="text-xl font-semibold text-theme-text-primary">
          Prompt Composer
        </div>
        <div className="mt-8 w-full rounded-[24px] border border-theme-sidebar-border bg-theme-bg-sidebar px-4 py-4 shadow-[0_10px_30px_rgba(15,10,4,0.04)]">
          <div className="min-h-[94px] rounded-[18px] border border-theme-sidebar-border bg-[#1A1A1A] px-4 py-4 text-sm text-theme-text-secondary">
            Send a message
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm text-theme-text-secondary">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-theme-sidebar-footer-icon font-semibold text-theme-text-primary">
                +
              </span>
              <span>Tools</span>
              <span>Model</span>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFD700] text-[#1A1A1A] font-semibold">
              ↑
            </span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-[#242424] px-4 py-2 text-sm font-medium text-theme-text-primary border border-theme-sidebar-border">
            Create card
          </span>
          <span className="rounded-full bg-[#242424] px-4 py-2 text-sm font-medium text-theme-text-primary border border-theme-sidebar-border">
            Test dock
          </span>
          <span className="rounded-full bg-[#242424] px-4 py-2 text-sm font-medium text-theme-text-primary border border-theme-sidebar-border">
            Tune spacing
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MetacanonUILabPage() {
  const { resolvedTheme } = useTheme();
  const checklist = [
    {
      title: "Use one frame per screen",
      detail:
        "Make separate frames for Home, Sidebar, Settings, and the PrismAI menu instead of mixing multiple layouts into one board.",
    },
    {
      title: "Name the layers literally",
      detail:
        "Use names like sidebar, footer-dock, hero-card, chat-input, settings-panel. That makes translation from Figma to code much faster.",
    },
    {
      title: "Call out measurements",
      detail:
        "Only annotate the parts that matter: spacing, width, height, font size, corner radius, and anything you want aligned exactly.",
    },
    {
      title: "Export one clean screenshot",
      detail:
        "Give me a PNG of the final frame or a tight screenshot with notes. One clear reference is better than a lot of partial crops.",
    },
  ];

  const frameSpecs = [
    {
      label: "Desktop frame",
      size: "1440 × 900",
      note: "Best default when we are tuning the full shell layout.",
    },
    {
      label: "Compact desktop",
      size: "1280 × 832",
      note: "Useful when a screen feels crowded or the left rail needs rebalancing.",
    },
    {
      label: "Mobile check",
      size: "390 × 844",
      note: "Only if you want the same screen adapted for phone behavior.",
    },
  ];

  const themePalette =
    resolvedTheme === "cathedral"
      ? [
          {
            label: "Sanctuary Black",
            value: "#08080E / ceremonial base canvas",
            swatchClassName: "bg-[#08080E]",
          },
          {
            label: "Halo Gold",
            value: "#DAA520 / sacred accent and focus",
            swatchClassName: "bg-[#DAA520]",
          },
          {
            label: "Parchment Text",
            value: "#D4CFC4 / primary reading color",
            swatchClassName: "bg-[#D4CFC4]",
          },
          {
            label: "Cathedral Teal",
            value: "#0B4F59 / ambient glow support",
            swatchClassName: "bg-[#0B4F59]",
          },
        ]
      : resolvedTheme === "light"
        ? [
            {
              label: "Atelier Canvas",
              value: "#FAFAF7 / bright working surface",
              swatchClassName: "bg-[#FAFAF7]",
            },
            {
              label: "Refined Gold",
              value: "#B8860B / accents and focus",
              swatchClassName: "bg-[#B8860B]",
            },
            {
              label: "Ink Text",
              value: "#1A1A1A / primary reading color",
              swatchClassName: "bg-[#1A1A1A]",
            },
            {
              label: "Sidebar Mist",
              value: "#F5F3EE / left rail body",
              swatchClassName: "bg-[#F5F3EE]",
            },
          ]
        : [
            {
              label: "Forge Black",
              value: "#0D0D0F / base canvas",
              swatchClassName: "bg-[#0D0D0F]",
            },
            {
              label: "Prism Gold",
              value: "#DAA520 / accents and focus",
              swatchClassName: "bg-[#DAA520]",
            },
            {
              label: "Warm Bone",
              value: "#E8E4DC / primary reading color",
              swatchClassName: "bg-[#E8E4DC]",
            },
            {
              label: "Forge Rail",
              value: "#12110E / sidebar body",
              swatchClassName: "bg-[#12110E]",
            },
          ];

  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:px-6 md:py-6 py-20 gap-6">
          <LabPanel eyebrow="PrismAI" title="UI Lab">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-base leading-7 text-theme-text-secondary">
                  Keep this page open next to Figma. Build the frame there, send
                  me the screenshot here, and we will match the live UI against
                  these reference surfaces instead of guessing from text.
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <MetacanonThemeSwitcher />
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={paths.metacanonAI()}
                    className="rounded-full border border-theme-sidebar-border bg-theme-bg-sidebar px-4 py-2 text-sm font-medium text-theme-text-primary transition-all duration-300 hover:border-theme-primary-button"
                  >
                    Back to Features
                  </Link>
                  <Link
                    to={paths.settings.branding()}
                    className="rounded-full bg-[#E9D8AA] px-4 py-2 text-sm font-semibold text-theme-text-primary transition-all duration-300 hover:brightness-95"
                  >
                    Open Branding
                  </Link>
                </div>
              </div>
            </div>
          </LabPanel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <LabPanel eyebrow="Figma Handoff" title="First File Checklist">
              <div className="grid grid-cols-1 gap-3">
                {checklist.map((item, index) => (
                  <ChecklistItem
                    key={item.title}
                    index={index + 1}
                    title={item.title}
                    detail={item.detail}
                  />
                ))}
              </div>
            </LabPanel>

            <LabPanel eyebrow="Frame Targets" title="Start Here">
              <div className="grid grid-cols-1 gap-3">
                {frameSpecs.map((item) => (
                  <FrameSpec key={item.label} {...item} />
                ))}
              </div>
              <div className="mt-4 rounded-[18px] border border-theme-sidebar-border px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
                  Handoff note
                </div>
                <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
                  If you want precision, annotate only what changed: "dock 6px
                  higher", "logo 15% wider", "chat shell corners 24px".
                </div>
              </div>
            </LabPanel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <LabPanel eyebrow="Live Surface" title="Sidebar Rail Preview">
              <MiniSidebarPreview />
            </LabPanel>

            <LabPanel eyebrow="Live Surface" title="Composer Preview">
              <ComposerPreview />
            </LabPanel>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
            <LabPanel eyebrow="Live Surface" title="Card Treatments">
              <CardPreview />
            </LabPanel>

            <LabPanel eyebrow="Theme Tokens" title="Current Palette">
              <div className="grid grid-cols-1 gap-3">
                {themePalette.map((token) => (
                  <TokenSwatch key={token.label} {...token} />
                ))}
              </div>
            </LabPanel>
          </div>
        </div>
      </div>
    </div>
  );
}
