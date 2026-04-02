const { SystemSettings } = require("../../models/systemSettings");
const prisma = require("../prisma");

/**
 * Mark the onboarding as completed for legacy users prior to this change where onboarding is now a flag in the DB.
 * This is a legacy patch to ensure that existing users are not redirected to the onboarding page who have been using the app for a while.
 */
async function markOnboarded() {
  try {
    const onboardingStatus = await SystemSettings.isOnboardingComplete();
    if (onboardingStatus === true) return;

    // Check if the server is already onboarded by the old way of checking if the server in any way has been setup.
    // If it is, then we can mark the onboarding as complete in the DB to persist this
    const alreadyOnboarded = await isLegacyOnboarded();
    if (alreadyOnboarded === true) {
      console.log(
        "\x1b[33m[ONBOARDING PATCH]\x1b[0m Legacy instance is already onboarded, marking onboarding as complete. You will not see this message again."
      );
      await SystemSettings.markOnboardingComplete();
      return true;
    }
    return false;
  } catch (e) {
    console.error(
      "\x1b[31m[ONBOARDING PATCH]\x1b[0m Error marking onboarding as complete",
      e.message,
      e
    );
    return false;
  }
}

/**
 * Check if the server is already onboarded by the old way of checking if the server in any way has been setup.
 * @returns {Promise<boolean>}
 */
async function isLegacyOnboarded() {
  // Desktop launches always inject some runtime defaults and secrets. On clean
  // profiles that is not proof of prior onboarding, so only trust persisted
  // usage signals from storage for the desktop lane.
  if (isDesktopPackagedRuntime()) {
    if ((await SystemSettings.isMultiUserMode()) === true) return true;
    return await hasPersistedDesktopUsage();
  }

  // LLM Provider is set, so we can assume onboarding is complete since this is default null in SystemSettings.js
  if (Boolean(process.env.LLM_PROVIDER)) return true;

  // Vector DB is set, so we can assume onboarding is complete since this is default null in SystemSettings.js (default is lancedb in frontend)
  if (Boolean(process.env.VECTOR_DB)) return true;

  // AUTH_TOKEN historically indicated a configured instance.
  // Do not treat JWT_SECRET as proof of onboarding because the desktop shell
  // now injects runtime secrets on every clean launch.
  if (Boolean(process.env.AUTH_TOKEN)) return true;
  // Check multi-user mode is enabled, if it is, then they are already using the app.
  if ((await SystemSettings.isMultiUserMode()) === true) return true;
  return false;
}

function isDesktopPackagedRuntime() {
  return Boolean(process.env.STORAGE_DIR && process.env.__CFBundleIdentifier);
}

async function hasPersistedDesktopUsage() {
  const [
    workspaceCount,
    documentCount,
    chatCount,
    userCount,
    customSettingsCount,
  ] = await Promise.all([
    prisma.workspaces.count(),
    prisma.workspace_documents.count(),
    prisma.workspace_chats.count(),
    prisma.users.count(),
    prisma.system_settings.count({
      where: {
        label: {
          notIn: [
            "logo_filename",
            "multi_user_mode",
            "onboarding_complete",
            "telemetry_id",
            "prism_setup_assistant_draft",
          ],
        },
      },
    }),
  ]);

  return (
    workspaceCount > 0 ||
    documentCount > 0 ||
    chatCount > 0 ||
    userCount > 0 ||
    customSettingsCount > 0
  );
}

module.exports = markOnboarded;
