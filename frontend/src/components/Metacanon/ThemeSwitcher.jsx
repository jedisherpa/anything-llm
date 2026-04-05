import { useTheme } from "@/hooks/useTheme";

const THEME_LABELS = {
  dark: "Dark",
  light: "Light",
  cathedral: "Cathedral",
};

export default function MetacanonThemeSwitcher({
  className = "",
  showLabel = true,
}) {
  const { theme, setTheme, availableThemes } = useTheme();
  const themes = Object.keys(availableThemes);

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {themes.map((themeKey) => {
        const isActive = theme === themeKey;
        return (
          <button
            key={themeKey}
            type="button"
            onClick={() => setTheme(themeKey)}
            data-active={isActive ? "true" : "false"}
            className="metacanon-mode-pill rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors"
          >
            {THEME_LABELS[themeKey] || themeKey}
          </button>
        );
      })}
    </div>
  );
}
