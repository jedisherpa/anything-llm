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
      className={`inline-flex items-center gap-3 rounded-full border border-[var(--comp-border)] bg-[color:var(--comp-bg)] px-2 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.18)] backdrop-blur-xl ${className}`}
    >
      {showLabel ? (
        <span className="pl-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-2)]">
          Mode
        </span>
      ) : null}
      <div className="flex items-center gap-1">
        {themes.map((themeKey) => {
          const isActive = theme === themeKey;
          return (
            <button
              key={themeKey}
              type="button"
              onClick={() => setTheme(themeKey)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "border-[var(--gold-border)] bg-[var(--gold-bg)] text-[var(--text-1)]"
                  : "border-transparent bg-transparent text-[var(--text-2)] hover:border-[var(--comp-border)] hover:bg-[var(--gold-bg)] hover:text-[var(--text-1)]"
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
