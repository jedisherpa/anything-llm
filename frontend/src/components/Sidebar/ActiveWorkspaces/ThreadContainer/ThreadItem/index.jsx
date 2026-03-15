import useScrollActiveItemIntoView from "@/hooks/useScrollActiveItemIntoView";
import Workspace from "@/models/workspace";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/csr/ArrowCounterClockwise";
import { DotsThree } from "@phosphor-icons/react/dist/csr/DotsThree";
import { PencilSimple } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { X } from "@phosphor-icons/react/dist/csr/X";

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import PrismHoverTarget from "@/components/PrismHoverTarget";

const THREAD_CALLOUT_DETAIL_WIDTH = 26;
export default function ThreadItem({
  idx,
  activeIdx,
  isActive,
  workspace,
  thread,
  onRemove,
  toggleMarkForDeletion,
  hasNext,
  ctrlPressed = false,
}) {
  const { slug: urlSlug, threadSlug = null } = useParams();
  const workspaceSlug = workspace?.slug ?? urlSlug;
  const optionsContainer = useRef(null);
  const [showOptions, setShowOptions] = useState(false);
  const linkTo = thread.virtual
    ? "/"
    : !thread.slug
      ? paths.workspace.chat(workspaceSlug)
      : paths.workspace.thread(workspaceSlug, thread.slug);

  const { ref } = useScrollActiveItemIntoView({
    isActive,
    behavior: "instant",
    block: "center",
  });
  return (
    <div
      className="w-full relative flex h-[36px] items-center border-none rounded-[12px]"
      role="listitem"
    >
      {/* Curved line Element and leader if required */}
      <div
        style={{ width: THREAD_CALLOUT_DETAIL_WIDTH / 2 }}
        className="metacanon-thread-rail absolute top-0 left-3 z-[1] h-[50%] rounded-bl-lg border-l border-b"
        data-active={isActive ? "true" : "false"}
      ></div>
      {/* Downstroke border for next item */}
      {hasNext && (
        <div
          style={{ width: THREAD_CALLOUT_DETAIL_WIDTH / 2 }}
          className="metacanon-thread-rail absolute top-0 left-3 z-[1] h-[100%] border-l"
          data-active={idx <= activeIdx && !isActive ? "true" : "false"}
        ></div>
      )}

      {/* Curved line inline placeholder for spacing - not visible */}
      <div
        style={{ width: THREAD_CALLOUT_DETAIL_WIDTH + 8 }}
        className="h-full"
      />

      <PrismHoverTarget
        targetId={`thread-row-${thread.id ?? thread.slug ?? idx}`}
      >
        <div
          className="metacanon-thread-row group relative flex w-full items-center justify-between rounded-[10px] pr-2"
          data-active={isActive ? "true" : "false"}
        >
          {thread.deleted ? (
            <div className="w-full flex justify-between">
              <div className="w-full pl-2 py-1">
                <p className="text-left text-sm text-theme-text-secondary italic">
                  deleted thread
                </p>
              </div>
              {ctrlPressed && (
                <button
                  type="button"
                  className="border-none"
                  onClick={() => toggleMarkForDeletion(thread.id)}
                >
                  <ArrowCounterClockwise
                    className="text-theme-text-secondary hover:text-theme-text-primary"
                    size={18}
                  />
                </button>
              )}
            </div>
          ) : (
            <a
              ref={ref}
              href={
                window.location.pathname === linkTo || ctrlPressed
                  ? "#"
                  : linkTo
              }
              data-tooltip-id="workspace-thread-name"
              data-tooltip-content={thread.name}
              className="w-full pl-2 py-1 overflow-hidden"
              aria-current={isActive ? "page" : ""}
            >
              <p
                className={`text-left text-sm truncate max-w-[150px] ${
                  isActive
                    ? "font-medium text-[var(--thread-active)]"
                    : "font-medium text-theme-text-secondary"
                }`}
              >
                {thread.name}
              </p>
            </a>
          )}

          {!!thread.slug && !thread.deleted && !thread.virtual && (
            <div ref={optionsContainer} className="flex items-center">
              {ctrlPressed ? (
                <button
                  type="button"
                  className="border-none"
                  onClick={() => toggleMarkForDeletion(thread.id)}
                >
                  <X
                    className="text-theme-text-secondary hover:text-theme-text-primary"
                    weight="bold"
                    size={18}
                  />
                </button>
              ) : (
                <div className="flex items-center w-fit group-hover:visible md:invisible gap-x-1">
                  <button
                    type="button"
                    className="border-none"
                    onClick={() => setShowOptions(!showOptions)}
                    aria-label="Thread options"
                  >
                    <DotsThree
                      className="text-theme-text-secondary hover:text-theme-text-primary"
                      size={25}
                    />
                  </button>
                </div>
              )}

              {showOptions && (
                <OptionsMenu
                  containerRef={optionsContainer}
                  workspace={workspace}
                  thread={thread}
                  onRemove={onRemove}
                  close={() => setShowOptions(false)}
                  currentThreadSlug={threadSlug}
                />
              )}
            </div>
          )}
        </div>
      </PrismHoverTarget>
    </div>
  );
}

function OptionsMenu({
  containerRef,
  workspace,
  thread,
  onRemove,
  close,
  currentThreadSlug,
}) {
  const menuRef = useRef(null);

  // Ref menu options
  const outsideClick = (e) => {
    if (!menuRef.current) return false;
    if (
      !menuRef.current?.contains(e.target) &&
      !containerRef.current?.contains(e.target)
    )
      close();
    return false;
  };

  const isEsc = (e) => {
    if (e.key === "Escape" || e.key === "Esc") close();
  };

  function cleanupListeners() {
    window.removeEventListener("click", outsideClick);
    window.removeEventListener("keyup", isEsc);
  }
  // end Ref menu options

  useEffect(() => {
    function setListeners() {
      if (!menuRef?.current || !containerRef.current) return false;
      window.document.addEventListener("click", outsideClick);
      window.document.addEventListener("keyup", isEsc);
    }

    setListeners();
    return cleanupListeners;
  }, [menuRef.current, containerRef.current]);

  const renameThread = async () => {
    const name = window
      .prompt("What would you like to rename this thread to?")
      ?.trim();
    if (!name || name.length === 0) {
      close();
      return;
    }

    const { message } = await Workspace.threads.update(
      workspace.slug,
      thread.slug,
      { name }
    );
    if (!!message) {
      showToast(`Thread could not be updated! ${message}`, "error", {
        clear: true,
      });
      close();
      return;
    }

    thread.name = name;
    close();
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this thread? All of its chats will be deleted. You cannot undo this."
      )
    )
      return;
    const success = await Workspace.threads.delete(workspace.slug, thread.slug);
    if (!success) {
      showToast("Thread could not be deleted!", "error", { clear: true });
      return;
    }
    if (success) {
      showToast("Thread deleted successfully!", "success", { clear: true });
      onRemove(thread.id);
      // Redirect if deleting the active thread
      if (currentThreadSlug === thread.slug) {
        window.location.href = paths.workspace.chat(workspace.slug);
      }
      return;
    }
  };

  return (
    <div
      ref={menuRef}
      className="metacanon-thread-options-menu absolute top-[25px] right-[10px] z-[20] w-fit rounded-lg p-1"
    >
      <button
        onClick={renameThread}
        type="button"
        className="flex w-full items-center gap-x-2 rounded-md p-2 text-theme-text-primary hover:bg-theme-action-menu-item-hover"
      >
        <PencilSimple size={18} />
        <p className="text-sm">Rename</p>
      </button>
      <button
        onClick={handleDelete}
        type="button"
        className="flex w-full items-center gap-x-2 rounded-md p-2 text-theme-text-primary hover:bg-red-500/20 hover:text-red-100"
      >
        <Trash size={18} />
        <p className="text-sm">Delete Thread</p>
      </button>
    </div>
  );
}
