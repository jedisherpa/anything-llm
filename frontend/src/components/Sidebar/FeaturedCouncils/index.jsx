import PrismHoverTarget from "@/components/PrismHoverTarget";
import useMetacanonAlignment from "@/hooks/useMetacanonAlignment";
import {
  deleteFeaturedCouncil,
  loadFeaturedCouncils,
  METACANON_FEATURED_COUNCILS_EVENT,
} from "@/models/metacanonLibrary";
import {
  clearActiveMetacanonAlignment,
  setActiveMetacanonAlignment,
} from "@/utils/metacanonAlignment";
import {
  getCouncilUiTitle,
  METACANON_TERMS,
} from "@/utils/metacanonTerminology";
import { openMetacanonChat } from "@/utils/metacanonLaunch";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

function buildCouncilAlignment(council = {}) {
  return {
    id: council.sourceId || council.id,
    title: council.title || getCouncilUiTitle(council),
    kind: "pack",
    collectionLabel: council.collectionLabel || METACANON_TERMS.councils,
    lensHandles: council.lensHandles || [],
    lensTitles: council.lensTitles || [],
    colorHex: council.colorHex || "#d4a63e",
  };
}

function FeaturedCouncilRow({
  council,
  active = false,
  onToggle = () => {},
  onOpenChat = () => {},
  onRemove = () => {},
}) {
  const title = council.title || getCouncilUiTitle(council);

  return (
    <PrismHoverTarget targetId={`sidebar-council-${council.featureId}`}>
      <div className="prism-sidebar-card px-[12px] py-[10px] text-left transition-all duration-200">
        <button
          type="button"
          onClick={() => onToggle(council, active)}
          className="w-full text-left"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="prism-sidebar-card__eyebrow">
                {council.kind === "council"
                  ? "Canonical Council"
                  : "Custom Council"}
              </div>
              <div className="prism-sidebar-card__title mt-1 truncate">
                {title}
              </div>
              <div className="prism-sidebar-card__body mt-1">
                {council.description ||
                  `${council.lensHandles?.length || 0} lenses routed through council-pack orchestration.`}
              </div>
            </div>
            {active ? (
              <div className="prism-sidebar-chip prism-sidebar-chip--active shrink-0">
                Aligned
              </div>
            ) : null}
          </div>
        </button>
        <div className="prism-sidebar-card__actions">
          <div className="prism-sidebar-card__action-group">
            <div className="prism-sidebar-chip prism-sidebar-chip--ghost">
              {council.collectionLabel || METACANON_TERMS.councils}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChat(council)}
            className="prism-sidebar-module__link"
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => onRemove(council.featureId, title)}
            className="prism-sidebar-module__link"
          >
            Remove
          </button>
        </div>
      </div>
    </PrismHoverTarget>
  );
}

export default function SidebarFeaturedCouncils() {
  const navigate = useNavigate();
  const activeAlignment = useMetacanonAlignment();
  const [featuredCouncils, setFeaturedCouncils] = useState(() =>
    loadFeaturedCouncils()
  );

  useEffect(() => {
    function syncFeaturedCouncils(event) {
      if (event?.type === "storage") {
        if (event.key && event.key !== "metacanon-sidebar-featured-councils") {
          return;
        }
        setFeaturedCouncils(loadFeaturedCouncils());
        return;
      }
      setFeaturedCouncils(event?.detail ?? loadFeaturedCouncils());
    }

    window.addEventListener(
      METACANON_FEATURED_COUNCILS_EVENT,
      syncFeaturedCouncils
    );
    window.addEventListener("storage", syncFeaturedCouncils);
    return () => {
      window.removeEventListener(
        METACANON_FEATURED_COUNCILS_EVENT,
        syncFeaturedCouncils
      );
      window.removeEventListener("storage", syncFeaturedCouncils);
    };
  }, []);

  const visibleCouncils = useMemo(() => featuredCouncils, [featuredCouncils]);

  function toggleCouncil(council, isActive) {
    if (isActive) {
      clearActiveMetacanonAlignment();
      showToast("Council alignment cleared.", "info");
      return;
    }

    const next = setActiveMetacanonAlignment(buildCouncilAlignment(council));
    if (!next) {
      showToast("This council is not ready to align yet.", "warning");
      return;
    }

    showToast(
      `Prism aligned to ${next.title}. Your next message will run this council.`,
      "success"
    );
  }

  function removeCouncil(featureId, title) {
    setFeaturedCouncils(deleteFeaturedCouncil(featureId));
    showToast(`${title || "Council"} removed from the sidebar.`, "success");
  }

  async function openAlignedChat(council) {
    const next = setActiveMetacanonAlignment(buildCouncilAlignment(council));
    if (!next) {
      showToast("This council is not ready to align yet.", "warning");
      return;
    }

    try {
      const opened = await openMetacanonChat({ navigate });
      if (!opened) return;
      showToast(`Opening chat aligned to ${next.title}.`, "success");
    } catch (error) {
      console.error(error);
      showToast("Failed to open aligned chat.", "error");
    }
  }

  return (
    <div className="prism-sidebar-module">
      <div className="prism-sidebar-module__header">
        <div className="prism-sidebar-module__heading">
          <div className="metacanon-sidebar-section-label text-[11px] font-semibold uppercase">
            Featured {METACANON_TERMS.councils}
          </div>
        </div>
        <Link
          to={paths.metacanonAILibrary()}
          className="prism-sidebar-module__link"
        >
          Manage
        </Link>
      </div>
      {visibleCouncils.length > 0 ? (
        <div className="flex flex-col gap-y-2">
          {visibleCouncils.map((council) => {
            const alignment = buildCouncilAlignment(council);
            const active =
              activeAlignment?.id === alignment.id &&
              activeAlignment?.collectionLabel === alignment.collectionLabel;
            return (
              <FeaturedCouncilRow
                key={council.featureId}
                council={council}
                active={active}
                onToggle={toggleCouncil}
                onOpenChat={openAlignedChat}
                onRemove={removeCouncil}
              />
            );
          })}
        </div>
      ) : (
        <div className="prism-sidebar-empty">
          Add canonical or custom councils from the library to keep them here.
        </div>
      )}
    </div>
  );
}
