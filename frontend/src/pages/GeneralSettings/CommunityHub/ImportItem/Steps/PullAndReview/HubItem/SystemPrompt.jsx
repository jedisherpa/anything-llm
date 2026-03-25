import CTAButton from "@/components/lib/CTAButton";
import CommunityHubImportItemSteps from "../..";
import { useEffect, useState } from "react";
import Workspace from "@/models/workspace";
import showToast from "@/utils/toast";
import paths from "@/utils/paths";
import CommunityHub from "@/models/communityHub";

export default function SystemPrompt({ item, setStep }) {
  const [destinationWorkspaceSlug, setDestinationWorkspaceSlug] =
    useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  useEffect(() => {
    async function getWorkspaces() {
      const workspaces = await Workspace.all();
      setWorkspaces(workspaces);
      setDestinationWorkspaceSlug(workspaces[0].slug);
    }
    getWorkspaces();
  }, []);

  async function handleSubmit() {
    showToast("Applying system prompt to workspace...", "info");
    const { error } = await CommunityHub.applyItem(item.importId, {
      workspaceSlug: destinationWorkspaceSlug,
    });
    if (error) {
      return showToast(`Failed to apply system prompt. ${error}`, "error", {
        clear: true,
      });
    }

    showToast("System prompt applied to workspace.", "success", {
      clear: true,
    });
    setStep(CommunityHubImportItemSteps.completed.key);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-theme-text-primary">
          Review System Prompt "{item.name}"
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
      </div>

      <div className="prism-community-import-summary text-sm leading-7 text-theme-text-secondary">
        <p>
          System prompts are used to guide the behavior of the AI agents and can
          be applied to any existing workspace.
        </p>
      </div>

      <div className="prism-community-import-code">
        <div className="prism-community-import-code__header">
          <span>Provided system prompt</span>
          <span className="font-mono">prompt</span>
        </div>
        <pre className="whitespace-pre-wrap text-sm leading-7 text-theme-text-primary">
          {item.prompt}
        </pre>
      </div>

      <div className="prism-community-import-summary max-w-[320px]">
        <label className="mb-3 block text-sm font-semibold text-theme-text-primary">
          Apply to workspace
        </label>
        <select
          name="destinationWorkspaceSlug"
          required={true}
          value={destinationWorkspaceSlug || ""}
          onChange={(e) => setDestinationWorkspaceSlug(e.target.value)}
          className="block w-full rounded-[14px] border-none bg-theme-settings-input-bg px-4 py-3 text-sm text-theme-settings-input-text"
        >
          <optgroup label="Available workspaces">
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.slug}>
                {workspace.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {destinationWorkspaceSlug && (
        <div className="flex justify-end">
          <CTAButton
            type="button"
            className="!mr-0 h-11 w-full rounded-[14px] text-dark-text md:w-auto md:min-w-[280px]"
            onClick={handleSubmit}
          >
            Apply system prompt to workspace
          </CTAButton>
        </div>
      )}
    </div>
  );
}
