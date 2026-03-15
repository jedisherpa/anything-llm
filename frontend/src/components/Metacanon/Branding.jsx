import { usePrism } from "@/PrismContext";
import { useTheme } from "@/hooks/useTheme";
import paths from "@/utils/paths";
import { Link } from "react-router-dom";
import starTetraDark from "@/media/metacanon/star-tetra-dark.png";
import starTetraLight from "@/media/metacanon/star-tetra-light.png";
import starTetraCathedral from "@/media/metacanon/star-tetra-cathedral.png";
import dodecaIdleDark from "@/media/metacanon/dodeca-idle-dark.png";
import dodecaIdleLight from "@/media/metacanon/dodeca-idle-light.png";
import dodecaIdleCathedral from "@/media/metacanon/dodeca-idle-cathedral.png";
import dodecaThinkingDark from "@/media/metacanon/dodeca-thinking-dark.png";
import dodecaThinkingLight from "@/media/metacanon/dodeca-thinking-light.png";
import dodecaThinkingCathedral from "@/media/metacanon/dodeca-thinking-cathedral.png";

function getThemeMode(resolvedTheme, isLightTheme) {
  if (resolvedTheme === "cathedral") return "cathedral";
  return isLightTheme ? "light" : "dark";
}

function prismStatusLabel(state = "idle", themeMode = "dark") {
  if (themeMode === "cathedral" && state === "idle") return "SANCTUARY";
  if (state === "idle") return "PRISM READY";
  return `PRISM ${String(state || "idle").toUpperCase()}`;
}

function getThemeAssets(themeMode = "dark") {
  switch (themeMode) {
    case "light":
      return {
        mark: starTetraLight,
        idle: dodecaIdleLight,
        thinking: dodecaThinkingLight,
      };
    case "cathedral":
      return {
        mark: starTetraCathedral,
        idle: dodecaIdleCathedral,
        thinking: dodecaThinkingCathedral,
      };
    default:
      return {
        mark: starTetraDark,
        idle: dodecaIdleDark,
        thinking: dodecaThinkingDark,
      };
  }
}

export function MetacanonSidebarBrand() {
  const { state } = usePrism();
  const { isLightTheme, resolvedTheme } = useTheme();
  const themeMode = getThemeMode(resolvedTheme, isLightTheme);
  const { mark } = getThemeAssets(themeMode);

  return (
    <Link
      to={paths.home()}
      className="metacanon-sidebar-brand group flex items-start gap-4 rounded-[20px] px-3 py-3 transition-all duration-300 hover:bg-white/[0.03] light:hover:bg-black/[0.03]"
    >
      <img
        src={mark}
        alt="PrismAI"
        className="mt-0.5 h-[46px] w-[46px] object-contain"
      />
      <div className="flex min-w-0 flex-col">
        <div className="metacanon-sidebar-brand-title text-[15px] font-semibold leading-tight text-theme-text-primary md:text-[16px]">
          PrismAI
        </div>
        <div className="metacanon-sidebar-brand-copy mt-1 text-[11px] leading-5 text-theme-text-secondary">
          Powered by AnythingLLM
        </div>
        <div className="metacanon-sidebar-brand-status mt-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d8a917]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#d8a917]" />
          <span>{prismStatusLabel(state, themeMode)}</span>
        </div>
      </div>
    </Link>
  );
}

export function MetacanonHeroGlyph({ className = "h-[96px] w-[96px]" }) {
  const { state } = usePrism();
  const { isLightTheme, resolvedTheme } = useTheme();
  const themeMode = getThemeMode(resolvedTheme, isLightTheme);
  const isThinking = state === "thinking";
  const assets = getThemeAssets(themeMode);
  const src = isThinking ? assets.thinking : assets.idle;

  return (
    <div
      className={`metacanon-hero-glyph ${isThinking ? "metacanon-hero-glyph-thinking" : ""} ${className}`}
    >
      <img
        src={src}
        alt={prismStatusLabel(state, themeMode)}
        className="h-full w-full object-contain"
      />
    </div>
  );
}
