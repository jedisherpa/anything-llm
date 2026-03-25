import Workspace from "@/models/workspace";
import paths from "@/utils/paths";
import {
  LAST_VISITED_WORKSPACE,
  PENDING_HOME_MESSAGE,
} from "@/utils/constants";
import { safeJsonParse } from "@/utils/request";
import showToast from "@/utils/toast";

export async function getMetacanonTargetWorkspace() {
  const lastVisited = safeJsonParse(
    localStorage.getItem(LAST_VISITED_WORKSPACE)
  );
  if (lastVisited?.slug) {
    const workspace = await Workspace.bySlug(lastVisited.slug);
    if (workspace) return workspace;
  }

  const workspaces = await Workspace.all();
  return workspaces.length > 0 ? workspaces[0] : null;
}

export async function createMetacanonDefaultWorkspace(
  workspaceName = "MetaCanon Workspace"
) {
  const { workspace, message } = await Workspace.new({ name: workspaceName });
  if (!workspace) {
    showToast(message || "Failed to create workspace", "error");
    return null;
  }
  return workspace;
}

export async function openMetacanonChat({
  navigate,
  initialPrompt = "",
  workspaceName = "MetaCanon Workspace",
}) {
  let workspace = await getMetacanonTargetWorkspace();
  if (!workspace) {
    workspace = await createMetacanonDefaultWorkspace(workspaceName);
    if (!workspace) return false;
  }

  const trimmedPrompt = String(initialPrompt || "").trim();
  if (!trimmedPrompt) {
    navigate(paths.workspace.chat(workspace.slug));
    return true;
  }

  const { thread } = await Workspace.threads.new(workspace.slug);
  sessionStorage.setItem(
    PENDING_HOME_MESSAGE,
    JSON.stringify({ message: trimmedPrompt, attachments: [] })
  );

  navigate(
    thread?.slug
      ? paths.workspace.thread(workspace.slug, thread.slug)
      : paths.workspace.chat(workspace.slug)
  );
  return true;
}
