import React, { useEffect, useState, useRef } from "react";
import System from "@/models/system";
import showToast from "@/utils/toast";
import LLMItem from "@/components/LLMSelection/LLMItem";
import { CaretUpDown } from "@phosphor-icons/react/dist/csr/CaretUpDown";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { X } from "@phosphor-icons/react/dist/csr/X";

import CTAButton from "@/components/lib/CTAButton";
import AnythingLLMIcon from "@/media/logo/anything-llm-icon.png";
import BrowserNative from "@/components/SpeechToText/BrowserNative";

const PROVIDERS = [
  {
    name: "System native",
    value: "native",
    logo: AnythingLLMIcon,
    options: (settings) => <BrowserNative settings={settings} />,
    description: "Uses your browser's built in STT service if supported.",
  },
  {
    name: "AnythingLLM Whisper",
    value: "whisper",
    logo: AnythingLLMIcon,
    options: (settings) => <WhisperTranscription settings={settings} />,
    description:
      "Records audio in chat and transcribes it through the configured Whisper provider.",
  },
];

export default function SpeechToTextProvider({ settings }) {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(
    settings?.SpeechToTextProvider || "whisper"
  );
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const searchInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = { SpeechToTextProvider: selectedProvider };
    const formData = new FormData(form);

    for (var [key, value] of formData.entries()) data[key] = value;
    const { error } = await System.updateSystem(data);
    setSaving(true);

    if (error) {
      showToast(`Failed to save preferences: ${error}`, "error");
    } else {
      showToast("Speech-to-text preferences saved successfully.", "success");
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
    const filtered = PROVIDERS.filter((provider) =>
      provider.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProviders(filtered);
  }, [searchQuery, selectedProvider]);

  const selectedProviderObject = PROVIDERS.find(
    (provider) => provider.value === selectedProvider
  );

  return (
    <form onSubmit={handleSubmit} className="flex w-full">
      <div className="prism-settings-content prism-settings-content--wide flex flex-col w-full px-1 md:pl-6 md:pr-[50px] md:py-6 py-16">
        <div className="prism-settings-page-header">
          <div className="prism-page-section-label">Transformation Agency</div>
          <div className="flex gap-x-4 items-center">
            <p className="prism-settings-page-title">
              Speech-to-text Preference
            </p>
          </div>
          <p className="prism-settings-page-description">
            Here you can specify what kind of text-to-speech and speech-to-text
            providers you would want to use in your AnythingLLM experience. By
            default, we use the browser's built in support for these services,
            but you may want to use others.
          </p>
        </div>
        <div className="prism-settings-savebar w-full">
          {hasChanges && (
            <CTAButton className="mt-3 mr-0 z-10">
              {saving ? "Saving..." : "Save changes"}
            </CTAButton>
          )}
        </div>
        <div className="prism-settings-block-title">Provider</div>
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
                    name="stt-provider-search"
                    autoComplete="off"
                    placeholder="Search speech to text providers"
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
  );
}

function WhisperTranscription({ settings }) {
  return (
    <div className="w-full flex flex-col gap-y-1">
      <p className="prism-settings-field-copy mt-0 text-sm">
        Uses the existing Whisper transcription stack configured under
        transcription preferences.
      </p>
      <p className="prism-settings-field-copy mt-0 text-xs leading-[18px]">
        Current Whisper provider:{" "}
        <span className="font-semibold text-theme-text-primary">
          {settings?.WhisperProvider || "local"}
        </span>
      </p>
    </div>
  );
}
