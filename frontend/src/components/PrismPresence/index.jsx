import React, { useEffect, useId } from "react";
import { usePrism } from "@/PrismContext";
import { useTheme } from "@/hooks/useTheme";
import dodecaIdleDark from "@/media/metacanon/dodeca-idle-dark.png";
import dodecaIdleLight from "@/media/metacanon/dodeca-idle-light.png";
import dodecaIdleCathedral from "@/media/metacanon/dodeca-idle-cathedral.png";
import dodecaThinkingDark from "@/media/metacanon/dodeca-thinking-dark.png";
import dodecaThinkingLight from "@/media/metacanon/dodeca-thinking-light.png";
import dodecaThinkingCathedral from "@/media/metacanon/dodeca-thinking-cathedral.png";

const SIZE_MAP = {
  xs: {
    orb: "h-10 w-10",
    image: "h-7 w-7",
    copy: "text-[10px]",
  },
  sm: {
    orb: "h-12 w-12",
    image: "h-8 w-8",
    copy: "text-[11px]",
  },
  md: {
    orb: "h-16 w-16",
    image: "h-11 w-11",
    copy: "text-xs",
  },
  lg: {
    orb: "h-24 w-24",
    image: "h-16 w-16",
    copy: "text-sm",
  },
};

const STATE_LABELS = {
  idle: "Idle",
  hover: "Hover",
  thinking: "Thinking",
  response: "Response",
  error: "Error",
};

export default function PrismPresence({
  surface = "global",
  size = "md",
  label = "Prism",
  caption = null,
  showState = true,
  className = "",
  align = "center",
}) {
  const prismId = useId();
  const { state, setHoverTarget } = usePrism();
  const { isLightTheme, resolvedTheme } = useTheme();
  const palette = SIZE_MAP[size] ?? SIZE_MAP.md;
  const alignmentClass =
    align === "left" ? "items-start text-left" : "items-center text-center";
  const themeMode =
    resolvedTheme === "cathedral"
      ? "cathedral"
      : isLightTheme
        ? "light"
        : "dark";
  const imageSrc =
    state === "thinking"
      ? themeMode === "cathedral"
        ? dodecaThinkingCathedral
        : isLightTheme
          ? dodecaThinkingLight
          : dodecaThinkingDark
      : themeMode === "cathedral"
        ? dodecaIdleCathedral
        : isLightTheme
          ? dodecaIdleLight
          : dodecaIdleDark;

  useEffect(() => {
    return () => setHoverTarget(prismId, false);
  }, [prismId, setHoverTarget]);

  return (
    <div
      className={`prism-presence inline-flex select-none ${className}`}
      data-prism-state={state}
      data-prism-surface={surface}
      onMouseEnter={() => setHoverTarget(prismId, true)}
      onMouseLeave={() => setHoverTarget(prismId, false)}
      role="status"
      aria-live="polite"
      aria-label={`Prism status: ${state}`}
      title={`Prism ${state}`}
    >
      <div className={`flex flex-col gap-2 ${alignmentClass}`}>
        <div
          className={`prism-presence__orb ${palette.orb} rounded-full flex items-center justify-center`}
        >
          <span className="prism-presence__halo" />
          <span className="prism-presence__ring prism-presence__ring--outer" />
          <span className="prism-presence__ring prism-presence__ring--inner" />
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            className={`prism-presence__image ${palette.image}`}
          />
        </div>
        <div className="space-y-0.5">
          <p
            className={`prism-presence__label ${palette.copy} uppercase tracking-[0.24em] text-[var(--prism-text-strong)]`}
          >
            {label}
          </p>
          {caption ? (
            <p className="prism-presence__caption text-[11px] text-[var(--prism-text-soft)]">
              {caption}
            </p>
          ) : null}
          {showState ? (
            <span className="prism-presence__state text-[10px] uppercase tracking-[0.18em]">
              {STATE_LABELS[state] ?? state}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
