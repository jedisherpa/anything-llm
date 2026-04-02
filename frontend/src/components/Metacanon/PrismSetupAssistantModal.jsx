import ModalWrapper from "@/components/ModalWrapper";
import PrismSetupAssistantFlow from "./PrismSetupAssistantFlow";

export default function PrismSetupAssistantModal({
  isOpen = false,
  onClose = () => {},
  onApplied = () => {},
}) {
  return (
    <ModalWrapper isOpen={isOpen}>
      <PrismSetupAssistantFlow
        mode="modal"
        onClose={onClose}
        onApplied={() => {
          onApplied();
          onClose();
        }}
      />
    </ModalWrapper>
  );
}
