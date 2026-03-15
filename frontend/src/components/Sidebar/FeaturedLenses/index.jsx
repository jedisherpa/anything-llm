import PrismHoverTarget from "@/components/PrismHoverTarget";
import useMetacanonAlignment from "@/hooks/useMetacanonAlignment";
import metacanonLibrarySummary from "@/data/metacanon/summary.generated";
import {
  clearActiveMetacanonAlignment,
  getMetacanonLensAccent,
  setActiveMetacanonAlignment,
} from "@/utils/metacanonAlignment";
import {
  getLensUiCollectionLabel,
  getLensUiTitle,
  METACANON_TERMS,
} from "@/utils/metacanonTerminology";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { Link } from "react-router-dom";

const featuredLenses = metacanonLibrarySummary.featuredLenses || [];

function FeaturedLensRow({ lens, active, onToggle }) {
  const title = getLensUiTitle(lens);
  const collectionLabel = getLensUiCollectionLabel(lens);
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
        className="metacanon-lens-card w-full rounded-[14px] px-[12px] py-[10px] text-left transition-all duration-200"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="metacanon-lens-card__meta text-[10px] font-semibold uppercase tracking-[0.16em]">
              {collectionLabel}
            </div>
            <div className="metacanon-lens-card__title mt-1 truncate text-[15px] leading-tight">
              {title}
            </div>
          </div>
          {active ? (
            <div className="metacanon-lens-card__badge shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
              Aligned
            </div>
          ) : null}
        </div>
      </button>
    </PrismHoverTarget>
  );
}

export default function SidebarFeaturedLenses() {
  const activeAlignment = useMetacanonAlignment();

  const groupedLenses = featuredLenses.reduce((groups, lens) => {
    const label = getLensUiCollectionLabel(lens);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(lens);
    return groups;
  }, new Map());

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

    showToast(
      `Prism aligned to ${next?.title}. Your next message will use this Lens.`,
      "success"
    );
  }

  return (
    <div className="flex flex-col gap-y-3 px-1">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="metacanon-sidebar-section-label text-[11px] font-semibold uppercase tracking-[0.26em]">
          Featured {METACANON_TERMS.lenses}
        </div>
        <Link
          to={paths.metacanonAILibrary()}
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-theme-text-secondary transition-colors hover:text-theme-text-primary"
        >
          Open Library
        </Link>
      </div>
      <div className="flex flex-col gap-y-3">
        {Array.from(groupedLenses.entries()).map(([label, lenses]) => (
          <div key={label} className="flex flex-col gap-y-2">
            <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-text-secondary">
              {label}
            </div>
            <div className="flex flex-col gap-y-2">
              {lenses.map((lens) => (
                <FeaturedLensRow
                  key={lens.id}
                  lens={lens}
                  active={activeAlignment?.id === lens.id}
                  onToggle={toggleLens}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
