import CTAButton from "@/components/lib/CTAButton";
import CommunityHubImportItemSteps from "../..";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";

export default function UnknownItem({ item, setSettings, setStep }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Warning size={24} className="text-red-500" />
        <h2 className="text-xl font-semibold text-red-500">
          Unsupported item
        </h2>
      </div>

      <div className="prism-community-import-callout prism-community-import-callout--danger">
        <p>
          We found an item in the community hub, but we don't know what it is or
          it is not yet supported for import into AnythingLLM.
        </p>
        <p className="mt-4">
          The item ID is: <b>{item.id}</b>
          <br />
          The item type is: <b>{item.itemType}</b>
        </p>
        <p className="mt-4">
          Please contact support via email if you need help importing this item.
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
  );
}
