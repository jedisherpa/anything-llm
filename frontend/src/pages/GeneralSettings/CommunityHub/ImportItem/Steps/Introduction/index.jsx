import CommunityHubImportItemSteps from "..";
import CTAButton from "@/components/lib/CTAButton";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { useState } from "react";

export default function Introduction({ settings, setSettings, setStep }) {
  const [itemId, setItemId] = useState(settings.itemId);
  const handleContinue = () => {
    if (!itemId) return showToast("Please enter an item ID", "error");
    setSettings((prev) => ({ ...prev, itemId }));
    setStep(CommunityHubImportItemSteps.itemId.next());
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="prism-page-panel">
        <div className="prism-page-section-label">Paste In Item ID</div>
        <div className="mt-4 max-w-[62ch]">
          <h2 className="text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] text-theme-text-primary">
            Import an item from the community hub
          </h2>
          <p className="mt-4 text-sm leading-7 text-theme-text-secondary">
            Bring a shared Community Hub prompt, skill, flow, or command into
            this PrismAI instance by pasting its import ID below.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-5 text-sm text-theme-text-secondary">
          <div className="prism-community-import-summary">
            <p>
              The community hub is a place where you can find, share, and import
              agent-skills, system prompts, slash commands, and more!
            </p>
            <p className="mt-4">
              These items are created by the AnythingLLM team and community, and
              are a great way to get started with AnythingLLM as well as extend
              AnythingLLM in a way that is customized to your needs.
            </p>
            <p className="mt-4">
              There are both <b>private</b> and <b>public</b> items in the
              community hub. Private items are only visible to you, while public
              items are visible to everyone.
            </p>
          </div>

          <div className="prism-community-import-callout prism-community-import-callout--warning">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
              Private Item Check
            </div>
            <p className="mt-3 leading-7">
              If you are pulling in a private item, make sure it is{" "}
              <b>shared with a team</b> you belong to, and you have added a{" "}
              <a
                href={paths.communityHub.authentication()}
                className="font-semibold text-theme-primary-button underline underline-offset-4 transition-colors duration-200 hover:text-theme-text-primary"
              >
                Connection Key.
              </a>
            </p>
          </div>

          <div className="prism-community-import-summary">
            <label className="mb-3 block text-sm font-semibold text-theme-text-primary">
              Community Hub Item Import ID
            </label>
            <input
              type="text"
              value={itemId || ""}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="allm-community-id:agent-skill:1234567890"
              className="block w-full rounded-[14px] border-none bg-theme-settings-input-bg px-4 py-3 text-sm text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder focus:outline-primary-button active:outline-primary-button"
            />
            <p className="mt-3 text-xs leading-6 text-theme-text-secondary">
              Paste the full import ID exactly as it appears in the Community
              Hub share link or item details screen.
            </p>
          </div>

          <div className="flex justify-end">
            <CTAButton
              type="button"
              className="!mr-0 mt-1 h-11 w-full rounded-[14px] text-dark-text md:w-auto md:min-w-[220px]"
              onClick={handleContinue}
            >
              Continue with import &rarr;
            </CTAButton>
          </div>
        </div>
      </div>

      <div className="prism-community-import-note">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
          Expected Format
        </div>
        <p className="mt-3 text-sm leading-6 text-theme-text-secondary">
          Typical IDs look like
          {" "}
          <code className="rounded-md bg-theme-settings-input-bg px-2 py-1 font-mono text-theme-text-primary">
            allm-community-id:agent-skill:1234567890
          </code>
          {" "}
          and can point to prompts, slash commands, flows, or bundled skills.
        </p>
      </div>
    </div>
  );
}
