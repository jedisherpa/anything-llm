import CommunityHub from "@/models/communityHub";
import CommunityHubImportItemSteps from "..";
import CTAButton from "@/components/lib/CTAButton";
import { useEffect, useState } from "react";
import HubItemComponent from "./HubItem";

function useGetCommunityHubItem({ importId, updateSettings }) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchItem() {
      if (!importId) return;
      setLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const { error, item } = await CommunityHub.getItemFromImportId(importId);
      if (error) setError(error);
      setItem(item);
      updateSettings((prev) => ({ ...prev, item }));
      setLoading(false);
    }
    fetchItem();
  }, [importId]);

  return { item, loading, error };
}

export default function PullAndReview({ settings, setSettings, setStep }) {
  const { item, loading, error } = useGetCommunityHubItem({
    importId: settings.itemId,
    updateSettings: setSettings,
  });
  const ItemComponent =
    HubItemComponent[item?.itemType] || HubItemComponent["unknown"];

  return (
    <div className="flex flex-col gap-5">
      <div className="prism-page-panel">
        <div className="prism-page-section-label">Review Item</div>
        <div className="mt-4 max-w-[62ch]">
          <h2 className="text-[30px] font-semibold leading-[1.08] tracking-[-0.03em] text-theme-text-primary">
            Review item
          </h2>
          <p className="mt-4 text-sm leading-7 text-theme-text-secondary">
            Confirm the item details, creator, and contents before you import
            anything into the sanctuary.
          </p>
        </div>

        <div className="mt-8">
          {loading && (
            <div className="prism-community-import-skeleton animate-pulse">
              <p className="text-sm">Pulling item details from Community Hub...</p>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col gap-5">
              <div className="prism-community-import-callout prism-community-import-callout--danger">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
                  Import Error
                </div>
                <p className="mt-3 text-sm leading-7 text-theme-text-primary">
                  An error occurred while fetching the item. Please verify the
                  import ID and try again.
                </p>
                <p className="mt-4 rounded-[14px] bg-theme-settings-input-bg px-4 py-3 font-mono text-xs leading-6 text-red-500">
                  {error}
                </p>
              </div>
              <div className="flex justify-end">
                <CTAButton
                  type="button"
                  className="!mr-0 h-11 w-full rounded-[14px] text-dark-text md:w-auto md:min-w-[200px]"
                  onClick={() => {
                    setSettings({ itemId: null, item: null });
                    setStep(CommunityHubImportItemSteps.itemId.key);
                  }}
                >
                  Try another item
                </CTAButton>
              </div>
            </div>
          )}
          {!loading && !error && item && (
            <ItemComponent
              item={item}
              settings={settings}
              setSettings={setSettings}
              setStep={setStep}
            />
          )}
        </div>
      </div>

      <div className="prism-community-import-note">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-primary-button">
          Review Standard
        </div>
        <p className="mt-3 text-sm leading-6 text-theme-text-secondary">
          Treat imported assets as executable configuration. Review provenance,
          prompt text, commands, and bundled files before you continue.
        </p>
      </div>
    </div>
  );
}
