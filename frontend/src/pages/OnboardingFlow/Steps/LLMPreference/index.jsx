import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { useEffect, useState, useRef } from "react";
import LLMItem from "@/components/LLMSelection/LLMItem";
import { PROVIDER_OPTIONS_COMPONENTS } from "@/components/LLMSelection/providerOptions";
import System from "@/models/system";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AVAILABLE_LLM_PROVIDERS } from "@/constants/llmProviders";

const LLMS = AVAILABLE_LLM_PROVIDERS;

export default function LLMPreference({
  setHeader,
  setForwardBtn,
  setBackBtn,
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredLLMs, setFilteredLLMs] = useState([]);
  const [selectedLLM, setSelectedLLM] = useState(null);
  const [settings, setSettings] = useState(null);
  const formRef = useRef(null);
  const hiddenSubmitButtonRef = useRef(null);
  const isHosted = window.location.hostname.includes("useanything.com");
  const navigate = useNavigate();

  const TITLE = t("onboarding.llm.title");
  const DESCRIPTION = t("onboarding.llm.description");
  const SelectedOptionsComponent =
    selectedLLM && PROVIDER_OPTIONS_COMPONENTS[selectedLLM];

  useEffect(() => {
    async function fetchKeys() {
      const _settings = await System.keys();
      setSettings(_settings);
      setSelectedLLM(_settings?.LLMProvider || "openai");
    }
    fetchKeys();
  }, []);

  async function handleForward() {
    try {
      await System.markOnboardingComplete();
      console.log("Onboarding complete");
    } catch (error) {
      console.error("Onboarding complete failed", error);
    } finally {
      if (hiddenSubmitButtonRef.current) {
        hiddenSubmitButtonRef.current.click();
      }
    }
  }

  function handleBack() {
    navigate(paths.onboarding.home());
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    const formData = new FormData(form);
    data.LLMProvider = selectedLLM;
    // Default to AnythingLLM embedder and LanceDB
    data.EmbeddingEngine = "native";
    data.VectorDB = "lancedb";
    for (var [key, value] of formData.entries()) data[key] = value;

    const { error } = await System.updateSystem(data);
    if (error) {
      showToast(`Failed to save LLM settings: ${error}`, "error");
      return;
    }
    navigate(paths.onboarding.userSetup());
  };

  useEffect(() => {
    setHeader({ title: TITLE, description: DESCRIPTION });
    setForwardBtn({ showing: true, disabled: false, onClick: handleForward });
    setBackBtn({ showing: true, disabled: false, onClick: handleBack });
  }, []);

  useEffect(() => {
    const filtered = LLMS.filter((llm) =>
      llm.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredLLMs(filtered);
  }, [searchQuery, selectedLLM]);

  return (
    <div>
      <form ref={formRef} onSubmit={handleSubmit} className="w-full">
        <div className="w-full relative border-theme-chat-input-border shadow border-2 rounded-lg text-white">
          <div className="w-full p-4 absolute top-0 rounded-t-lg backdrop-blur-sm">
            <div className="w-full flex items-center sticky top-0">
              <MagnifyingGlass
                size={16}
                weight="bold"
                className="absolute left-4 z-30 text-theme-text-primary"
              />

              <input
                type="text"
                placeholder="Search LLM providers"
                className="bg-theme-bg-secondary placeholder:text-theme-text-secondary z-20 pl-10 h-[38px] rounded-full w-full px-4 py-1 text-sm border border-theme-chat-input-border outline-none focus:outline-primary-button active:outline-primary-button outline-none text-theme-text-primary"
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
              />
            </div>
          </div>
          <div className="px-4 pt-[70px] flex flex-col gap-y-1 max-h-[390px] overflow-y-auto no-scroll pb-4">
            {filteredLLMs.map((llm) => {
              if (llm.value === "native" && isHosted) return null;
              return (
                <LLMItem
                  key={llm.name}
                  name={llm.name}
                  value={llm.value}
                  image={llm.logo}
                  description={llm.description}
                  checked={selectedLLM === llm.value}
                  onClick={() => setSelectedLLM(llm.value)}
                />
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-y-1">
          {SelectedOptionsComponent ? (
            <SelectedOptionsComponent settings={settings} />
          ) : null}
        </div>
        <button
          type="submit"
          ref={hiddenSubmitButtonRef}
          hidden
          aria-hidden="true"
        ></button>
      </form>
    </div>
  );
}
