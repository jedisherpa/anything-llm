const { Workspace } = require("../../../models/workspace");
const { WorkspaceChats } = require("../../../models/workspaceChats");
const { WorkspaceThread } = require("../../../models/workspaceThread");
const { Document } = require("../../../models/documents");
const { ApiChatHandler } = require("../../../utils/chats/apiChatHandler");
const { reqBody } = require("../../../utils/http");
const prisma = require("../../../utils/prisma");
const { getModelTag } = require("../../utils");
const { MobileDevice } = require("../../../models/mobileDevice");
const { ROLES } = require("../../../utils/middleware/multiUserProtected");
const {
  getLibraryManifest,
  getLibraryCollection,
  getLibraryItem,
} = require("../../../utils/agents/metacanon/store");

async function hydrateMobileWorkspaces(user = null) {
  const workspaces = user
    ? await Workspace.whereWithUser(user, {})
    : await Workspace.where({});

  for (const workspace of workspaces) {
    const [threadCount, chatCount] = await Promise.all([
      prisma.workspace_threads.count({
        where: {
          workspace_id: workspace.id,
          ...(user ? { user_id: user.id } : {}),
        },
      }),
      prisma.workspace_chats.count({
        where: {
          workspaceId: workspace.id,
          include: true,
          ...(user ? { user_id: user.id } : {}),
        },
      }),
    ]);
    workspace.threadCount = threadCount;
    workspace.chatCount = chatCount;
    workspace.platform = MobileDevice.platform;
  }

  return workspaces;
}

function canManageMobileWorkspaces(user = null) {
  if (!user) return true;
  return [ROLES.admin, ROLES.manager].includes(user.role);
}

async function resolveMobileWorkspace(user = null, workspaceSlug = "") {
  return user
    ? await Workspace.getWithUser(user, { slug: String(workspaceSlug) })
    : await Workspace.get({ slug: String(workspaceSlug) });
}

function formatMobileDocument(document = {}) {
  let metadata = null;
  let type = null;
  let source = null;

  try {
    const parsed = Document.parseDocumentTypeAndSource(document);
    metadata = parsed.metadata;
    type = parsed.type;
    source = parsed.source;
  } catch {
    metadata = null;
    type = null;
    source = null;
  }

  return {
    id: document.id,
    docId: document.docId,
    filename: document.filename,
    docPath: document.docpath,
    pinned: Boolean(document.pinned),
    watched: Boolean(document.watched),
    createdAt: document.createdAt,
    lastUpdatedAt: document.lastUpdatedAt,
    title: metadata?.title || document.filename || document.docpath,
    sourceType: type,
    source,
    metadata,
  };
}

/**
 *
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @returns
 */
async function handleMobileCommand(request, response) {
  const { command } = request.params;
  const user = response.locals.user ?? null;
  const body = reqBody(request);

  if (command === "workspaces") {
    const workspaces = await hydrateMobileWorkspaces(user);
    return response.status(200).json({ workspaces });
  }

  if (command === "workspace") {
    const workspace = await resolveMobileWorkspace(user, body.workspaceSlug);

    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });
    return response.status(200).json({ workspace });
  }

  if (command === "workspace-documents") {
    const workspace = await resolveMobileWorkspace(user, body.workspaceSlug);

    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });

    const documents = (await Document.forWorkspace(workspace.id)).map(
      formatMobileDocument
    );
    return response.status(200).json({ documents });
  }

  if (command === "create-workspace") {
    if (!canManageMobileWorkspaces(user)) {
      return response.status(401).json({
        error: "You do not have permission to create workspaces.",
      });
    }

    const { name = null, ...additionalFields } = body;
    const { workspace, message } = await Workspace.new(
      name,
      user?.id || null,
      additionalFields
    );

    if (!workspace) {
      return response.status(400).json({ workspace: null, message });
    }

    return response.status(200).json({ workspace, message: null });
  }

  if (command === "update-workspace") {
    if (!canManageMobileWorkspaces(user)) {
      return response.status(401).json({
        error: "You do not have permission to update workspaces.",
      });
    }

    const { workspaceSlug = null, ...updates } = body;
    if (!workspaceSlug)
      return response.status(400).json({ error: "Workspace slug is required" });

    const workspace = await resolveMobileWorkspace(user, workspaceSlug);

    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });

    await Workspace.trackChange(workspace, updates, user);
    const result = await Workspace.update(workspace.id, updates);
    return response.status(200).json(result);
  }

  if (command === "update-document-pin") {
    if (!canManageMobileWorkspaces(user)) {
      return response.status(401).json({
        error: "You do not have permission to manage workspace documents.",
      });
    }

    const {
      workspaceSlug = null,
      documentId = null,
      docPath = null,
      pinStatus = false,
    } = body;

    const workspace = await resolveMobileWorkspace(user, workspaceSlug);
    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });

    const document = documentId
      ? await Document.get({
          id: Number(documentId),
          workspaceId: workspace.id,
        })
      : await Document.get({
          docpath: String(docPath),
          workspaceId: workspace.id,
        });

    if (!document)
      return response.status(404).json({ error: "Document not found" });

    const result = await Document.update(document.id, {
      pinned: Boolean(pinStatus),
    });
    if (!result.document)
      return response.status(400).json({ error: result.message });

    return response
      .status(200)
      .json({ document: formatMobileDocument(result.document), error: null });
  }

  if (command === "remove-workspace-document") {
    if (!canManageMobileWorkspaces(user)) {
      return response.status(401).json({
        error: "You do not have permission to manage workspace documents.",
      });
    }

    const { workspaceSlug = null, documentId = null, docPath = null } = body;
    const workspace = await resolveMobileWorkspace(user, workspaceSlug);
    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });

    const document = documentId
      ? await Document.get({
          id: Number(documentId),
          workspaceId: workspace.id,
        })
      : await Document.get({
          docpath: String(docPath),
          workspaceId: workspace.id,
        });

    if (!document)
      return response.status(404).json({ error: "Document not found" });

    const success = await Document.removeDocuments(
      workspace,
      [document.docpath],
      user?.id || null
    );

    if (!success)
      return response.status(500).json({ error: "Failed to remove document" });

    return response.status(200).json({
      success: true,
      removed: {
        id: document.id,
        docId: document.docId,
        docPath: document.docpath,
      },
    });
  }

  if (command === "library-manifest") {
    return response.status(200).json(getLibraryManifest());
  }

  if (command === "library-collection") {
    const tab = String(body.tab || "").trim();
    if (!tab) return response.status(400).json({ error: "Tab is required" });
    return response.status(200).json({ items: getLibraryCollection(tab) });
  }

  if (command === "library-item") {
    const tab = String(body.tab || "").trim();
    const id = String(body.id || "").trim();
    if (!tab || !id)
      return response.status(400).json({ error: "Tab and id are required" });

    const item = getLibraryItem(tab, id);
    if (!item)
      return response.status(404).json({ error: "Library item not found" });
    return response.status(200).json(item);
  }

  if (command === "workspace-content") {
    const workspace = await resolveMobileWorkspace(user, body.workspaceSlug);

    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });
    const threads = [
      {
        id: 0,
        name: "Default Thread",
        slug: "default-thread",
        workspace_id: workspace.id,
        createdAt: new Date(),
        lastUpdatedAt: new Date(),
      },
      ...(await prisma.workspace_threads.findMany({
        where: {
          workspace_id: workspace.id,
          ...(user ? { user_id: user.id } : {}),
        },
      })),
    ];
    const chats = (
      await prisma.workspace_chats.findMany({
        where: {
          workspaceId: workspace.id,
          include: true,
          ...(user ? { user_id: user.id } : {}),
        },
      })
    ).map((chat) => ({
      ...chat,
      // Create a dummy thread_id for the default thread so the chats can be mapped correctly.
      ...(chat.thread_id === null ? { thread_id: 0 } : {}),
      createdAt: chat.createdAt.toISOString(),
      lastUpdatedAt: chat.lastUpdatedAt.toISOString(),
    }));
    return response.status(200).json({ threads, chats });
  }

  // Get the model for this workspace (workspace -> system)
  if (command === "model-tag") {
    const { workspaceSlug } = body;
    const workspace = await resolveMobileWorkspace(user, workspaceSlug);

    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });
    if (workspace.chatModel)
      return response.status(200).json({ model: workspace.chatModel });
    else return response.status(200).json({ model: getModelTag() });
  }

  if (command === "reset-chat") {
    const { workspaceSlug, threadSlug } = body;
    const workspace = await resolveMobileWorkspace(user, workspaceSlug);

    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });
    const threadId = threadSlug
      ? await prisma.workspace_threads.findFirst({
          where: {
            workspace_id: workspace.id,
            slug: String(threadSlug),
            ...(user ? { user_id: user.id } : {}),
          },
        })?.id
      : null;

    await WorkspaceChats.markThreadHistoryInvalidV2({
      workspaceId: workspace.id,
      ...(user ? { user_id: user.id } : {}),
      thread_id: threadId, // if threadId is null, this will reset the default thread.
    });
    return response.status(200).json({ success: true });
  }

  if (command === "new-thread") {
    const { workspaceSlug } = body;
    const workspace = await resolveMobileWorkspace(user, workspaceSlug);

    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });
    const { thread } = await WorkspaceThread.new(workspace, user?.id);
    return response.status(200).json({ thread });
  }

  if (command === "stream-chat") {
    const {
      workspaceSlug = null,
      threadSlug = null,
      message,
      mode = "chat",
      attachments = [],
      promptHandling = null,
      precisionMode = false,
    } = body;
    if (!workspaceSlug)
      return response.status(400).json({ error: "Workspace ID is required" });
    else if (!message)
      return response.status(400).json({ error: "Message is required" });

    const workspace = await resolveMobileWorkspace(user, workspaceSlug);

    if (!workspace)
      return response.status(400).json({ error: "Workspace not found" });
    const thread = threadSlug
      ? await prisma.workspace_threads.findFirst({
          where: {
            workspace_id: workspace.id,
            slug: String(threadSlug),
            ...(user ? { user_id: user.id } : {}),
          },
        })
      : null;

    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    await ApiChatHandler.streamChat({
      response,
      workspace,
      thread,
      message,
      mode,
      user: user,
      sessionId: null,
      attachments,
      reset: false,
      promptHandling,
      precisionMode,
    });
    return response.end();
  }

  if (command === "unregister-device") {
    if (!response.locals.device)
      return response.status(200).json({ success: true });
    await MobileDevice.delete(response.locals.device.id);
    return response.status(200).json({ success: true });
  }

  return response.status(400).json({ error: "Invalid command" });
}

module.exports = {
  handleMobileCommand,
  hydrateMobileWorkspaces,
};
