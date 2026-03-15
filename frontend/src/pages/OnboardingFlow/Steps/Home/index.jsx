import paths from "@/utils/paths";
import LGroupImg from "./l_group.png";
import RGroupImg from "./r_group.png";
import LGroupImgLight from "./l_group-light.png";
import RGroupImgLight from "./r_group-light.png";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";
import useRedirectToHomeOnOnboardingComplete from "@/hooks/useOnboardingComplete";
import useLogo from "@/hooks/useLogo";
import AwakenPrismModal from "@/components/Metacanon/AwakenPrismModal";

const IMG_SRCSET = {
  light: {
    l: LGroupImgLight,
    r: RGroupImgLight,
  },
  default: {
    l: LGroupImg,
    r: RGroupImg,
  },
};

export default function OnboardingHome() {
  const navigate = useNavigate();
  useRedirectToHomeOnOnboardingComplete();
  const { isLightTheme } = useTheme();
  const { logo } = useLogo();
  const { t } = useTranslation();
  const [showAwakenPrism, setShowAwakenPrism] = useState(false);
  const srcSet = isLightTheme ? IMG_SRCSET.light : IMG_SRCSET.default;

  return (
    <>
      <AwakenPrismModal
        isOpen={showAwakenPrism}
        onClose={() => setShowAwakenPrism(false)}
      />
      <div className="relative w-screen h-screen flex overflow-hidden bg-theme-bg-primary">
        <div
          className="hidden md:block fixed bottom-10 left-10 w-[320px] h-[320px] bg-no-repeat bg-contain"
          style={{ backgroundImage: `url(${srcSet.l})` }}
        ></div>

        <div
          className="hidden md:block fixed top-10 right-10 w-[320px] h-[320px] bg-no-repeat bg-contain"
          style={{ backgroundImage: `url(${srcSet.r})` }}
        ></div>

        <div className="relative flex justify-center items-center m-auto">
          <div className="flex flex-col justify-center items-center">
            <p className="text-theme-text-primary font-thin text-[24px]">
              {t("onboarding.home.title")}
            </p>
            <img
              src={logo}
              alt="PrismAI"
              className="md:h-[96px] flex-shrink-0 max-w-[560px]"
            />
            <div className="mt-10 flex w-full flex-col items-center gap-4 md:max-w-[720px] md:flex-row md:justify-center">
              <button
                onClick={() => navigate(paths.onboarding.llmPreference())}
                className="w-full rounded-[16px] border-[2px] border-theme-text-primary bg-theme-button-primary px-6 py-4 text-center text-sm font-semibold text-theme-text-primary transition hover:bg-theme-bg-secondary md:max-w-[320px]"
              >
                {t("onboarding.home.getStarted")}
              </button>
              <button
                type="button"
                onClick={() => setShowAwakenPrism(true)}
                className="w-full rounded-[16px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-6 py-4 text-center text-sm font-semibold text-theme-text-primary transition hover:bg-theme-sidebar-item-hover md:max-w-[320px]"
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
