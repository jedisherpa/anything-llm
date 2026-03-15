import React, { useEffect, useRef, useState } from "react";
import { List } from "@phosphor-icons/react/dist/csr/List";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";

import NewWorkspaceModal, {
  useNewWorkspaceModal,
} from "../Modals/NewWorkspace";
import ActiveWorkspaces from "./ActiveWorkspaces";
import useUser from "@/hooks/useUser";
import Footer from "../Footer";
import SettingsButton from "../SettingsButton";
import { useTranslation } from "react-i18next";
import { useSidebarToggle, ToggleSidebarButton } from "./SidebarToggle";
import SearchBox from "./SearchBox";
import { Tooltip } from "react-tooltip";
import { createPortal } from "react-dom";
import PrismPresence from "@/components/PrismPresence";
import { MetacanonSidebarBrand } from "@/components/Metacanon/Branding";
import SidebarFeaturedLenses from "./FeaturedLenses";

export default function Sidebar() {
  const { user } = useUser();
  const sidebarRef = useRef(null);
  const { showSidebar, setShowSidebar, canToggleSidebar } = useSidebarToggle();
  const {
    showing: showingNewWsModal,
    showModal: showNewWsModal,
    hideModal: hideNewWsModal,
  } = useNewWorkspaceModal();

  return (
    <>
      <div
        style={{
          width: showSidebar ? "344px" : "0px",
          paddingLeft: showSidebar ? "0px" : "16px",
        }}
        className="relative h-full transition-all duration-500"
      >
        {canToggleSidebar && (
          <ToggleSidebarButton
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
          />
        )}

        <div className="overflow-hidden h-full flex flex-col">
          <div
            ref={sidebarRef}
            className="metacanon-sidebar-panel relative m-[16px] flex-1 min-h-0 rounded-[18px] border border-theme-sidebar-border min-w-[304px] p-[14px]"
          >
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-grow flex flex-col min-w-[235px] min-h-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <MetacanonSidebarBrand />
                  <div className="hidden shrink-0 md:flex">
                    <PrismPresence
                      surface="sidebar"
                      size="xs"
                      label="Prism"
                      caption="Idle"
                      align="left"
                      showState={false}
                    />
                  </div>
                </div>
                <div className="relative flex-1 min-h-0 flex flex-col w-full pt-[4px]">
                  <div className="flex flex-col gap-y-[14px] overflow-y-scroll no-scroll pb-[86px]">
                    <SearchBox user={user} showNewWsModal={showNewWsModal} />
                    <div className="metacanon-sidebar-section-label px-2 text-[11px] font-semibold uppercase tracking-[0.26em]">
                      Workspaces
                    </div>
                    <ActiveWorkspaces />
                    <SidebarFeaturedLenses />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 pt-2 pb-1 rounded-b-[16px] border-t border-theme-sidebar-border bg-transparent bg-opacity-95 backdrop-filter backdrop-blur-md z-10">
                  <Footer />
                </div>
              </div>
            </div>
          </div>
        </div>
        {showingNewWsModal && <NewWorkspaceModal hideModal={hideNewWsModal} />}
      </div>
      <WorkspaceAndThreadTooltips />
    </>
  );
}

export function SidebarMobileHeader() {
  const sidebarRef = useRef(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showBgOverlay, setShowBgOverlay] = useState(false);
  const {
    showing: showingNewWsModal,
    showModal: showNewWsModal,
    hideModal: hideNewWsModal,
  } = useNewWorkspaceModal();
  const { user } = useUser();

  useEffect(() => {
    // Darkens the rest of the screen
    // when sidebar is open.
    function handleBg() {
      if (showSidebar) {
        setTimeout(() => {
          setShowBgOverlay(true);
        }, 300);
      } else {
        setShowBgOverlay(false);
      }
    }
    handleBg();
  }, [showSidebar]);

  return (
    <>
      <div
        aria-label="Show sidebar"
        className="fixed top-0 left-0 right-0 z-10 flex justify-between items-center px-4 py-2 bg-theme-bg-sidebar light:bg-white text-slate-200 shadow-lg h-16"
      >
        <button
          onClick={() => setShowSidebar(true)}
          className="rounded-md p-2 flex items-center justify-center text-theme-text-secondary"
        >
          <List className="h-6 w-6" />
        </button>
        <div className="flex items-center justify-center flex-grow">
          <MetacanonSidebarBrand />
        </div>
        <div className="w-12"></div>
      </div>
      <div
        style={{
          transform: showSidebar ? `translateX(0vw)` : `translateX(-100vw)`,
        }}
        className={`z-99 fixed top-0 left-0 transition-all duration-500 w-[100vw] h-[100vh]`}
      >
        <div
          className={`${
            showBgOverlay
              ? "transition-all opacity-1"
              : "transition-none opacity-0"
          }  duration-500 fixed top-0 left-0 bg-theme-bg-secondary bg-opacity-75 w-screen h-screen`}
          onClick={() => setShowSidebar(false)}
        />

        <div
          ref={sidebarRef}
          className="metacanon-sidebar-panel relative h-[100vh] fixed top-0 left-0 rounded-r-[26px] bg-theme-bg-sidebar w-[80%] p-[18px]"
        >
          <div className="w-full h-full flex flex-col overflow-x-hidden items-between">
            {/* Header Information */}
            <div className="flex w-full items-center justify-between gap-x-4">
              <div className="flex shrink-1 w-fit items-center justify-start">
                <MetacanonSidebarBrand />
              </div>
              {(!user || user?.role !== "default") && (
                <div className="flex gap-x-2 items-center text-slate-500 shink-0">
                  <PrismPresence
                    surface="sidebar-mobile"
                    size="sm"
                    label="Prism"
                  />

                  <SettingsButton />
                </div>
              )}
            </div>

            {/* Primary Body */}
            <div className="h-full flex flex-col w-full justify-between pt-4 ">
              <div className="h-auto md:sidebar-items">
                <div className=" flex flex-col gap-y-4 overflow-y-scroll no-scroll pb-[60px]">
                  <NewWorkspaceButton
                    user={user}
                    showNewWsModal={showNewWsModal}
                  />

                  <ActiveWorkspaces />
                  <SidebarFeaturedLenses />
                </div>
              </div>
              <div className="z-99 absolute bottom-0 left-0 right-0 pt-2 pb-6 rounded-br-[26px] bg-theme-bg-sidebar bg-opacity-80 backdrop-filter backdrop-blur-md">
                <Footer />
              </div>
            </div>
          </div>
        </div>
        {showingNewWsModal && <NewWorkspaceModal hideModal={hideNewWsModal} />}
      </div>
    </>
  );
}

function NewWorkspaceButton({ user, showNewWsModal }) {
  const { t } = useTranslation();
  if (!!user && user?.role === "default") return null;

  return (
    <div className="flex gap-x-2 items-center justify-between">
      <button
        onClick={showNewWsModal}
        className="flex flex-grow w-[75%] h-[44px] gap-x-2 py-[5px] px-4 bg-white rounded-lg text-sidebar justify-center items-center hover:bg-opacity-80 transition-all duration-300"
      >
        <Plus className="h-5 w-5" />
        <p className="text-sidebar text-sm font-semibold">
          {t("new-workspace.title")}
        </p>
      </button>
    </div>
  );
}

function WorkspaceAndThreadTooltips() {
  return createPortal(
    <React.Fragment>
      <Tooltip
        id="workspace-name"
        place="right"
        delayShow={800}
        className="tooltip !text-xs z-99"
      />

      <Tooltip
        id="workspace-thread-name"
        place="right"
        delayShow={800}
        className="tooltip !text-xs z-99"
      />
    </React.Fragment>,
    document.body
  );
}
