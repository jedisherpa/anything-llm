import CommunityHubImportItemSteps from "..";
import CTAButton from "@/components/lib/CTAButton";
import { Link } from "react-router-dom";
import paths from "@/utils/paths";

export default function Completed({ settings, setSettings, setStep }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="prism-page-panel">
        <div className="prism-page-section-label">Completed</div>
        <div className="mt-4 max-w-[62ch]">
          <h2 className="text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] text-theme-text-primary">
            Community Hub Item Imported
          </h2>
        </div>
        <div className="mt-8 flex flex-col gap-5 text-sm text-theme-text-secondary">
          <div className="prism-community-import-callout">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
              Import Complete
            </div>
            <p className="mt-3 leading-7">
              The "{settings.item.name}" {settings.item.itemType} has been
              imported successfully and is now available in your AnythingLLM
              instance.
            </p>
          </div>

          <div className="prism-community-import-summary">
            <p>
              Any changes you make to this {settings.item.itemType} from here
              forward will live only in your local PrismAI instance. They do not
              sync back to the Community Hub source item.
            </p>
            {settings.item.itemType === "agent-flow" && (
              <div className="mt-4">
                <Link
                  to={paths.settings.agentSkills()}
                  className="font-semibold text-theme-primary-button underline underline-offset-4 transition-colors duration-200 hover:text-theme-text-primary"
                >
                  View "{settings.item.name}" in Agent Skills
                </Link>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <CTAButton
              type="button"
              className="!mr-0 mt-1 h-11 w-full rounded-[14px] text-dark-text md:w-auto md:min-w-[220px]"
              onClick={() => {
                setSettings({ item: null, itemId: null });
                setStep(CommunityHubImportItemSteps.itemId.key);
              }}
            >
              Import another item
            </CTAButton>
          </div>
        </div>
      </div>
    </div>
  );
}
