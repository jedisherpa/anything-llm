import CTAButton from "@/components/lib/CTAButton";
import CommunityHubImportItemSteps from "../..";
import showToast from "@/utils/toast";
import paths from "@/utils/paths";
import CommunityHub from "@/models/communityHub";

export default function SlashCommand({ item, setStep }) {
  async function handleSubmit() {
    try {
      const { error } = await CommunityHub.applyItem(item.importId);
      if (error) throw new Error(error);
      showToast(
        `Slash command ${item.command} imported successfully!`,
        "success"
      );
      setStep(CommunityHubImportItemSteps.completed.key);
    } catch (e) {
      console.error(e);
      showToast(`Failed to import slash command. ${e.message}`, "error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-theme-text-primary">
          Review Slash Command "{item.name}"
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
          Slash commands are used to prefill information into a prompt while
          chatting with a AnythingLLM workspace.
          <br />
          <br />
          The slash command will be available during chatting by simply invoking
          it with{" "}
          <code className="rounded-md bg-theme-settings-input-bg px-2 py-1 font-mono text-theme-text-primary">
            {item.command}
          </code>{" "}
          like you would any other command.
        </p>
      </div>

      <div className="prism-community-import-code">
        <div className="prism-community-import-code__header">
          <span>Slash command preview</span>
          <span className="font-mono">{item.command}</span>
        </div>
        <pre className="whitespace-pre-wrap text-sm leading-7 text-theme-text-primary">
          {item.prompt}
        </pre>
      </div>

      <div className="flex justify-end">
        <CTAButton
          type="button"
          className="!mr-0 h-11 w-full rounded-[14px] text-dark-text md:w-auto md:min-w-[220px]"
          onClick={handleSubmit}
        >
          Import slash command
        </CTAButton>
      </div>
    </div>
  );
}
