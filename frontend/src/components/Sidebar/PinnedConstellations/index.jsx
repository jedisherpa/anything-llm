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
import { cleanPillName, METACANON_TERMS } from "@/utils/metacanonTerminology";
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

function PinnedConstellationPill({
  item,
  index = 0,
  active = false,
  onToggle = () => {},
  onOpenChat = () => {},
  onRemove = () => {},
}) {
  const alignment = buildPinnedAlignment(item);
  const title = cleanPillName(alignment.title);

  return (
    <Draggable draggableId={item.pinId} index={index}>
      {(provided, snapshot) => (
        <PrismHoverTarget targetId={`sidebar-constellation-${item.pinId}`}>
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            role="listitem"
            data-active={active ? "true" : "false"}
            className={`prism-sidebar-pill group ${snapshot.isDragging ? "opacity-70" : ""}`}
            style={{
              ...provided.draggableProps.style,
              "--lens-color": item.colorHex || "#d4a63e",
            }}
          >
            <button
              type="button"
              onClick={() => onToggle(alignment, active)}
              className="prism-sidebar-pill__label"
            >
              <span
                className="prism-sidebar-pill__drag"
                aria-label={`Reorder ${title}`}
                title="Drag to reorder"
              >
                <DotsSixVertical className="h-3 w-3" />
              </span>
              {title}
              {active && (
                <span className="prism-sidebar-pill__badge">Aligned</span>
              )}
            </button>
            <div className="prism-sidebar-pill__actions">
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
            Shapes (Teams)
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
                    <PinnedConstellationPill
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
      ) : null}
    </div>
  );
}
