import React, { useState, useEffect } from "react";
import * as Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import Workspace from "@/models/workspace";
import ManageWorkspace, {
  useManageWorkspaceModal,
} from "../../Modals/ManageWorkspace";
import paths from "@/utils/paths";
import { useParams, useNavigate, useMatch } from "react-router-dom";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { UploadSimple } from "@phosphor-icons/react/dist/csr/UploadSimple";

import useUser from "@/hooks/useUser";
import ThreadContainer from "./ThreadContainer";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import showToast from "@/utils/toast";
import { LAST_VISITED_WORKSPACE } from "@/utils/constants";
import { safeJsonParse } from "@/utils/request";
import PrismHoverTarget from "@/components/PrismHoverTarget";

export default function ActiveWorkspaces() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWs, setSelectedWs] = useState(null);
  const { showing, showModal, hideModal } = useManageWorkspaceModal();
  const { user } = useUser();
  const isInWorkspaceSettings = !!useMatch("/workspace/:slug/settings/:tab");
  const isHomePage = !!useMatch("/");

  useEffect(() => {
    async function getWorkspaces() {
      const workspaces = await Workspace.all();
      setLoading(false);
      setWorkspaces(Workspace.orderWorkspaces(workspaces));
    }
    getWorkspaces();
  }, []);

  if (loading) {
    return (
      <Skeleton.default
        height={40}
        width="100%"
        count={5}
        baseColor="var(--theme-sidebar-item-default)"
        highlightColor="var(--theme-sidebar-item-hover)"
        enableAnimation={true}
        className="my-1"
      />
    );
  }

  /**
   * Reorders workspaces in the UI via localstorage on client side.
   * @param {number} startIndex - the index of the workspace to move
   * @param {number} endIndex - the index to move the workspace to
   */
  function reorderWorkspaces(startIndex, endIndex) {
    const reorderedWorkspaces = Array.from(workspaces);
    const [removed] = reorderedWorkspaces.splice(startIndex, 1);
    reorderedWorkspaces.splice(endIndex, 0, removed);
    setWorkspaces(reorderedWorkspaces);
    const success = Workspace.storeWorkspaceOrder(
      reorderedWorkspaces.map((w) => w.id)
    );
    if (!success) {
      showToast("Failed to reorder workspaces", "error");
      Workspace.all().then((workspaces) => setWorkspaces(workspaces));
    }
  }

  const onDragEnd = (result) => {
    if (!result.destination) return;
    reorderWorkspaces(result.source.index, result.destination.index);
  };

  // When on the home page, resolve which workspace should be virtually active
  const virtualActiveSlug = (() => {
    if (!isHomePage || workspaces.length === 0) return null;
    const lastVisited = safeJsonParse(
      localStorage.getItem(LAST_VISITED_WORKSPACE)
    );
    if (
      lastVisited?.slug &&
      workspaces.some((ws) => ws.slug === lastVisited.slug)
    )
      return lastVisited.slug;
    return workspaces[0]?.slug ?? null;
  })();

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="workspaces">
        {(provided) => (
          <div
            role="list"
            aria-label="Workspaces"
            className="flex flex-col gap-y-2"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {workspaces.map((workspace, index) => {
              const isVirtuallyActive = workspace.slug === virtualActiveSlug;
              const isActive = workspace.slug === slug || isVirtuallyActive;
              return (
                <Draggable
                  key={workspace.id}
                  draggableId={workspace.id.toString()}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`flex flex-col w-full group ${
                        snapshot.isDragging ? "opacity-50" : ""
                      }`}
                      role="listitem"
                    >
                      <div className="flex gap-x-2 items-center justify-between">
                        <PrismHoverTarget
                          targetId={`workspace-row-${workspace.id}`}
                        >
                          <a
                            href={
                              isActive
                                ? null
                                : paths.workspace.chat(workspace.slug)
                            }
                            data-tooltip-id="workspace-name"
                            data-tooltip-content={workspace.name}
                            aria-current={isActive ? "page" : ""}
                            className="metacanon-workspace-row flex w-full flex-grow items-center justify-start gap-x-2 rounded-[15px] py-[8px] pl-[10px] pr-[8px] text-theme-text-primary transition-all duration-200"
                            data-active={isActive ? "true" : "false"}
                          >
                            <div className="flex flex-row justify-between w-full items-center">
                              <div
                                {...provided.dragHandleProps}
                                className="mr-[6px] flex h-5 w-5 cursor-grab items-center justify-center"
                              >
                                <span className="metacanon-workspace-dot h-[9px] w-[9px] rounded-full" />
                              </div>
                              <div className="flex items-center space-x-2 overflow-hidden flex-grow">
                                <div className="w-[174px] overflow-hidden">
                                  <p
                                    className={`w-full truncate whitespace-nowrap overflow-hidden text-[14px] leading-loose ${
                                      isActive
                                        ? "font-semibold text-theme-text-primary"
                                        : "font-medium text-theme-text-primary"
                                    }`}
                                  >
                                    {workspace.name}
                                  </p>
                                </div>
                              </div>
                              {user?.role !== "default" && (
                                <div
                                  className={`flex items-center gap-x-[2px] transition-opacity duration-200 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setSelectedWs(workspace);
                                      showModal();
                                    }}
                                    className="metacanon-sidebar-icon-button group/upload ml-auto flex items-center justify-center rounded-md border-none p-[2px]"
                                  >
                                    <UploadSimple className="h-[18px] w-[18px]" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      navigate(
                                        isInWorkspaceSettings
                                          ? paths.workspace.chat(workspace.slug)
                                          : paths.workspace.settings.generalAppearance(
                                              workspace.slug
                                            )
                                      );
                                    }}
                                    className="metacanon-sidebar-icon-button group/gear ml-auto flex items-center justify-center rounded-md p-[2px]"
                                    aria-label="General appearance settings"
                                  >
                                    <GearSix
                                      color={
                                        isInWorkspaceSettings &&
                                        workspace.slug === slug
                                          ? "#46C8FF"
                                          : undefined
                                      }
                                      className="h-[18px] w-[18px]"
                                    />
                                  </button>
                                </div>
                              )}
                            </div>
                          </a>
                        </PrismHoverTarget>
                      </div>
                      {isActive && (
                        <ThreadContainer
                          workspace={workspace}
                          isActive={isActive}
                          isVirtualThread={isVirtuallyActive}
                        />
                      )}
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
            {showing && (
              <ManageWorkspace
                hideModal={hideModal}
                providedSlug={selectedWs ? selectedWs.slug : null}
              />
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
