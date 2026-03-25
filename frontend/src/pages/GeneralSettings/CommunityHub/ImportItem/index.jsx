import React, { useState } from "react";
import { isMobile } from "react-device-detect";
import CommunityHubImportItemSteps, {
  CommunityHubImportItemLayout,
} from "./Steps";

function SideBarSelection({ setStep, currentStep }) {
  const stepKeys = Object.keys(CommunityHubImportItemSteps);
  const currentIndex = stepKeys.indexOf(currentStep);
  return (
    <div className="prism-community-import-rail">
      <div
        className={`prism-page-panel ${isMobile ? "w-full" : "min-w-[300px]"}`}
      >
        <div className="prism-page-section-label">Import Sequence</div>
        <p className="mt-3 text-sm leading-6 text-theme-text-secondary">
          Use a Community Hub ID, confirm the item details, then add it to this
          PrismAI instance.
        </p>
        <div className="prism-community-import-step-list mt-5">
          {Object.entries(CommunityHubImportItemSteps).map(
            ([stepKey, props], index) => {
              const isSelected = currentStep === stepKey;
              const isDone =
                currentIndex === stepKeys.length - 1 || index < currentIndex;
              const canNavigate = isDone || isSelected;
              return (
                <button
                  key={stepKey}
                  type="button"
                  onClick={() => canNavigate && setStep(stepKey)}
                  disabled={!canNavigate}
                  className={[
                    "prism-community-import-step",
                    isSelected ? "prism-community-import-step--current" : "",
                    isDone ? "prism-community-import-step--done" : "",
                    !canNavigate ? "opacity-80" : "",
                  ].join(" ")}
                >
                  <div className="prism-community-import-step__label">
                    <div className="prism-community-import-step__title">
                      {props.name}
                    </div>
                    <div className="prism-community-import-step__hint">
                      {isDone
                        ? "Completed and available to revisit."
                        : isSelected
                          ? "Current focus in the import flow."
                          : "Unlocks after the current step is complete."}
                    </div>
                  </div>
                  <div className="prism-community-import-step__status" />
                </button>
              );
            }
          )}
        </div>
      </div>

      <div className="prism-community-import-note">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
          Sanctuary Alignment
        </div>
        <p className="mt-3 text-sm leading-6 text-theme-text-secondary">
          This route now inherits the same dark, light, and cathedral surface
          language used across the updated main Prism pages.
        </p>
      </div>
    </div>
  );
}

export default function CommunityHubImportItemFlow() {
  const [step, setStep] = useState("itemId");

  const StepPage = CommunityHubImportItemSteps.hasOwnProperty(step)
    ? CommunityHubImportItemSteps[step]
    : CommunityHubImportItemSteps.itemId;

  return (
    <CommunityHubImportItemLayout setStep={setStep}>
      {(settings, setSettings, setStep) => (
        <div className="prism-settings-content prism-settings-content--wide w-full px-1 md:pl-6 md:pr-[60px] md:py-6 py-16">
          <div className="prism-settings-page-header">
            <div className="prism-page-section-label">Community Hub</div>
            <p className="prism-settings-page-title">Import a Community Item</p>
            <p className="prism-settings-page-description">
              Import items from the AnythingLLM Community Hub to enhance your
              instance with community-created prompts, skills, and commands.
            </p>
          </div>
          <div className="prism-community-import-layout">
            <div className="min-w-0">
              <SideBarSelection setStep={setStep} currentStep={step} />
            </div>
            <div className="min-w-0 pb-16">
              <div className="max-w-[720px]">
                {StepPage.component({ settings, setSettings, setStep })}
              </div>
            </div>
          </div>
        </div>
      )}
    </CommunityHubImportItemLayout>
  );
}
