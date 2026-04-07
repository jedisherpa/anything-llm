import ModalWrapper from "@/components/ModalWrapper";
import PrismHoverTarget from "@/components/PrismHoverTarget";
import useMetacanonAlignment from "@/hooks/useMetacanonAlignment";
import {
  deleteFeaturedCouncil,
  loadFeaturedCouncils,
  METACANON_FEATURED_COUNCILS_EVENT,
  updateCouncilPack,
} from "@/models/metacanonLibrary";
import {
  clearActiveMetacanonAlignment,
  setActiveMetacanonAlignment,
} from "@/utils/metacanonAlignment";
import {
  cleanPillName,
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

function getCouncilChipLabel(council = {}) {
  if (council.kind !== "council" && council.leadTitle) {
    return `Lead Lens: ${council.leadTitle}`;
  }

  const lensCount =
    council.lensHandles?.length || council.lensTitles?.length || 0;
  if (lensCount > 0) {
    return `${lensCount} ${lensCount === 1 ? "Lens" : "Lenses"}`;
  }

  return council.collectionLabel || METACANON_TERMS.councils;
}

function FeaturedCouncilPill({
  council,
  active = false,
  onToggle = () => {},
  onOpenChat = () => {},
  onRemove = () => {},
  onRename = async () => false,
}) {
  const rawTitle = council.title || getCouncilUiTitle(council);
  const title = cleanPillName(rawTitle);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [nextName, setNextName] = useState(rawTitle);
  const [renaming, setRenaming] = useState(false);
  const isCustomCouncil =
    council.kind !== "council" && !!(council.sourceId || council.id);

  useEffect(() => {
    if (showRenameModal) {
      setNextName(rawTitle);
    }
  }, [showRenameModal, rawTitle]);

  async function handleRename(event) {
    event?.preventDefault?.();
    const name = nextName.trim();
    if (!name) return;
    if (name === rawTitle) {
      setShowRenameModal(false);
      return;
    }

    setRenaming(true);
    const renamed = await onRename(council, name);
    setRenaming(false);
    if (renamed) {
      setShowRenameModal(false);
    }
  }

  return (
    <>
      <PrismHoverTarget targetId={`sidebar-council-${council.featureId}`}>
        <div
          className="prism-sidebar-pill group"
          data-active={active ? "true" : "false"}
        >
          <button
            type="button"
            onClick={() => onToggle(council, active)}
            className="prism-sidebar-pill__label"
          >
            {title}
            {active && (
              <span className="prism-sidebar-pill__badge">Aligned</span>
            )}
          </button>
          <div className="prism-sidebar-pill__actions">
            {isCustomCouncil ? (
              <button
                type="button"
                onClick={() => setShowRenameModal(true)}
                className="prism-sidebar-module__link"
              >
                Rename
              </button>
            ) : null}
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

      {showRenameModal ? (
        <ModalWrapper isOpen={showRenameModal}>
          <div className="w-full max-w-md rounded-2xl border border-theme-sidebar-border bg-theme-bg-container p-5 shadow-xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-primary-button">
              Rename Custom Council
            </div>
            <div className="mt-2 text-lg font-semibold text-theme-text-primary">
              Update the council name shown in Councils
            </div>
            <div className="mt-2 text-sm leading-6 text-theme-text-secondary">
              Choose the name people will recognize in the sidebar and library.
            </div>
            <form className="mt-4 flex flex-col gap-3" onSubmit={handleRename}>
              <input
                autoFocus
                value={nextName}
                onChange={(event) => setNextName(event.target.value)}
                placeholder="Name this custom council"
                className="h-[46px] rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar px-4 text-sm text-theme-text-primary outline-none placeholder:text-theme-settings-input-placeholder"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="prism-sidebar-module__link"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renaming || !nextName.trim()}
                  className="rounded-full bg-theme-primary-button px-4 py-2 text-sm font-semibold text-theme-primary-button-text disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {renaming ? "Renaming..." : "Save Name"}
                </button>
              </div>
            </form>
          </div>
        </ModalWrapper>
      ) : null}
    </>
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

  async function renameCouncil(council, name) {
    const updated = updateCouncilPack(council.sourceId || council.id, { name });
    if (!updated) {
      showToast("Could not rename this council.", "error");
      return false;
    }

    if (
      activeAlignment?.id === (council.sourceId || council.id) &&
      activeAlignment?.collectionLabel ===
        (council.collectionLabel || METACANON_TERMS.councils)
    ) {
      setActiveMetacanonAlignment(
        buildCouncilAlignment({
          ...council,
          title: updated.name,
          description: updated.description,
          lensHandles: updated.lensHandles,
          lensTitles: updated.lensTitles,
          leadTitle: updated.leadTitle,
          colorHex: updated.colorHex,
        })
      );
    }

    setFeaturedCouncils(loadFeaturedCouncils());
    showToast(`Council renamed to ${updated.name}.`, "success");
    return true;
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
            Councils
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
              <FeaturedCouncilPill
                key={council.featureId}
                council={council}
                active={active}
                onToggle={toggleCouncil}
                onOpenChat={openAlignedChat}
                onRemove={removeCouncil}
                onRename={renameCouncil}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
