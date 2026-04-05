import { useTranslation } from "react-i18next";
import useUser from "@/hooks/useUser";
import PrismHoverTarget from "@/components/PrismHoverTarget";

/**
 * Quick action buttons for home and empty workspace states.
 * @param {Object} props
 * @param {boolean} props.hasAvailableWorkspace - Whether the user has a workspace they can use
 * @param {Function} props.onCreateAgent - Handler for the lens-builder action
 * @param {Function} props.onEditWorkspace - Handler for "Edit Workspace" action
 * @param {Function} props.onUploadDocument - Handler for the Feed Prism action
 * @param {Function} props.onConnectLLM - Handler for the Awaken Prism action
 */
export default function QuickActions({
  hasAvailableWorkspace,
  onCreateAgent,
  onEditWorkspace,
  onUploadDocument,
  onConnectLLM,
  onOpenReadiness,
  onOpenSetup,
}) {
  const { t } = useTranslation();
  const { user } = useUser();

  return (
    <div className="mt-3 flex flex-wrap justify-center gap-3">
      <QuickActionButton
        label="Awaken Prism"
        onClick={onConnectLLM}
        show={!user || ["admin"].includes(user?.role)}
      />
      <QuickActionButton
        label={t("main-page.quickActions.createAgent")}
        onClick={onCreateAgent}
        show={!user || ["admin"].includes(user?.role)}
      />
      <QuickActionButton
        label={t("main-page.quickActions.editWorkspace")}
        onClick={onEditWorkspace}
        show={
          hasAvailableWorkspace &&
          (!user || ["admin", "manager"].includes(user?.role))
        }
      />
      <QuickActionButton
        label={t("main-page.quickActions.uploadDocument")}
        onClick={onUploadDocument}
        // Any user can upload documents.
        show={true}
      />
      <QuickActionButton
        label="System Status"
        onClick={onOpenReadiness}
        show={true}
      />
      <QuickActionButton
        label="Guided Setup"
        onClick={onOpenSetup}
        show={true}
      />
    </div>
  );
}

function QuickActionButton({ label, onClick, show = true }) {
  if (!show) return null;
  return (
    <PrismHoverTarget targetId={`quick-action-${label}`}>
      <button
        type="button"
        onClick={onClick}
        className="metacanon-home-quick-action rounded px-3 py-1 text-[12px] font-normal leading-5 transition-colors"
      >
        {label}
      </button>
    </PrismHoverTarget>
  );
}
