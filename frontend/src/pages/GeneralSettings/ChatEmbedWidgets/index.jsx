import { useState } from "react";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";

import EmbedConfigsView from "./EmbedConfigs";
import EmbedChatsView from "./EmbedChats";

export default function ChatEmbedWidgets() {
  const [selectedView, setSelectedView] = useState("configs");
  const [showViewModal, setShowViewModal] = useState(false);

  if (isMobile) {
    return (
      <WidgetLayout>
        <div className="flex flex-col w-full p-4 mt-10">
          <div
            hidden={showViewModal}
            className="flex flex-col gap-y-[18px] overflow-y-scroll no-scroll"
          >
            <div className="text-theme-text-primary flex items-center gap-x-2">
              <p className="text-lg font-medium">Chat Embed</p>
            </div>
            <WidgetList
              selectedView={selectedView}
              handleClick={(view) => {
                setSelectedView(view);
                setShowViewModal(true);
              }}
            />
          </div>
          {showViewModal && (
            <div className="fixed top-0 left-0 w-full h-full bg-sidebar z-30">
              <div className="flex flex-col h-full">
                <div className="flex items-center p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowViewModal(false);
                      setSelectedView("");
                    }}
                    className="text-white/60 hover:text-white transition-colors duration-200"
                  >
                    <div className="flex items-center text-sky-400">
                      <CaretLeft size={24} />
                      <div>Back</div>
                    </div>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="bg-theme-bg-secondary text-white rounded-xl p-4 overflow-y-scroll no-scroll">
                    {selectedView === "configs" ? (
                      <EmbedConfigsView />
                    ) : (
                      <EmbedChatsView />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </WidgetLayout>
    );
  }

  return (
    <WidgetLayout>
      <div className="prism-settings-widget-layout flex-1 flex gap-x-6 p-4 mt-10">
        <div className="flex flex-col min-w-[360px] h-[calc(100vh-90px)]">
          <div className="flex-none mb-4">
            <div className="prism-settings-page-header !border-b-0 !pb-0 !mb-0 text-theme-text-primary flex items-center gap-x-2">
              <div className="prism-page-section-label">Transformation Agency</div>
              <p className="prism-settings-page-title !text-[1.7rem]">Chat Embed</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 pb-4">
            <div className="space-y-4">
              <WidgetList
                selectedView={selectedView}
                handleClick={setSelectedView}
              />
            </div>
          </div>
        </div>
        <div className="flex-[2] flex flex-col gap-y-[18px] mt-10">
          <div className="prism-page-panel prism-settings-widget-panel text-white flex-1 p-4 overflow-y-scroll no-scroll">
            {selectedView === "configs" ? (
              <EmbedConfigsView />
            ) : (
              <EmbedChatsView />
            )}
          </div>
        </div>
      </div>
    </WidgetLayout>
  );
}

function WidgetLayout({ children }) {
  return (
    <div
      id="workspace-widget-settings-container"
      className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex md:mt-0 mt-6"
    >
      <Sidebar />
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame prism-settings-route__frame prism-settings-route relative md:mx-[16px] md:my-[16px] md:rounded-[16px] w-full h-full flex"
      >
        {children}
      </div>
    </div>
  );
}

function WidgetList({ selectedView, handleClick }) {
  const views = {
    configs: {
      title: "Widgets",
    },
    chats: {
      title: "History",
    },
  };

  return (
    <div
      className={`prism-settings-widget-nav text-white ${isMobile ? "w-full" : "min-w-[360px] w-fit"}`}
    >
      {Object.entries(views).map(([view, settings], index) => (
        <div
          key={view}
          className={`prism-settings-widget-item py-3 px-4 flex items-center justify-between ${
            index === 0 ? "rounded-t-xl" : ""
          } ${
            index === Object.keys(views).length - 1
              ? "rounded-b-xl"
              : "border-b border-white/10"
          } cursor-pointer transition-all duration-300 ${
            selectedView === view ? "prism-settings-widget-item--active" : ""
          }`}
          onClick={() => handleClick?.(view)}
        >
          <div className="text-sm font-light">{settings.title}</div>
          <CaretRight
            size={14}
            weight="bold"
            className="text-theme-text-secondary"
          />
        </div>
      ))}
    </div>
  );
}
