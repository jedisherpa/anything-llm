import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Sidebar from "@/components/SettingsSidebar";
import { isMobile } from "react-device-detect";
import System from "@/models/system";
import showToast from "@/utils/toast";
import AnythingLLMIcon from "@/media/logo/anything-llm-icon.png";
import PreLoader from "@/components/Preloader";
import LLMItem from "@/components/LLMSelection/LLMItem";
import { CaretUpDown } from "@phosphor-icons/react/dist/csr/CaretUpDown";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { X } from "@phosphor-icons/react/dist/csr/X";

import CTAButton from "@/components/lib/CTAButton";
import ProviderSlotsPanel from "@/components/Prism/ProviderSlotsPanel";
import ToolApiKeysModal from "@/components/Prism/ToolApiKeysModal";
import paths from "@/utils/paths";
import { Link } from "react-router-dom";
import Workspace from "@/models/workspace";
import {
  AVAILABLE_LLM_PROVIDERS,
  LLM_PREFERENCE_SAVED_EVENT,
  LLM_PREFERENCE_CHANGED_EVENT,
} from "@/constants/llmProviders";
import { PROVIDER_OPTIONS_COMPONENTS } from "@/components/LLMSelection/providerOptions";

function getGlobalLLMSelection(settings = null) {
  return {
    provider: settings?.LLMProvider ?? null,
    model: settings?.LLMModel ?? null,
  };
}

async function syncWorkspacesToGlobalSelection(
  previousSelection,
  nextSelection
) {
  if (
    !previousSelection?.provider ||
    !previousSelection?.model ||
    !nextSelection?.provider ||
    !nextSelection?.model
  ) {
    return 0;
  }

  const workspaces = await Workspace.all();
  const staleOverrides = workspaces.filter(
    (workspace) =>
      workspace.chatProvider === previousSelection.provider &&
      workspace.chatModel === previousSelection.model
  );

  if (staleOverrides.length === 0) return 0;

  await Promise.all(
    staleOverrides.map((workspace) =>
      Workspace.update(workspace.slug, {
        chatProvider: nextSelection.provider,
        chatModel: nextSelection.model,
      })
    )
  );

  return staleOverrides.length;
}

export default function GeneralLLMPreference() {
  const [saving, setSaving] = useState(false);
  const [savingProviderSlots, setSavingProviderSlots] = useState(false);
  const [savingToolCredentials, setSavingToolCredentials] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [providerSlots, setProviderSlots] = useState([]);
  const [toolCredentials, setToolCredentials] = useState([]);
  const [toolModalOpen, setToolModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredLLMs, setFilteredLLMs] = useState([]);
  const [selectedLLM, setSelectedLLM] = useState(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const form = e.target;
    const data = { LLMProvider: selectedLLM };
    const formData = new FormData(form);
    const previousSelection = getGlobalLLMSelection(settings);

    for (var [key, value] of formData.entries()) data[key] = value;
    const { error } = await System.updateSystem(data);

    if (error) {
      showToast(`Failed to save LLM settings: ${error}`, "error");
    } else {
      const refreshedSettings = await System.keys();
      const nextSelection = getGlobalLLMSelection(refreshedSettings);
      const syncedWorkspaces = await syncWorkspacesToGlobalSelection(
        previousSelection,
        nextSelection
      );

      setSettings(refreshedSettings);
      setSelectedLLM(nextSelection.provider);
      window.dispatchEvent(
        new CustomEvent(LLM_PREFERENCE_SAVED_EVENT, {
          detail: {
            previousSelection,
            nextSelection,
            syncedWorkspaces,
          },
        })
      );
      showToast("LLM preferences saved successfully.", "success");
    }
    setSaving(false);
    setHasChanges(!!error);
  };

  const updateLLMChoice = (selection) => {
    setSearchQuery("");
    setSelectedLLM(selection);
    setSearchMenuOpen(false);
    setHasChanges(true);
  };

  const handleXButton = () => {
    if (searchQuery.length > 0) {
      setSearchQuery("");
      if (searchInputRef.current) searchInputRef.current.value = "";
    } else {
      setSearchMenuOpen(!searchMenuOpen);
    }
  };

  useEffect(() => {
    async function fetchKeys() {
      const [_settings, providerSlotsPayload, toolCredentialsPayload] =
        await Promise.all([
          System.keys(),
          System.prismProviderSlots(),
          System.prismToolCredentials(),
        ]);
      setSettings(_settings);
      setSelectedLLM(_settings?.LLMProvider);
      setProviderSlots(providerSlotsPayload?.slots || []);
      setToolCredentials(toolCredentialsPayload?.credentials || []);
      setLoading(false);
    }
    fetchKeys();
  }, []);

  // Some more complex LLM options do not bubble up the change event, so we need to listen to the custom event
  // we can emit from the LLM options component using window.dispatchEvent(new Event(LLM_PREFERENCE_CHANGED_EVENT));
  useEffect(() => {
    function updateHasChanges() {
      setHasChanges(true);
    }
    window.addEventListener(LLM_PREFERENCE_CHANGED_EVENT, updateHasChanges);
    return () => {
      window.removeEventListener(
        LLM_PREFERENCE_CHANGED_EVENT,
        updateHasChanges
      );
    };
  }, []);

  useEffect(() => {
    const filtered = AVAILABLE_LLM_PROVIDERS.filter((llm) =>
      llm.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredLLMs(filtered);
  }, [searchQuery, selectedLLM]);

  const selectedLLMObject = AVAILABLE_LLM_PROVIDERS.find(
    (llm) => llm.value === selectedLLM
  );
  const SelectedOptionsComponent =
    selectedLLM && PROVIDER_OPTIONS_COMPONENTS[selectedLLM];

  const saveProviderSlots = async () => {
    setSavingProviderSlots(true);
    const { success, error, slots } =
      await System.updatePrismProviderSlots(providerSlots);

    if (!success) {
      showToast(
        `Failed to save Prism provider lanes: ${error || "Unknown error"}`,
        "error"
      );
      setSavingProviderSlots(false);
      return;
    }

    setProviderSlots(slots || []);
    setSavingProviderSlots(false);
    showToast("Prism provider lanes saved.", "success");
  };

  const saveToolCredentials = async () => {
    setSavingToolCredentials(true);
    const { success, error, credentials } =
      await System.updatePrismToolCredentials(toolCredentials);

    if (!success) {
      showToast(
        `Failed to save tool API keys: ${error || "Unknown error"}`,
        "error"
      );
      setSavingToolCredentials(false);
      return;
    }

    setToolCredentials(credentials || []);
    setSavingToolCredentials(false);
    setToolModalOpen(false);
    showToast("Tool API keys saved.", "success");
  };

  return (
    <div className="metacanon-page-shell prism-settings-route w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      <Sidebar />
      {loading ? (
        <div
          style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
          className="metacanon-page-frame prism-settings-route__frame relative md:mx-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
        >
          <div className="w-full h-full flex justify-center items-center">
            <PreLoader />
          </div>
        </div>
      ) : (
        <div
          style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
          className="metacanon-page-frame prism-settings-route__frame relative md:mx-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
        >
          <form onSubmit={handleSubmit} className="flex w-full">
            <div className="prism-settings-content prism-settings-content--wide flex flex-col w-full px-1 md:pl-6 md:pr-[50px] md:py-6 py-16">
              <div className="prism-settings-page-header">
                <div className="prism-page-section-label">
                  Transformation Agency
                </div>
                <p className="prism-settings-page-title">{t("llm.title")}</p>
                <p className="prism-settings-page-description">
                  {t("llm.description")}
                </p>
              </div>
              <div className="metacanon-setup-note mt-4 rounded-[10px] px-3 py-3">
                <div className="metacanon-setup-note__eyebrow text-[11px] font-semibold uppercase tracking-[0.2em]">
                  Connect And Test
                </div>
                <div className="metacanon-setup-note__title mt-1 text-sm font-semibold">
                  Fast path to your first live prompt
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    to={paths.home()}
                    className="metacanon-setup-note__link rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
                  >
                    Return Home To Test
                  </Link>
                </div>
              </div>
              <div className="prism-settings-savebar w-full">
                {hasChanges && (
                  <CTAButton className="mt-3 mr-0 z-10">
                    {saving ? "Saving..." : "Save changes"}
                  </CTAButton>
                )}
              </div>
              <div className="prism-settings-block-title">
                {t("llm.provider")}
              </div>
              <div className="prism-settings-provider-wrap relative">
                {searchMenuOpen && (
                  <div
                    className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-70 backdrop-blur-sm z-10"
                    onClick={() => setSearchMenuOpen(false)}
                  />
                )}

                {searchMenuOpen ? (
                  <div className="prism-settings-provider-menu cursor-pointer">
                    <div className="w-full flex flex-col gap-y-1">
                      <div className="prism-settings-provider-search">
                        <MagnifyingGlass
                          size={20}
                          weight="bold"
                          className="text-theme-text-primary"
                        />

                        <input
                          type="text"
                          name="llm-search"
                          autoComplete="off"
                          placeholder="Search all LLM providers"
                          className="prism-settings-provider-search-input text-sm outline-none text-theme-text-primary placeholder:text-theme-text-primary placeholder:font-medium"
                          onChange={(e) => setSearchQuery(e.target.value)}
                          ref={searchInputRef}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.preventDefault();
                          }}
                        />

                        <X
                          size={20}
                          weight="bold"
                          className="prism-settings-provider-close cursor-pointer hover:text-x-button"
                          onClick={handleXButton}
                        />
                      </div>
                      <div className="prism-settings-provider-list white-scrollbar">
                        {filteredLLMs.map((llm) => {
                          return (
                            <LLMItem
                              key={llm.name}
                              name={llm.name}
                              value={llm.value}
                              image={llm.logo}
                              description={llm.description}
                              checked={selectedLLM === llm.value}
                              onClick={() => updateLLMChoice(llm.value)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    className="prism-settings-provider-trigger"
                    type="button"
                    onClick={() => setSearchMenuOpen(true)}
                  >
                    <div className="prism-settings-provider-copy">
                      <img
                        src={selectedLLMObject?.logo || AnythingLLMIcon}
                        alt={`${selectedLLMObject?.name} logo`}
                        className="w-10 h-10 rounded-md"
                      />

                      <div className="prism-settings-provider-meta">
                        <div className="prism-settings-provider-title">
                          {selectedLLMObject?.name || "None selected"}
                        </div>
                        <div className="prism-settings-provider-description">
                          {selectedLLMObject?.description ||
                            "You need to select an LLM"}
                        </div>
                      </div>
                    </div>
                    <CaretUpDown
                      size={24}
                      weight="bold"
                      className="prism-settings-provider-caret"
                    />
                  </button>
                )}
              </div>
              <div
                onChange={() => setHasChanges(true)}
                className="prism-settings-provider-content mt-4 flex flex-col gap-y-1"
              >
                {SelectedOptionsComponent ? (
                  <SelectedOptionsComponent settings={settings} />
                ) : null}
              </div>
              <ProviderSlotsPanel
                slots={providerSlots}
                setSlots={setProviderSlots}
                onSave={saveProviderSlots}
                saving={savingProviderSlots}
                onOpenToolKeys={() => setToolModalOpen(true)}
              />
            </div>
          </form>
          <ToolApiKeysModal
            open={toolModalOpen}
            credentials={toolCredentials}
            setCredentials={setToolCredentials}
            onClose={() => setToolModalOpen(false)}
            onSave={saveToolCredentials}
            saving={savingToolCredentials}
          />
        </div>
      )}
    </div>
  );
}
