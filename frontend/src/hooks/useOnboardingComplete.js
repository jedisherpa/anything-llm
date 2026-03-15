import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import System from "@/models/system";
import paths from "@/utils/paths";

export default function useRedirectToHomeOnOnboardingComplete() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("preview") === "1") return;

    async function checkOnboardingComplete() {
      const onboardingComplete = await System.isOnboardingComplete();
      if (onboardingComplete === false) return;
      navigate(paths.home());
    }
    checkOnboardingComplete();
  }, [location.search, navigate]);
}
