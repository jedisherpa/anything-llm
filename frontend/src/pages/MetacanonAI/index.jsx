import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import PrismHoverTarget from "@/components/PrismHoverTarget";
import { fetchMetacanonFeatures } from "@/models/metacanonLibrary";
import useUser from "@/hooks/useUser";
import paths from "@/utils/paths";
import metacanonLibrarySummary from "@/data/metacanon/summary.generated";
import { METACANON_TERMS } from "@/utils/metacanonTerminology";
import { BracketsCurly } from "@phosphor-icons/react/dist/csr/BracketsCurly";
import { Gear } from "@phosphor-icons/react/dist/csr/Gear";
import { FlowArrow } from "@phosphor-icons/react/dist/csr/FlowArrow";
import { Robot } from "@phosphor-icons/react/dist/csr/Robot";
import { Wrench } from "@phosphor-icons/react/dist/csr/Wrench";
import { Books } from "@phosphor-icons/react/dist/csr/Books";

import { isMobile } from "react-device-detect";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PRISM_SURFACE_STABILITY,
  PRISM_SURFACES,
  prismExperimentalSurfacesEnabled,
  prismRepoLabEnabled,
  prismSurfaceBadge,
} from "@/utils/prism/surfaces";

function MetacanonMark({ className = "h-12 w-12" }) {
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

function UILabIcon({ className = "h-7 w-7" }) {
  return (
    <svg
      viewBox="0 0 28 28"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect
        x="3.5"
        y="4.5"
        width="21"
        height="19"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.8"
      />

      <path d="M9.25 4.75v18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.5 10.5h14" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12.25 14.75h8.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function FeatureCard({
  title,
  description,
  cta,
  href,
  icon,
  targetId,
  stability = PRISM_SURFACE_STABILITY.STABLE,
}) {
  const badge = prismSurfaceBadge({ stability });
  const card = (
    <Link
      to={href}
      className="prism-page-card prism-page-card--interactive flex h-full flex-col justify-between"
    >
      <div className="flex flex-col gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-theme-sidebar-footer-icon">
          {icon}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-theme-text-primary">
              {title}
            </h2>
            <span className="rounded-full border border-theme-sidebar-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-theme-text-secondary">
              {badge}
            </span>
          </div>
          <p className="text-sm leading-6 text-theme-text-secondary">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-theme-primary-button">
        {cta}
      </div>
    </Link>
  );

  return targetId ? (
    <PrismHoverTarget targetId={targetId}>{card}</PrismHoverTarget>
  ) : (
    card
  );
}

function StatusTile({ label, value, description }) {
  return (
    <div className="prism-page-stat">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-theme-text-primary">
        {value}
      </div>
      <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
        {description}
      </div>
    </div>
  );
}

export default function MetacanonAIPage() {
  const { user } = useUser();
  const [metacanonFeatures, setMetacanonFeatures] = useState(null);
  const role = user?.role;
  const canManage = !role || role !== "default";
  const canAdmin = !role || role === "admin";
  const councilCount = metacanonLibrarySummary.councilCount || 0;
  const experimentalPrismEnabled = prismExperimentalSurfacesEnabled();
  const repoLabEnabled =
    prismRepoLabEnabled() && !!metacanonFeatures?.repoLabReadEnabled;

  useEffect(() => {
    let cancelled = false;

    fetchMetacanonFeatures()
      .then((features) => {
        if (!cancelled) setMetacanonFeatures(features);
      })
      .catch((error) => {
        console.warn(
          "Failed to hydrate Metacanon feature flags for the control center.",
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const featureCards = [
    {
      title: "Councils & Lenses",
      description:
        "Browse imported Councils, Lenses, Presets, Governance Documents, and reusable Skills inside the app.",
      cta: "Open library",
      href: paths.metacanonAILibrary(),
      icon: <Books className="h-5 w-5 text-theme-text-primary" />,
      targetId: "metacanon-library",
      enabled: true,
      stability: PRISM_SURFACE_STABILITY.STABLE,
    },
    {
      title: "Lens Composer",
      description:
        "Compose strict productivity shapes and freeform reflective councils from the existing Metacanon lens library.",
      cta: "Open composer",
      href: paths.metacanonAIComposer(),
      icon: <FlowArrow className="h-5 w-5 text-theme-text-primary" />,
      targetId: "metacanon-lens-composer",
      enabled: true,
      stability: PRISM_SURFACE_STABILITY.STABLE,
    },
    {
      title: "Prism Hero",
      description:
        "Open the Prism visual sandbox for hero composition and presentation testing.",
      cta: "Open hero surface",
      href: PRISM_SURFACES.prismHero.path,
      icon: <MetacanonMark className="h-7 w-7" />,
      targetId: "metacanon-prism-hero",
      enabled: experimentalPrismEnabled,
      stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
    },
    {
      title: "Prism Geometry",
      description:
        "Inspect the dodecahedron lab for shape, lighting, and visual direction work.",
      cta: "Open geometry lab",
      href: PRISM_SURFACES.prismDodecahedron.path,
      icon: <FlowArrow className="h-5 w-5 text-theme-text-primary" />,
      targetId: "metacanon-prism-geometry",
      enabled: experimentalPrismEnabled,
      stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
    },
    {
      title: "UI Lab",
      description:
        "Open the live comparison surface for matching Figma frames to working components.",
      cta: "Open UI lab",
      href: paths.metacanonAILab(),
      icon: <UILabIcon className="h-6 w-6 text-theme-text-primary" />,
      targetId: "metacanon-ui-lab",
      enabled: experimentalPrismEnabled,
      stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
    },
    {
      title: "Manual Previews",
      description:
        "Inspect manual screenshot and preview tooling without mixing it into the stable product path.",
      cta: "Open preview tooling",
      href: paths.metacanonAIManualPreviews(),
      icon: <Books className="h-5 w-5 text-theme-text-primary" />,
      targetId: "metacanon-manual-previews",
      enabled: experimentalPrismEnabled,
      stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
    },
    {
      title: "Repo Lab",
      description:
        "Inspect any file in the fork, edit it directly, and review an exact diff before saving.",
      cta: "Open repo lab",
      href: paths.metacanonAIRepoLab(),
      icon: <BracketsCurly className="h-6 w-6 text-theme-text-primary" />,
      targetId: "metacanon-repo-lab",
      enabled: repoLabEnabled && canManage,
      stability: PRISM_SURFACE_STABILITY.EXPERIMENTAL,
    },
    {
      title: "Interface & Theme",
      description:
        "Adjust the dark Prism interface settings, brand tokens, and presentation layers that shape the fork.",
      cta: "Open interface controls",
      href: paths.settings.interface(),
      icon: <Gear className="h-5 w-5 text-theme-text-primary" />,
      targetId: "metacanon-interface",
      enabled: canManage,
      stability: PRISM_SURFACE_STABILITY.ADMIN_ONLY,
    },
    {
      title: "Branding",
      description:
        "Manage the PrismAI name, logo, and branded presentation layers.",
      cta: "Open branding",
      href: paths.settings.branding(),
      icon: <Wrench className="h-5 w-5 text-theme-text-primary" />,
      targetId: "metacanon-branding",
      enabled: canManage,
      stability: PRISM_SURFACE_STABILITY.ADMIN_ONLY,
    },
    {
      title: "Prism Runtime",
      description:
        "Jump into the administration surface for Prism prompts, Lens workflows, tools, and custom Skills.",
      cta: "Open runtime controls",
      href: paths.settings.agentSkills(),
      icon: <Robot className="h-5 w-5 text-theme-text-primary" />,
      targetId: "metacanon-agents",
      enabled: canAdmin,
      stability: PRISM_SURFACE_STABILITY.ADMIN_ONLY,
    },
  ].filter((card) => card.enabled);

  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:mx-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="prism-route-content w-full px-1 py-20 md:px-6 md:py-6">
          <div className="prism-page-hero">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <MetacanonMark />
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">
                    PrismAI
                  </div>
                  <h1 className="text-2xl md:text-[32px] font-semibold text-theme-text-primary">
                    Control Center
                  </h1>
                  <p className="max-w-2xl text-sm md:text-base leading-7 text-theme-text-secondary">
                    Manage the PrismAI edition of the app: Councils and Lenses,
                    interface settings, branding, and the Prism runtime layers
                    that shape your workspace.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:min-w-[420px]">
                <StatusTile
                  label={METACANON_TERMS.councils}
                  value={String(councilCount)}
                  description={`${metacanonLibrarySummary.counts.lenses} Lenses are grouped into canonical Councils.`}
                />

                <StatusTile
                  label={METACANON_TERMS.subSpheres}
                  value={String(metacanonLibrarySummary.counts.constellations)}
                  description="Reusable preset alignments are available in the Library."
                />

                <StatusTile
                  label="Theme Layer"
                  value="Custom"
                  description="Dark Prism shell, gold and teal accents, custom branding, and Prism presence."
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="prism-page-section-label">Control Surfaces</div>
            <div className="grid grid-cols-1 xl:grid-cols-3 md:grid-cols-2 gap-4">
              {featureCards.map((card) => (
                <FeatureCard key={card.title} {...card} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
