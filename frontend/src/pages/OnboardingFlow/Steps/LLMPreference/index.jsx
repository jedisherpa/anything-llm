import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import PrismSetupAssistantFlow from "@/components/Metacanon/PrismSetupAssistantFlow";
import paths from "@/utils/paths";

export default function LLMPreference({
  setHeader,
  setForwardBtn,
  setBackBtn,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    setHeader({
      title: t("onboarding.llm.title"),
      description: t("onboarding.llm.description"),
    });
    setForwardBtn({ showing: false, disabled: true, onClick: () => null });
    setBackBtn({ showing: false, disabled: true, onClick: () => null });
  }, [setBackBtn, setForwardBtn, setHeader, t]);

  return (
    <div className="w-full flex justify-center pb-12">
      <PrismSetupAssistantFlow
        mode="onboarding"
        onBack={() => navigate(paths.onboarding.home())}
        onApplied={() => navigate(paths.onboarding.userSetup())}
      />
    </div>
  );
}
