import { REFETCH_LOGO_EVENT } from "@/LogoContext";
import { useEffect, useLayoutEffect, useState } from "react";

const THEME_CHANGED_EVENT = "prism-theme-changed";

const availableThemes = {
  dark: "Prism Dark",
  light: "Prism Light",
  cathedral: "Cathedral",
};

const LIGHT_THEMES = new Set(["light"]);

function applyThemeToDocument(nextTheme) {
  const resolvedTheme = nextTheme;
  const isLightTheme = LIGHT_THEMES.has(resolvedTheme);
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  document.body.classList.toggle("light", isLightTheme);
  localStorage.setItem("theme", nextTheme);
  window.dispatchEvent(new Event(REFETCH_LOGO_EVENT));
}

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

  useLayoutEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    function syncTheme(nextTheme) {
      if (!nextTheme) return;
      _setTheme((prev) => (prev === nextTheme ? prev : nextTheme));
    }

    function handleThemeChanged(event) {
      syncTheme(event?.detail?.theme);
    }

    function handleStorage(event) {
      if (event.key !== "theme") return;
      syncTheme(getInitialTheme());
    }

    window.addEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, handleThemeChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

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
    if (!newTheme || newTheme === theme) return;
    applyThemeToDocument(newTheme);
    _setTheme(newTheme);
    window.dispatchEvent(
      new CustomEvent(THEME_CHANGED_EVENT, {
        detail: { theme: newTheme },
      })
    );
  }

  return { theme, resolvedTheme, isLightTheme, setTheme, availableThemes };
}
