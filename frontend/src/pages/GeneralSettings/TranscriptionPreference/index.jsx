import React, { useEffect, useState, useRef } from "react";
import { isMobile } from "react-device-detect";
import Sidebar from "@/components/SettingsSidebar";
import System from "@/models/system";
import showToast from "@/utils/toast";
import PreLoader from "@/components/Preloader";
import OpenAiLogo from "@/media/llmprovider/openai.png";
import AnythingLLMIcon from "@/media/logo/anything-llm-icon.png";
import OpenAiWhisperOptions from "@/components/TranscriptionSelection/OpenAiOptions";
import NativeTranscriptionOptions from "@/components/TranscriptionSelection/NativeTranscriptionOptions";
import LLMItem from "@/components/LLMSelection/LLMItem";
import { CaretUpDown } from "@phosphor-icons/react/dist/csr/CaretUpDown";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { X } from "@phosphor-icons/react/dist/csr/X";

import CTAButton from "@/components/lib/CTAButton";
import { useTranslation } from "react-i18next";

const PROVIDERS = [
  {
    name: "OpenAI",
    value: "openai",
    logo: OpenAiLogo,
    options: (settings) => <OpenAiWhisperOptions settings={settings} />,
    description: "Leverage the OpenAI Whisper-large model using your API key.",
  },
  {
    name: "AnythingLLM Built-In",
    value: "local",
    logo: AnythingLLMIcon,
    options: (settings) => <NativeTranscriptionOptions settings={settings} />,
    description: "Run a built-in whisper model on this instance privately.",
  },
];

export default function TranscriptionModelPreference() {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = { WhisperProvider: selectedProvider };
    const formData = new FormData(form);

    for (var [key, value] of formData.entries()) data[key] = value;
    const { error } = await System.updateSystem(data);
    setSaving(true);

    if (error) {
      showToast(`Failed to save preferences: ${error}`, "error");
    } else {
      showToast("Transcription preferences saved successfully.", "success");
    }
    setSaving(false);
    setHasChanges(!!error);
  };

  const updateProviderChoice = (selection) => {
    setSearchQuery("");
    setSelectedProvider(selection);
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
      const _settings = await System.keys();
      setSettings(_settings);
      setSelectedProvider(_settings?.WhisperProvider || "local");
      setLoading(false);
    }
    fetchKeys();
  }, []);

  useEffect(() => {
    const filtered = PROVIDERS.filter((provider) =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProviders(filtered);
  }, [searchQuery, selectedProvider]);

  const selectedProviderObject = PROVIDERS.find(
    (provider) => provider.value === selectedProvider
  );

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
            <div className="prism-settings-content prism-settings-content--wide flex flex-col w-full px-1 md:pl-6 md:pr-[50px] py-16 md:py-6">
              <div className="prism-settings-page-header">
                <div className="prism-page-section-label">Transformation Agency</div>
                <p className="prism-settings-page-title">
                  {t("transcription.title")}
                </p>
                <p className="prism-settings-page-description">
                  {t("transcription.description")}
                </p>
              </div>
              <div className="prism-settings-savebar w-full">
                {hasChanges && (
                  <CTAButton className="mt-3 mr-0 z-10">
                    {saving ? "Saving..." : "Save changes"}
                  </CTAButton>
                )}
              </div>
              <div className="prism-settings-block-title">
                {t("transcription.provider")}
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
                          name="provider-search"
                          autoComplete="off"
                          placeholder="Search audio transcription providers"
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
                          className="prism-settings-provider-close cursor-pointer text-white hover:text-x-button"
                          onClick={handleXButton}
                        />
                      </div>
                      <div className="prism-settings-provider-list white-scrollbar">
                        {filteredProviders.map((provider) => (
                          <LLMItem
                            key={provider.name}
                            name={provider.name}
                            value={provider.value}
                            image={provider.logo}
                            description={provider.description}
                            checked={selectedProvider === provider.value}
                            onClick={() => updateProviderChoice(provider.value)}
                          />
                        ))}
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
                        src={selectedProviderObject.logo}
                        alt={`${selectedProviderObject.name} logo`}
                        className="w-10 h-10 rounded-md"
                      />

                      <div className="prism-settings-provider-meta">
                        <div className="prism-settings-provider-title">
                          {selectedProviderObject.name}
                        </div>
                        <div className="prism-settings-provider-description">
                          {selectedProviderObject.description}
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
                {selectedProvider &&
                  PROVIDERS.find(
                    (provider) => provider.value === selectedProvider
                  )?.options(settings)}
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
