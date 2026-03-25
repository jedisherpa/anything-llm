import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { useState } from "react";
import { isMobile } from "react-device-detect";
import useRedirectToHomeOnOnboardingComplete from "@/hooks/useOnboardingComplete";
import Home from "./Home";
import LLMPreference from "./LLMPreference";
import UserSetup from "./UserSetup";
import DataHandling from "./DataHandling";
import Survey from "./Survey";

const OnboardingSteps = {
  home: Home,
  "llm-preference": LLMPreference,
  "user-setup": UserSetup,
  "data-handling": DataHandling,
  survey: Survey,
};

export default OnboardingSteps;

export function OnboardingLayout({ children }) {
  useRedirectToHomeOnOnboardingComplete();
  const [header, setHeader] = useState({
    title: "",
    description: "",
  });
  const [backBtn, setBackBtn] = useState({
    showing: false,
    disabled: true,
    onClick: () => null,
  });
  const [forwardBtn, setForwardBtn] = useState({
    showing: false,
    disabled: true,
    onClick: () => null,
  });

  if (isMobile) {
    return (
      <div
        data-layout="onboarding"
        className="prism-onboarding-shell w-screen h-screen overflow-y-auto bg-theme-bg-primary overflow-hidden"
      >
        <div className="flex flex-col">
          <div className="prism-onboarding-panel w-full relative py-10 px-2">
            <div className="prism-onboarding-header">
              <h1 className="text-theme-text-primary font-semibold text-center text-2xl">
                {header.title}
              </h1>
              <p className="text-theme-text-secondary text-base text-center">
                {header.description}
              </p>
            </div>
            {children(setHeader, setBackBtn, setForwardBtn)}
          </div>
          <div className="flex w-full justify-center gap-x-4 pb-20">
            <div className="flex justify-center items-center">
              {backBtn.showing && (
                <button
                  disabled={backBtn.disabled}
                  onClick={backBtn.onClick}
                  className="prism-onboarding-nav-button group disabled:cursor-not-allowed"
                >
                  <ArrowLeft
                    className="text-white group-hover:text-black group-disabled:text-gray-500"
                    size={30}
                  />
                </button>
              )}
            </div>

            <div className="flex justify-center items-center">
              {forwardBtn.showing && (
                <button
                  disabled={forwardBtn.disabled}
                  onClick={forwardBtn.onClick}
                  className="prism-onboarding-nav-button group disabled:cursor-not-allowed"
                >
                  <ArrowRight
                    className="text-white group-hover:text-teal group-disabled:text-gray-500"
                    size={30}
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-layout="onboarding"
      className="prism-onboarding-shell w-screen overflow-y-auto bg-theme-bg-primary flex justify-center overflow-hidden"
    >
      <div className="prism-onboarding-rail flex w-1/5 h-screen justify-center items-center">
        {backBtn.showing && (
          <button
            disabled={backBtn.disabled}
            onClick={backBtn.onClick}
            className="prism-onboarding-nav-button group disabled:cursor-not-allowed"
            aria-label="Back"
          >
            <ArrowLeft
              className="text-theme-text-secondary group-hover:text-theme-text-primary group-disabled:text-gray-500"
              size={30}
            />
          </button>
        )}
      </div>

      <div className="prism-onboarding-panel w-full md:w-3/5 relative h-full py-10">
        <div className="prism-onboarding-header">
          <h1 className="text-theme-text-primary font-semibold text-center text-2xl">
            {header.title}
          </h1>
          <p className="text-theme-text-secondary text-base text-center">
            {header.description}
          </p>
        </div>
        {children(setHeader, setBackBtn, setForwardBtn)}
      </div>

      <div className="prism-onboarding-rail flex w-1/5 h-screen justify-center items-center">
        {forwardBtn.showing && (
          <button
            disabled={forwardBtn.disabled}
            onClick={forwardBtn.onClick}
            className="prism-onboarding-nav-button group disabled:cursor-not-allowed"
            aria-label="Continue"
          >
            <ArrowRight
              className="text-theme-text-secondary group-hover:text-white group-disabled:text-gray-500"
              size={30}
            />
          </button>
        )}
      </div>
    </div>
  );
}
