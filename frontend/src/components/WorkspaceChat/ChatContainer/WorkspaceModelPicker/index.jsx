import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useUser from "@/hooks/useUser";
import { useModal } from "@/hooks/useModal";
import LLMSelectorModal from "../PromptInput/LLMSelector/index";
import SetupProvider from "../PromptInput/LLMSelector/SetupProvider";
import {
  SAVE_LLM_SELECTOR_EVENT,
  PROVIDER_SETUP_EVENT,
} from "../PromptInput/LLMSelector/action";
import Workspace from "@/models/workspace";
import System from "@/models/system";

function humanizeModelName(model = "") {
  if (!model) return "";

  let value = String(model).split("/").pop()?.trim() || "";
  value = value.replace(/-(?:non-)?reasoning\b/gi, "");
  value = value.replace(/\bgrok-4-l\b/gi, "grok-4");
  value = value.replace(/\bgrok-4-1\b/gi, "grok-4.1");
  value = value.replace(/[_-]+/g, " ").trim();

  const tokens = value.split(/\s+/).filter(Boolean);
  return tokens
    .map((token) => {
      if (/^\d+(?:\.\d+)?$/.test(token)) return token;
      if (/^grok$/i.test(token)) return "Grok";
      if (/^gpt$/i.test(token)) return "GPT";
      if (/^llama$/i.test(token)) return "Llama";
      if (/^gemini$/i.test(token)) return "Gemini";
      if (/^claude$/i.test(token)) return "Claude";
      if (/^fast$/i.test(token)) return "Fast";
      if (/^mini$/i.test(token)) return "Mini";
      return token.charAt(0).toUpperCase() + token.slice(1);
    })
    .join(" ");
}

function fetchModelName(slug, setModelName) {
  if (!slug) return;
  Promise.all([Workspace.bySlug(slug), System.keys()]).then(
    ([workspace, systemSettings]) => {
      const model = workspace.chatModel ?? systemSettings?.LLMModel ?? "";
      setModelName(model);
    }
  );
}

export default function WorkspaceModelPicker({
  workspaceSlug = null,
  compact = false,
  className = "",
}) {
  const { t } = useTranslation();
  const { slug: urlSlug } = useParams();
  const slug = urlSlug ?? workspaceSlug;
  const { user } = useUser();
  const [showSelector, setShowSelector] = useState(false);
  const [modelName, setModelName] = useState("");
  const {
    isOpen: isSetupProviderOpen,
    openModal: openSetupProviderModal,
    closeModal: closeSetupProviderModal,
  } = useModal();
  const [config, setConfig] = useState({ settings: {}, provider: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const displayName = humanizeModelName(modelName);
  // Fetch current model name for display
  useEffect(() => fetchModelName(slug, setModelName), [slug]);

  // Close selector and refresh model name when model is saved
  useEffect(() => {
    function handleSave() {
      setShowSelector(false);
      fetchModelName(slug, setModelName);
    }
    window.addEventListener(SAVE_LLM_SELECTOR_EVENT, handleSave);
    return () =>
      window.removeEventListener(SAVE_LLM_SELECTOR_EVENT, handleSave);
  }, [slug]);

  // Handle provider setup request
  useEffect(() => {
    function handleProviderSetup(e) {
      const { provider, settings } = e.detail;
      setConfig({ settings, provider });
      setTimeout(() => openSetupProviderModal(), 300);
    }
    window.addEventListener(PROVIDER_SETUP_EVENT, handleProviderSetup);
    return () =>
      window.removeEventListener(PROVIDER_SETUP_EVENT, handleProviderSetup);
  }, []);

  // This feature is disabled for multi-user instances where the user is not an admin
  if (!!user && user.role !== "admin") return null;
  if (!slug) return null;

  return (
    <>
      {showSelector && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowSelector(false)}
        />
      )}
      <div className={`relative hidden md:block shrink-0 z-30 ${className}`}>
        <button
          type="button"
          onClick={() => setShowSelector(!showSelector)}
          className={`metacanon-model-picker-button group flex cursor-pointer items-center rounded-full border-none transition-all ${
            compact
              ? "metacanon-model-picker-button--compact max-w-[148px] px-2.5 py-1.5"
              : "metacanon-composer-toolbar-button max-w-[260px] px-3 py-2"
          }`}
          data-open={showSelector ? "true" : "false"}
        >
          <span
            className={`metacanon-model-picker-button__text block truncate leading-none ${
              compact ? "text-[11px]" : "text-[13px]"
            }`}
          >
            {displayName || t("chat_window.select_model")}{" "}
            <span aria-hidden="true">▾</span>
          </span>
        </button>

        {showSelector && (
          <div className="metacanon-model-picker-panel absolute bottom-full left-0 mb-2 w-[620px] overflow-hidden rounded-[22px]">
            <LLMSelectorModal
              key={refreshKey}
              workspaceSlug={slug}
              initialProvider={config.provider?.value}
            />
          </div>
        )}
      </div>

      <SetupProvider
        isOpen={isSetupProviderOpen}
        closeModal={closeSetupProviderModal}
        postSubmit={() => {
          closeSetupProviderModal();
          setRefreshKey((k) => k + 1);
        }}
        settings={config.settings}
        llmProvider={config.provider}
      />
    </>
  );
}
