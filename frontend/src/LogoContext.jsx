import { createContext, useEffect, useState } from "react";
import MetacanonLogoDark from "./media/logo/anythingllm-metacanonai-dark.svg";
import MetacanonLogoLight from "./media/logo/anythingllm-metacanonai-light.svg";
import System from "./models/system";

export const REFETCH_LOGO_EVENT = "refetch-logo";

function isLightMode() {
  const theme = document.documentElement.getAttribute("data-theme");
  return theme === "light";
}
export const LogoContext = createContext();

export function LogoProvider({ children }) {
  const [logo, setLogo] = useState("");
  const [loginLogo, setLoginLogo] = useState("");
  const [isCustomLogo, setIsCustomLogo] = useState(false);

  async function fetchInstanceLogo() {
    const defaultLogo = isLightMode() ? MetacanonLogoLight : MetacanonLogoDark;
    try {
      const { isCustomLogo, logoURL } = await System.fetchLogo();
      if (logoURL) {
        setLogo(logoURL);
        setLoginLogo(isCustomLogo ? logoURL : defaultLogo);
        setIsCustomLogo(isCustomLogo);
      } else {
        setLogo(defaultLogo);
        setLoginLogo(defaultLogo);
        setIsCustomLogo(false);
      }
    } catch (err) {
      setLogo(defaultLogo);
      setLoginLogo(defaultLogo);
      setIsCustomLogo(false);
      console.error("Failed to fetch logo:", err);
    }
  }

  useEffect(() => {
    fetchInstanceLogo();
    window.addEventListener(REFETCH_LOGO_EVENT, fetchInstanceLogo);
    return () => {
      window.removeEventListener(REFETCH_LOGO_EVENT, fetchInstanceLogo);
    };
  }, []);

  return (
    <LogoContext.Provider value={{ logo, setLogo, loginLogo, isCustomLogo }}>
      {children}
    </LogoContext.Provider>
  );
}
