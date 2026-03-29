import paths from "@/utils/paths";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import useRedirectToHomeOnOnboardingComplete from "@/hooks/useOnboardingComplete";
import useLogo from "@/hooks/useLogo";
import AwakenPrismModal from "@/components/Metacanon/AwakenPrismModal";
import PrismPresence from "@/components/PrismPresence";
import MetacanonLogoDark from "@/media/logo/anythingllm-metacanonai-dark.svg";
import MetacanonLogoLight from "@/media/logo/anythingllm-metacanonai-light.svg";

function PrismGlyph({ className = "", mirrored = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 220"
      fill="none"
      aria-hidden="true"
      style={mirrored ? { transform: "scaleX(-1)" } : undefined}
    >
      <g opacity="0.88">
        <path
          d="M110 24 166 56 182 118 142 174 78 188 34 136 46 70 110 24Z"
          className="prism-onboarding-geometry__outline"
        />
        <path
          d="M110 24 110 106 78 188"
          className="prism-onboarding-geometry__spoke"
        />
        <path
          d="M110 24 166 56 182 118 110 106"
          className="prism-onboarding-geometry__facet"
        />
        <path
          d="M110 106 142 174 78 188 34 136"
          className="prism-onboarding-geometry__outline prism-onboarding-geometry__outline--soft"
        />
        <circle
          cx="110"
          cy="24"
          r="5"
          className="prism-onboarding-geometry__node prism-onboarding-geometry__node--hot"
        />
        <circle
          cx="166"
          cy="56"
          r="4"
          className="prism-onboarding-geometry__node"
        />
        <circle
          cx="182"
          cy="118"
          r="4"
          className="prism-onboarding-geometry__node"
        />
        <circle
          cx="142"
          cy="174"
          r="4"
          className="prism-onboarding-geometry__node"
        />
        <circle
          cx="78"
          cy="188"
          r="4"
          className="prism-onboarding-geometry__node"
        />
        <circle
          cx="34"
          cy="136"
          r="4"
          className="prism-onboarding-geometry__node"
        />
        <circle
          cx="46"
          cy="70"
          r="4"
          className="prism-onboarding-geometry__node"
        />
        <circle
          cx="110"
          cy="106"
          r="5"
          className="prism-onboarding-geometry__node prism-onboarding-geometry__node--core"
        />
      </g>
    </svg>
  );
}

export default function OnboardingHome() {
  const navigate = useNavigate();
  useRedirectToHomeOnOnboardingComplete();
  const { isLightTheme, resolvedTheme } = useTheme();
  const { logo } = useLogo();
  const { t } = useTranslation();
  const [showAwakenPrism, setShowAwakenPrism] = useState(false);
  const activeLogo = logo || (isLightTheme ? MetacanonLogoLight : MetacanonLogoDark);
  const prismCaption =
    resolvedTheme === "cathedral"
      ? "Threshold open"
      : isLightTheme
        ? "Ready to begin"
        : "Local-first"
  ;

  return (
    <>
      <AwakenPrismModal
        isOpen={showAwakenPrism}
        onClose={() => setShowAwakenPrism(false)}
      />
      <div className="relative w-screen h-screen flex overflow-hidden bg-theme-bg-primary">
        <div className="prism-onboarding-home-ambient prism-onboarding-home-ambient--left" aria-hidden="true">
          <PrismGlyph className="prism-onboarding-home-geometry prism-onboarding-home-geometry--left" mirrored />
          <PrismPresence
            surface="global"
            size="lg"
            label="Prism"
            caption={prismCaption}
            showState={false}
            className="prism-onboarding-home-presence prism-onboarding-home-presence--left"
          />
        </div>

        <div className="prism-onboarding-home-ambient prism-onboarding-home-ambient--right" aria-hidden="true">
          <PrismGlyph className="prism-onboarding-home-geometry prism-onboarding-home-geometry--right" />
          <PrismPresence
            surface="global"
            size="md"
            label="Prism"
            caption="Awakened"
            showState={false}
            className="prism-onboarding-home-presence prism-onboarding-home-presence--right"
          />
        </div>

        <div className="relative flex justify-center items-center m-auto px-6">
          <div className="prism-onboarding-home-stage flex flex-col justify-center items-center">
            <p className="prism-onboarding-home-kicker text-theme-text-primary font-thin text-[24px]">
              {t("onboarding.home.title")}
            </p>
            <img
              src={activeLogo}
              alt="PrismAI"
              className="prism-onboarding-home-logo md:h-[96px] flex-shrink-0 max-w-[560px]"
            />
            <div className="mt-10 flex w-full flex-col items-center gap-4 md:max-w-[720px] md:flex-row md:justify-center">
              <button
                onClick={() => navigate(paths.onboarding.llmPreference())}
                className="prism-onboarding-home-action prism-onboarding-home-action--primary w-full rounded-[16px] border-[2px] border-theme-text-primary bg-theme-button-primary px-6 py-4 text-center text-sm font-semibold text-theme-text-primary transition hover:bg-theme-bg-secondary md:max-w-[320px]"
              >
                {t("onboarding.home.getStarted")}
              </button>
              <button
                type="button"
                onClick={() => setShowAwakenPrism(true)}
                className="prism-onboarding-home-action prism-onboarding-home-action--secondary w-full rounded-[16px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-6 py-4 text-center text-sm font-semibold text-theme-text-primary transition hover:bg-theme-sidebar-item-hover md:max-w-[320px]"
              >
                Awaken Prism
                <span className="mt-1 block text-[11px] font-normal uppercase tracking-[0.16em] text-theme-text-secondary">
                  QR Pairing
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
