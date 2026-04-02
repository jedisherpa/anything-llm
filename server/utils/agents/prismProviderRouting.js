const { getPrismProviderSlots } = require("../prismCredentialVault");

function normalizeId(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function isWorkspaceDefaultToken(value = "") {
  return [
    "workspace-default",
    "active-workspace",
    "default",
    "inherit",
  ].includes(normalizeId(value));
}

function routeCandidates({
  explicitBackends = [],
  preferredBackends = [],
  fallbackBackends = [],
} = {}) {
  return uniqueStrings([
    ...explicitBackends,
    ...preferredBackends,
    ...fallbackBackends,
  ]);
}

function slotAliases(slot = {}) {
  return uniqueStrings([
    slot.id,
    slot.label,
    slot.provider,
    slot.provider && slot.model ? `${slot.provider}:${slot.model}` : "",
  ]).map(normalizeId);
}

function buildRouteConfig(slot = {}, routeId = "") {
  return {
    routeId,
    slotId: slot.id,
    slotLabel: slot.label,
    provider: slot.provider,
    model: slot.model || null,
    basePath: slot.basePath || null,
    apiKey: slot.apiKey || null,
    tokenLimit: slot.tokenLimit || null,
  };
}

async function resolvePrismRouteConfig({
  explicitBackends = [],
  preferredBackends = [],
  fallbackBackends = [],
} = {}) {
  const candidates = routeCandidates({
    explicitBackends,
    preferredBackends,
    fallbackBackends,
  });

  if (candidates.length === 0) return null;

  const slots = (await getPrismProviderSlots()).filter(
    (slot) => slot.enabled !== false && slot.provider
  );

  for (const candidate of candidates) {
    if (isWorkspaceDefaultToken(candidate)) return null;

    const normalizedCandidate = normalizeId(candidate);
    const slot = slots.find((entry) =>
      slotAliases(entry).includes(normalizedCandidate)
    );
    if (slot) return buildRouteConfig(slot, candidate);
  }

  return null;
}

module.exports = {
  resolvePrismRouteConfig,
};
