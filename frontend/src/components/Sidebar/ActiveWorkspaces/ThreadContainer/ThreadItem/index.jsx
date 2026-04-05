import useScrollActiveItemIntoView from "@/hooks/useScrollActiveItemIntoView";
import ModalWrapper from "@/components/ModalWrapper";
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

const THREAD_CALLOUT_DETAIL_WIDTH = 20;
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
      className="w-full relative flex h-[28px] items-center border-none rounded-[12px]"
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
                className={`text-left text-[11px] truncate max-w-[150px] ${
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
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [threadName, setThreadName] = useState(thread.name ?? "");
  const [renaming, setRenaming] = useState(false);

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
  }, [containerRef, close]);

  useEffect(() => {
    if (showRenameModal) {
      setThreadName(thread.name ?? "");
    }
  }, [showRenameModal, thread.name]);

  const renameThread = async (event) => {
    event?.preventDefault?.();
    const name = threadName.trim();
    if (!name || name.length === 0) {
      return;
    }

    setRenaming(true);
    const { thread: updatedThread, message } = await Workspace.threads.update(
      workspace.slug,
      thread.slug,
      { name }
    );
    setRenaming(false);
    if (!!message) {
      showToast(`Thread could not be updated! ${message}`, "error", {
        clear: true,
      });
      return;
    }

    window.dispatchEvent(
      new CustomEvent("renameThread", {
        detail: {
          threadSlug: thread.slug,
          newName: updatedThread?.name ?? name,
        },
      })
    );
    setShowRenameModal(false);
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

  function openRenameModal() {
    close();
    setThreadName(thread.name ?? "");
    setShowRenameModal(true);
  }

  return (
    <>
      <div
        ref={menuRef}
        className="metacanon-thread-options-menu absolute top-[25px] right-[10px] z-[20] w-fit rounded-lg p-1"
      >
        <button
          onClick={openRenameModal}
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
      <RenameThreadModal
        isOpen={showRenameModal}
        name={threadName}
        renaming={renaming}
        onChange={setThreadName}
        onClose={() => setShowRenameModal(false)}
        onSubmit={renameThread}
      />
    </>
  );
}

function RenameThreadModal({
  isOpen,
  name,
  renaming = false,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <ModalWrapper isOpen={isOpen}>
      <div className="metacanon-modal-panel w-full max-w-lg overflow-hidden rounded-lg border-2 border-theme-modal-border bg-theme-bg-secondary shadow">
        <div className="relative border-b border-theme-modal-border p-6">
          <div className="w-full flex items-center gap-x-2">
            <h3 className="overflow-hidden overflow-ellipsis whitespace-nowrap text-xl font-semibold text-white">
              Rename Thread
            </h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 inline-flex items-center rounded-lg border border-transparent bg-transparent p-1 text-sm transition-all duration-300 hover:border-theme-modal-border hover:border-opacity-50 hover:bg-theme-modal-border"
          >
            <X size={24} weight="bold" className="text-white" />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="flex flex-col gap-y-4 px-9 py-7">
            <div>
              <label
                htmlFor="thread-name"
                className="mb-2 block text-sm font-medium text-white"
              >
                Thread Name
              </label>
              <input
                id="thread-name"
                type="text"
                value={name}
                onChange={(event) => onChange(event.target.value)}
                required={true}
                autoFocus={true}
                className="block w-full rounded-lg border-none bg-theme-settings-input-bg p-2.5 text-sm text-white outline-none focus:outline-primary-button active:outline-primary-button placeholder:text-theme-settings-input-placeholder"
              />
            </div>
          </div>
          <div className="flex w-full items-center justify-end space-x-2 rounded-b border-t border-theme-modal-border p-6">
            <button
              onClick={onClose}
              type="button"
              className="border-none rounded-lg bg-transparent px-4 py-2 text-sm text-white transition-all duration-300 hover:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={renaming}
              className="rounded-lg bg-white px-4 py-2 text-sm text-black transition-all duration-300 hover:opacity-60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {renaming ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  );
}
