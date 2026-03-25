import PrismHoverTarget from "@/components/PrismHoverTarget";
import useMetacanonAlignment from "@/hooks/useMetacanonAlignment";
import {
  deletePinnedConstellation,
  loadPinnedConstellations,
  METACANON_PINNED_CONSTELLATIONS_EVENT,
  reorderPinnedConstellations,
} from "@/models/metacanonLibrary";
import {
  clearActiveMetacanonAlignment,
  setActiveMetacanonAlignment,
} from "@/utils/metacanonAlignment";
import { openMetacanonChat } from "@/utils/metacanonLaunch";
import { METACANON_TERMS } from "@/utils/metacanonTerminology";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { DotsSixVertical } from "@phosphor-icons/react/dist/csr/DotsSixVertical";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";

function getAlignmentKey(alignment = {}) {
  return (
    alignment?.sourceId ||
    alignment?.id ||
    alignment?.handle ||
    alignment?.title ||
    null
  );
}

function buildPinnedAlignment(item = {}) {
  if (item.kind === "constellation" && item.handle) {
    return {
      id: item.sourceId || item.id,
      title: item.name || item.title,
      kind: "constellation",
      handle: item.handle,
      sourceId: item.sourceId || item.id,
      description: item.description || "",
      collectionLabel: item.collectionLabel || "Preset Configuration",
      colorHex: item.colorHex || "#d4a63e",
    };
  }

  return {
    id: item.id,
    title: item.name || item.title,
    kind: "pack",
    sourceId: item.sourceId || null,
    description: item.description || "",
    collectionLabel:
      item.collectionLabel || METACANON_TERMS.savedConstellations,
    lensHandles: item.lensHandles || [],
    lensTitles: item.lensTitles || [],
    colorHex: item.colorHex || "#d4a63e",
  };
}

function PinnedConstellationRow({
  item,
  index = 0,
  active = false,
  onToggle = () => {},
  onOpenChat = () => {},
  onRemove = () => {},
}) {
  const alignment = buildPinnedAlignment(item);
  const meta =
    item.kind === "constellation"
      ? "Preset Constellation"
      : "Custom Constellation";
  const description =
    item.description?.trim() ||
    alignment.description?.trim() ||
    (item.kind === "constellation"
      ? "Reusable preset constellation."
      : `${item.lensHandles?.length || 0} lenses routed through custom constellation orchestration.`);

  return (
    <Draggable draggableId={item.pinId} index={index}>
      {(provided, snapshot) => (
        <PrismHoverTarget targetId={`sidebar-constellation-${item.pinId}`}>
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            role="listitem"
            data-active={active ? "true" : "false"}
            className={`metacanon-lens-card metacanon-constellation-card px-[12px] py-[8px] text-left transition-all duration-200 ${
              snapshot.isDragging ? "opacity-70" : ""
            }`}
            style={{
              ...provided.draggableProps.style,
              "--lens-color": item.colorHex || "#d4a63e",
            }}
          >
            <button
              type="button"
              onClick={() => onToggle(alignment, active)}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="metacanon-lens-card__meta text-[10px] font-semibold uppercase tracking-[0.16em]">
                    {meta}
                  </div>
                  <div className="metacanon-lens-card__title mt-1 truncate text-[15px] leading-tight">
                    {alignment.title}
                  </div>
                  <div className="metacanon-constellation-card__body mt-0.5 line-clamp-1 text-[11px] leading-5 text-theme-text-secondary">
                    {description}
                  </div>
                </div>
                {active ? (
                  <div className="metacanon-lens-card__badge shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                    Aligned
                  </div>
                ) : null}
              </div>
            </button>
            <div className="prism-sidebar-card__actions mt-1.5">
              <div className="prism-sidebar-card__action-group">
                <div
                  {...provided.dragHandleProps}
                  aria-label={`Reorder ${alignment.title}`}
                  title="Drag to reorder"
                  className="prism-sidebar-chip cursor-grab select-none gap-1"
                >
                  <DotsSixVertical className="h-3.5 w-3.5" />
                  Reorder
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChat(alignment)}
                className="prism-sidebar-module__link"
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.pinId, alignment.title)}
                className="prism-sidebar-module__link"
              >
                Remove
              </button>
            </div>
          </div>
        </PrismHoverTarget>
      )}
    </Draggable>
  );
}

export default function SidebarPinnedConstellations() {
  const navigate = useNavigate();
  const activeAlignment = useMetacanonAlignment();
  const [pinnedConstellations, setPinnedConstellations] = useState(() =>
    loadPinnedConstellations()
  );

  useEffect(() => {
    function syncPinnedConstellations(event) {
      if (event?.type === "storage") {
        if (
          event.key &&
          event.key !== "metacanon-sidebar-pinned-constellations"
        )
          return;
        setPinnedConstellations(loadPinnedConstellations());
        return;
      }
      setPinnedConstellations(event?.detail ?? loadPinnedConstellations());
    }

    window.addEventListener(
      METACANON_PINNED_CONSTELLATIONS_EVENT,
      syncPinnedConstellations
    );
    window.addEventListener("storage", syncPinnedConstellations);
    return () => {
      window.removeEventListener(
        METACANON_PINNED_CONSTELLATIONS_EVENT,
        syncPinnedConstellations
      );
      window.removeEventListener("storage", syncPinnedConstellations);
    };
  }, []);

  const visibleConstellations = useMemo(
    () => pinnedConstellations,
    [pinnedConstellations]
  );

  function toggleAlignment(alignment, isActive) {
    if (isActive) {
      clearActiveMetacanonAlignment();
      showToast("Constellation alignment cleared.", "info");
      return;
    }

    const next = setActiveMetacanonAlignment(alignment);
    if (!next) {
      showToast("This constellation is not ready to align yet.", "warning");
      return;
    }

    showToast(
      `Prism aligned to ${next?.title}. Your next message will run this constellation.`,
      "success"
    );
  }

  function removePinned(pinId, title) {
    setPinnedConstellations(deletePinnedConstellation(pinId));
    showToast(
      `${title || "Constellation"} removed from the sidebar.`,
      "success"
    );
  }

  function onDragEnd(result) {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    setPinnedConstellations(
      reorderPinnedConstellations(result.source.index, result.destination.index)
    );
  }

  async function openAlignedChat(alignment) {
    const next = setActiveMetacanonAlignment(alignment);
    if (!next) {
      showToast("This constellation is not ready to align yet.", "warning");
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
            Sidebar {METACANON_TERMS.constellations}
          </div>
          {visibleConstellations.length > 1 ? (
            <div className="prism-sidebar-module__hint">Drag to reorder</div>
          ) : null}
        </div>
        <Link
          to={paths.metacanonAILibrary()}
          className="prism-sidebar-module__link"
        >
          Manage
        </Link>
      </div>
      {visibleConstellations.length > 0 ? (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="pinned-constellations">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                role="list"
                aria-label="Pinned constellations"
                className="flex flex-col gap-y-2"
              >
                {visibleConstellations.map((item, index) => {
                  const alignment = buildPinnedAlignment(item);
                  const active =
                    getAlignmentKey(activeAlignment) ===
                    getAlignmentKey(alignment);

                  return (
                    <PinnedConstellationRow
                      key={item.pinId}
                      item={item}
                      index={index}
                      active={active}
                      onToggle={toggleAlignment}
                      onOpenChat={openAlignedChat}
                      onRemove={removePinned}
                    />
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="prism-sidebar-empty">
          Pin preset or custom constellations from the library to keep them
          visible here.
        </div>
      )}
    </div>
  );
}
