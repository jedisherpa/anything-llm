import { REFETCH_LOGO_EVENT } from "@/LogoContext";
import { useState, useEffect } from "react";

const availableThemes = {
  dark: "Prism Dark",
  light: "Prism Light",
  cathedral: "Cathedral",
};

const LIGHT_THEMES = new Set(["light"]);

function getInitialTheme() {
  const stored = localStorage.getItem("theme");

  if (stored === "default" || !stored) return "dark";
  if (stored === "sanctuary") return "light";
  if (stored === "system") {
    return window?.matchMedia?.("(prefers-color-scheme: light)")?.matches
      ? "light"
      : "dark";
  }

  return Object.prototype.hasOwnProperty.call(availableThemes, stored)
    ? stored
    : "dark";
}

/**
 * Determines the current theme of the application.
 * "system" follows the OS preference, and explicit themes force that mode.
 * @returns {{theme: string, resolvedTheme: string, isLightTheme: boolean, setTheme: function, availableThemes: object}}
 */
export function useTheme() {
  const [theme, _setTheme] = useState(getInitialTheme);

  const resolvedTheme = theme;
  const isLightTheme = LIGHT_THEMES.has(resolvedTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
    document.body.classList.toggle("light", isLightTheme);
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new Event(REFETCH_LOGO_EVENT));
  }, [resolvedTheme, theme, isLightTheme]);

  // In development, attach keybind combinations to toggle theme
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    function toggleOnKeybind(e) {
      if (e.metaKey && e.key === ".") {
        e.preventDefault();
        _setTheme((prev) => {
          const themes = Object.keys(availableThemes);
          const currentIndex = themes.indexOf(prev);
          const nextIndex =
            currentIndex >= 0 ? (currentIndex + 1) % themes.length : 0;
          return themes[nextIndex];
        });
      }
    }
    document.addEventListener("keydown", toggleOnKeybind);
    return () => document.removeEventListener("keydown", toggleOnKeybind);
  }, []);

  /**
   * Sets the theme of the application and runs any
   * other necessary side effects
   * @param {string} newTheme The new theme to set
   */
  function setTheme(newTheme) {
    _setTheme(newTheme);
  }

  return { theme, resolvedTheme, isLightTheme, setTheme, availableThemes };
}
