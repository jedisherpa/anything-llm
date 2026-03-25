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
      className={`metacanon-theme-switcher inline-flex flex-col items-center gap-1 rounded-[15px] border border-[color:color-mix(in_srgb,var(--comp-border)_44%,transparent)] bg-[color:color-mix(in_srgb,var(--comp-bg)_68%,transparent)] px-2 py-1.5 ${className}`}
    >
      {showLabel ? (
        <span className="w-full text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-2)]">
          Sanctuary
        </span>
      ) : null}
      <div className="flex items-center gap-[6px]">
        {themes.map((themeKey) => {
          const isActive = theme === themeKey;
          return (
            <button
              key={themeKey}
              type="button"
              onClick={() => setTheme(themeKey)}
              data-open={isActive ? "true" : "false"}
              className={`metacanon-composer-toolbar-button metacanon-theme-switcher__button rounded-full px-[9px] py-[5px] text-[10.5px] font-semibold ${
                isActive
                  ? "metacanon-theme-switcher__button--active text-[var(--text-1)]"
                  : "text-[var(--text-2)]"
              }`}
            >
              {THEME_LABELS[themeKey] || themeKey}
            </button>
          );
        })}
      </div>
    </div>
  );
}
