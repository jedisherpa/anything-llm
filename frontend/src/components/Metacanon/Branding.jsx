import { usePrism } from "@/PrismContext";
import { useTheme } from "@/hooks/useTheme";
import PrismPresence from "@/components/PrismPresence";
import paths from "@/utils/paths";
import { Link } from "react-router-dom";
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
        idle: dodecaIdleLight,
        thinking: dodecaThinkingLight,
      };
    case "cathedral":
      return {
        idle: dodecaIdleCathedral,
        thinking: dodecaThinkingCathedral,
      };
    default:
      return {
        idle: dodecaIdleDark,
        thinking: dodecaThinkingDark,
      };
  }
}

export function MetacanonSidebarBrand() {
  const { state } = usePrism();
  const { isLightTheme, resolvedTheme } = useTheme();
  const themeMode = getThemeMode(resolvedTheme, isLightTheme);
  const assets = getThemeAssets(themeMode);
  const mark = state === "thinking" ? assets.thinking : assets.idle;

  return (
    <Link
      to={paths.home()}
      className="metacanon-sidebar-brand group flex w-full items-center gap-2.5 rounded-[18px] px-1 py-1 transition-all duration-300"
    >
      <span className="metacanon-sidebar-brand-mark-wrap flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[17px]">
        <img
          src={mark}
          alt="Metacanon Prism"
          className={`metacanon-sidebar-brand-mark h-[58px] w-[58px] shrink-0 object-contain ${
            themeMode === "light" ? "metacanon-sidebar-brand-mark--light" : ""
          }`}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="metacanon-sidebar-brand-title text-[15px] font-semibold leading-[1.05] tracking-[0.035em] text-theme-text-primary md:text-[16px]">
          Prism AI Tool
        </div>
        <div className="metacanon-sidebar-brand-copy mt-1 text-[10.5px] leading-[1.15] text-theme-text-secondary">
          <span className="block">Built on AnythingLLM</span>
          <span className="block whitespace-nowrap">by Transformation Agency</span>
        </div>
        <div className="metacanon-sidebar-brand-status mt-[7px] flex min-h-[16px] items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#d8a917]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#d8a917]" />
          <span className="inline-block min-w-0 whitespace-nowrap">
            {prismStatusLabel(state, themeMode)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function MetacanonHeroGlyph({ className = "h-[96px] w-[96px]" }) {
  return (
    <PrismPresence
      surface="home-hero"
      size="lg"
      showLabel={false}
      showState={false}
      className={`metacanon-hero-glyph ${className}`}
    />
  );
}
