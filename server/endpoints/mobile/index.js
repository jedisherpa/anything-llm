const { validatedRequest } = require("../../utils/middleware/validatedRequest");
const { MobileDevice } = require("../../models/mobileDevice");
const { handleMobileCommand, hydrateMobileWorkspaces } = require("./utils");
const { validDeviceToken, validRegistrationToken } = require("./middleware");
const { reqBody } = require("../../utils/http");
const { Workspace } = require("../../models/workspace");
const { Document } = require("../../models/documents");
const { handleFileUpload } = require("../../utils/files/multer");
const { CollectorApi } = require("../../utils/collectorApi");
const { Telemetry } = require("../../models/telemetry");
const { EventLogs } = require("../../models/eventLogs");
const { getLibraryManifest } = require("../../utils/agents/metacanon/store");
const {
  flexUserRoleValid,
  ROLES,
} = require("../../utils/middleware/multiUserProtected");

async function resolveMobileWorkspace(response, slug = "") {
  const user = response.locals.user ?? null;
  return user
    ? await Workspace.getWithUser(user, { slug: String(slug) })
    : await Workspace.get({ slug: String(slug) });
}

function mobileEndpoints(app) {
  if (!app) return;

  /**
   * Gets all the devices from the database.
   * @param {import("express").Request} request
   * @param {import("express").Response} response
   */
  app.get(
    "/mobile/devices",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (_request, response) => {
      try {
        const devices = await MobileDevice.where({}, null, null, {
          user: { select: { id: true, username: true } },
        });
        return response.status(200).json({ devices });
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  /**
   * Updates the device status via an updates object.
   * @param {import("express").Request} request
   * @param {import("express").Response} response
   */
  app.post(
    "/mobile/update/:id",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const body = reqBody(request);
        const updates = await MobileDevice.update(
          Number(request.params.id),
          body
        );
        if (updates.error)
          return response.status(400).json({ error: updates.error });
        return response.status(200).json({ updates });
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  /**
   * Deletes a device from the database.
   * @param {import("express").Request} request
   * @param {import("express").Response} response
   */
  app.delete(
    "/mobile/:id",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (request, response) => {
      try {
        const device = await MobileDevice.get({
          id: Number(request.params.id),
        });
        if (!device)
          return response.status(404).json({ error: "Device not found" });
        await MobileDevice.delete(device.id);
        return response.status(200).json({ message: "Device deleted" });
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.get(
    "/mobile/connect-info",
    [validatedRequest, flexUserRoleValid([ROLES.admin])],
    async (_request, response) => {
      try {
        return response.status(200).json({
          connectionUrl: MobileDevice.connectionURL(response.locals?.user),
        });
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  /**
   * Checks if the device auth token is valid
   * against approved devices.
   */
  app.get("/mobile/auth", [validDeviceToken], async (_, response) => {
    try {
      return response
        .status(200)
        .json({ success: true, message: "Device authenticated" });
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }
  });

  app.get("/mobile/bootstrap", [validDeviceToken], async (_, response) => {
    try {
      const workspaces = await hydrateMobileWorkspaces(response.locals.user);
      return response.status(200).json({
        device: {
          id: response.locals.device?.id,
          deviceName: response.locals.device?.deviceName,
          deviceOs: response.locals.device?.deviceOs,
          platform: MobileDevice.platform,
        },
        workspaces,
        library: getLibraryManifest(),
      });
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }
  });

  /**
   * Registers a new device (is open so that the mobile app can register itself)
   * Will create a new device in the database but requires approval by the user
   * before it can be used.
   * @param {import("express").Request} request
   * @param {import("express").Response} response
   */
  app.post(
    "/mobile/register",
    [validRegistrationToken],
    async (request, response) => {
      try {
        const body = reqBody(request);
        const result = await MobileDevice.create({
          deviceOs: body.deviceOs,
          deviceName: body.deviceName,
          userId: response.locals?.user?.id,
        });

        if (result.error)
          return response.status(400).json({ error: result.error });
        return response.status(200).json({
          token: result.device.token,
          platform: MobileDevice.platform,
        });
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/mobile/send/:command",
    [validDeviceToken],
    async (request, response) => {
      try {
        return handleMobileCommand(request, response);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/mobile/workspace/:slug/upload-and-embed",
    [
      validDeviceToken,
      flexUserRoleValid([ROLES.admin, ROLES.manager]),
      handleFileUpload,
    ],
    async (request, response) => {
      try {
        const { slug = null } = request.params;
        const workspace = await resolveMobileWorkspace(response, slug);

        if (!workspace) {
          return response.status(404).json({ error: "Workspace not found" });
        }

        const Collector = new CollectorApi();
        const { originalname } = request.file;
        const processingOnline = await Collector.online();

        if (!processingOnline) {
          return response.status(500).json({
            success: false,
            error: `Document processing API is not online. Document ${originalname} will not be processed automatically.`,
          });
        }

        const { success, reason, documents } =
          await Collector.processDocument(originalname);
        if (!success || documents?.length === 0) {
          return response
            .status(500)
            .json({ success: false, error: reason || "Upload failed." });
        }

        const document = documents[0];
        const { failedToEmbed = [], errors = [] } = await Document.addDocuments(
          workspace,
          [document.location],
          response.locals?.user?.id
        );

        if (failedToEmbed.length > 0) {
          return response.status(200).json({
            success: false,
            error: errors?.[0] || "Failed to embed uploaded document.",
            document: null,
          });
        }

        await Telemetry.sendTelemetry("document_uploaded");
        await Telemetry.sendTelemetry("document_embedded");
        await EventLogs.logEvent(
          "document_uploaded",
          {
            documentName: originalname,
            workspaceName: workspace?.name,
            source: "mobile",
          },
          response.locals?.user?.id
        );
        await EventLogs.logEvent(
          "document_embedded",
          {
            documentName: originalname,
            workspaceId: workspace.id,
            source: "mobile",
          },
          response.locals?.user?.id
        );

        return response.status(200).json({
          success: true,
          error: null,
          document: { id: document.id, location: document.location },
        });
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );
}

module.exports = { mobileEndpoints };
