import PrismHoverTarget from "@/components/PrismHoverTarget";
import useMetacanonAlignment from "@/hooks/useMetacanonAlignment";
import metacanonLibrarySummary from "@/data/metacanon/summary.generated";
import {
  loadFeaturedLenses,
  METACANON_FEATURED_LENSES_EVENT,
} from "@/models/metacanonLibrary";
import {
  clearActiveMetacanonAlignment,
  getMetacanonLensAccent,
  setActiveMetacanonAlignment,
} from "@/utils/metacanonAlignment";
import {
  getLensUiCollectionLabel,
  getLensUiTitle,
} from "@/utils/metacanonTerminology";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

const featuredLenses = metacanonLibrarySummary.featuredLenses || [];

function cleanPillName(name = "") {
  return name
    .replace(/^The\s+/i, "")
    .replace(/-/g, " ")
    .trim();
}

function FeaturedLensPill({ lens, active, onToggle }) {
  const title = cleanPillName(getLensUiTitle(lens));
  const cardStyle = {
    "--lens-color": getMetacanonLensAccent(lens),
  };

  return (
    <PrismHoverTarget targetId={`sidebar-lens-${lens.id}`}>
      <button
        type="button"
        onClick={() => onToggle(lens, active)}
        style={cardStyle}
        data-active={active ? "true" : "false"}
        className="prism-sidebar-pill metacanon-lens-pill w-full"
      >
        <span className="prism-sidebar-pill__label">{title}</span>
        {active && (
          <span className="prism-sidebar-pill__badge">Aligned</span>
        )}
      </button>
    </PrismHoverTarget>
  );
}

export default function SidebarFeaturedLenses() {
  const activeAlignment = useMetacanonAlignment();
  const [customFeaturedLenses, setCustomFeaturedLenses] = useState(() =>
    loadFeaturedLenses()
  );

  useEffect(() => {
    function syncFeaturedLenses(event) {
      if (event?.type === "storage") {
        if (event.key && event.key !== "metacanon-sidebar-featured-lenses")
          return;
        setCustomFeaturedLenses(loadFeaturedLenses());
        return;
      }
      setCustomFeaturedLenses(event?.detail ?? loadFeaturedLenses());
    }

    window.addEventListener(
      METACANON_FEATURED_LENSES_EVENT,
      syncFeaturedLenses
    );
    window.addEventListener("storage", syncFeaturedLenses);
    return () => {
      window.removeEventListener(
        METACANON_FEATURED_LENSES_EVENT,
        syncFeaturedLenses
      );
      window.removeEventListener("storage", syncFeaturedLenses);
    };
  }, []);

  const visibleLenses = useMemo(
    () =>
      customFeaturedLenses.length > 0 ? customFeaturedLenses : featuredLenses,
    [customFeaturedLenses]
  );

  function toggleLens(lens, isActive) {
    if (isActive) {
      clearActiveMetacanonAlignment();
      showToast("Lens alignment cleared.", "info");
      return;
    }

    const next = setActiveMetacanonAlignment({
      ...lens,
      title: getLensUiTitle(lens),
      collectionLabel: getLensUiCollectionLabel(lens),
    });
    if (!next) {
      showToast("This Lens is not ready to align yet.", "warning");
      return;
    }

    showToast(
      `Prism aligned to ${next?.title}. Your next message will use this Lens.`,
      "success"
    );
  }

  return (
    <div className="prism-sidebar-module">
      <div className="prism-sidebar-module__header">
        <div className="prism-sidebar-module__heading">
          <div className="metacanon-sidebar-section-label text-[11px] font-semibold uppercase">
            Quick Lenses
          </div>
        </div>
        <Link
          to={paths.metacanonAILibrary()}
          className="prism-sidebar-module__link"
        >
          Open Library
        </Link>
      </div>
      {visibleLenses.length > 0 ? (
        <div className="flex flex-col gap-y-1.5">
          {visibleLenses.map((lens) => (
            <FeaturedLensPill
              key={lens.featureId || lens.id}
              lens={lens}
              active={
                activeAlignment?.id === lens.id ||
                activeAlignment?.handle === lens.handle
              }
              onToggle={toggleLens}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
