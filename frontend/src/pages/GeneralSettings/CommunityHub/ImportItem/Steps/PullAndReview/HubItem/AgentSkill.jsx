import CTAButton from "@/components/lib/CTAButton";
import CommunityHubImportItemSteps from "../..";
import showToast from "@/utils/toast";
import paths from "@/utils/paths";
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CircleNotch } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { Warning } from "@phosphor-icons/react/dist/csr/Warning";

import { useEffect, useState } from "react";
import renderMarkdown from "@/utils/chat/markdown";
import DOMPurify from "dompurify";
import CommunityHub from "@/models/communityHub";
import { setEventDelegatorForCodeSnippets } from "@/components/WorkspaceChat";

export default function AgentSkill({ item, settings, setStep }) {
  const [loading, setLoading] = useState(false);
  async function importAgentSkill() {
    try {
      setLoading(true);
      const { error } = await CommunityHub.importBundleItem(settings.itemId);
      if (error) throw new Error(error);
      showToast(`Agent skill imported successfully!`, "success");
      setStep(CommunityHubImportItemSteps.completed.key);
    } catch (e) {
      console.error(e);
      showToast(`Failed to import agent skill. ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setEventDelegatorForCodeSnippets();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div className="prism-community-import-callout prism-community-import-callout--warning">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Warning size={25} />
            <h1 className="text-lg font-semibold text-theme-text-primary">
              Only import agent skills you trust
            </h1>
          </div>
          <p className="text-sm leading-7 text-theme-text-secondary">
            Agent skills can execute code on your AnythingLLM instance, so only
            import agent skills from sources you trust. You should also review
            the code before importing. If you are unsure about what a skill does
            - don't import it!
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-theme-text-primary">
          Review Agent Skill "{item.name}"
        </h2>
        {item.creatorUsername && (
          <p className="text-xs font-mono text-theme-text-secondary">
            Created by{" "}
            <a
              href={paths.communityHub.profile(item.creatorUsername)}
              target="_blank"
              className="font-semibold text-theme-primary-button transition-colors duration-200 hover:text-theme-text-primary hover:underline"
              rel="noreferrer"
            >
              @{item.creatorUsername}
            </a>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {item.verified ? (
            <p className="text-xs font-mono text-green-500">Verified code</p>
          ) : (
            <p className="text-xs font-mono text-red-500">
              This skill is not verified.
            </p>
          )}

          <a
            href="https://docs.anythingllm.com/community-hub/faq#verification"
            target="_blank"
            className="text-xs font-mono text-theme-primary-button transition-colors duration-200 hover:text-theme-text-primary hover:underline"
            rel="noreferrer"
          >
            Learn more &rarr;
          </a>
        </div>
      </div>

      <div className="prism-community-import-summary text-sm leading-7 text-theme-text-secondary">
        <p>
          Agent skills unlock new capabilities for your AnythingLLM workspace
          via{" "}
          <code className="rounded-md bg-theme-settings-input-bg px-2 py-1 font-mono text-theme-text-primary">
            @agent
          </code>{" "}
          skills that can do specific tasks when invoked.
        </p>
      </div>
      <FileReview item={item} />
      <div className="flex justify-end">
        <CTAButton
          type="button"
          disabled={loading}
          className="!mr-0 h-11 w-full rounded-[14px] text-dark-text md:w-auto md:min-w-[220px]"
          onClick={importAgentSkill}
        >
          {loading ? <CircleNotch size={16} className="animate-spin" /> : null}
          {loading ? "Importing..." : "Import agent skill"}
        </CTAButton>
      </div>
    </div>
  );
}

function FileReview({ item }) {
  const files = item.manifest.files || [];
  const [index, setIndex] = useState(0);
  const [file, setFile] = useState(files[index]);
  function handlePrevious() {
    if (index > 0) setIndex(index - 1);
  }

  function handleNext() {
    if (index < files.length - 1) setIndex(index + 1);
  }

  function fileMarkup(file) {
    const extension = file.name.split(".").pop();
    switch (extension) {
      case "js":
        return "javascript";
      case "json":
        return "json";
      case "md":
        return "markdown";
      default:
        return "text";
    }
  }

  useEffect(() => {
    if (files.length > 0) setFile(files?.[index] || files[0]);
  }, [index]);

  if (!file) return null;
  return (
    <div className="prism-community-import-code">
      <div className="prism-community-import-code__header">
        <button
          type="button"
          className={`rounded-full border border-theme-sidebar-border p-1 text-theme-text-secondary transition-colors duration-200 hover:text-theme-text-primary ${
            index === 0 ? "cursor-not-allowed opacity-50" : ""
          }`}
          onClick={handlePrevious}
          disabled={index === 0}
        >
          <CaretLeft size={16} />
        </button>
        <p className="min-w-0 truncate text-xs font-mono">
          {file.name} ({index + 1} of {files.length} files)
        </p>
        <button
          type="button"
          className={`rounded-full border border-theme-sidebar-border p-1 text-theme-text-secondary transition-colors duration-200 hover:text-theme-text-primary ${
            index === files.length - 1 ? "cursor-not-allowed opacity-50" : ""
          }`}
          onClick={handleNext}
          disabled={index === files.length - 1}
        >
          <CaretRight size={16} />
        </button>
      </div>
      <span
        className="hljs flex flex-col gap-y-1 whitespace-pre-line text-sm leading-[20px] text-theme-text-primary"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(
            renderMarkdown(
              `\`\`\`${fileMarkup(file)}\n${
                fileMarkup(file) === "markdown"
                  ? file.content.replace(/```/g, "~~~") // Escape triple backticks in markdown
                  : file.content
              }\n\`\`\``
            )
          ),
        }}
      />
    </div>
  );
}
