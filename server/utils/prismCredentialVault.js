const { SystemSettings } = require("../models/systemSettings");
const { EncryptionManager } = require("./EncryptionManager");

const PROVIDER_SLOTS_LABEL = "prism_provider_slots_v1";
const TOOL_CREDENTIALS_LABEL = "prism_tool_credentials_v1";
const PROVIDER_SLOT_COUNT = 5;

const DEFAULT_TOOL_CREDENTIALS = [
  {
    id: "imagegen",
    label: "Image Gen",
    description: "Image generation providers and image-edit tools.",
  },
  {
    id: "voicegen",
    label: "Voice Gen",
    description: "Speech, narration, or voice synthesis tools.",
  },
  {
    id: "namecheap",
    label: "Namecheap",
    description: "Domain, DNS, and registrar automation.",
  },
  {
    id: "fal",
    label: "FAL",
    description: "External media and generative model tools.",
  },
  {
    id: "replicate",
    label: "Replicate",
    description: "Replicate-hosted media and utility models.",
  },
  {
    id: "sora",
    label: "Sora",
    description: "Video generation and editing workflows.",
  },
];

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function getEncryptionManager() {
  return new EncryptionManager();
}

function decryptSecret(encryptedValue = null) {
  if (!encryptedValue) return "";
  return getEncryptionManager().decrypt(encryptedValue) || "";
}

function encryptSecret(rawValue = "") {
  const nextValue = String(rawValue || "").trim();
  if (!nextValue) return null;
  return getEncryptionManager().encrypt(nextValue);
}

function normalizeProviderSlot(slot = {}, index = 0) {
  const slotNumber = index + 1;
  return {
    id: slot.id || `slot-${slotNumber}`,
    label: String(slot.label || `Provider Slot ${slotNumber}`).trim(),
    provider: String(slot.provider || "").trim(),
    model: String(slot.model || "").trim(),
    basePath: String(slot.basePath || "").trim(),
    apiKey: String(slot.apiKey || "").trim(),
    tokenLimit: String(slot.tokenLimit || "").trim(),
    enabled: slot.enabled !== false,
  };
}

function normalizeStoredProviderSlot(slot = {}, index = 0) {
  const normalized = normalizeProviderSlot(
    {
      ...slot,
      apiKey: decryptSecret(slot.apiKey),
    },
    index
  );

  return normalized;
}

function serializeProviderSlot(slot = {}, index = 0) {
  const normalized = normalizeProviderSlot(slot, index);
  return {
    ...normalized,
    apiKey: encryptSecret(normalized.apiKey),
  };
}

async function getPrismProviderSlots() {
  const raw = await SystemSettings.getValueOrFallback(
    { label: PROVIDER_SLOTS_LABEL },
    "[]"
  );
  const parsed = safeJsonParse(raw, []);

  return Array.from({ length: PROVIDER_SLOT_COUNT }, (_, index) =>
    normalizeStoredProviderSlot(parsed[index] || {}, index)
  );
}

async function savePrismProviderSlots(slots = []) {
  const normalized = Array.from({ length: PROVIDER_SLOT_COUNT }, (_, index) =>
    normalizeProviderSlot(slots[index] || {}, index)
  );

  const stored = normalized.map((slot, index) =>
    serializeProviderSlot(slot, index)
  );

  const { success, error } = await SystemSettings._updateSettings({
    [PROVIDER_SLOTS_LABEL]: JSON.stringify(stored),
  });

  return {
    success,
    error,
    slots: normalized,
  };
}

function normalizeToolCredential(entry = {}, fallback = {}) {
  return {
    id: String(entry.id || fallback.id || "").trim(),
    label: String(entry.label || fallback.label || "").trim(),
    description: String(entry.description || fallback.description || "").trim(),
    value: String(entry.value || "").trim(),
  };
}

function serializeToolCredential(entry = {}, fallback = {}) {
  const normalized = normalizeToolCredential(entry, fallback);
  return {
    ...normalized,
    value: encryptSecret(normalized.value),
  };
}

async function getPrismToolCredentials() {
  const raw = await SystemSettings.getValueOrFallback(
    { label: TOOL_CREDENTIALS_LABEL },
    "[]"
  );
  const parsed = safeJsonParse(raw, []);
  const parsedById = new Map(
    parsed.map((entry) => [String(entry.id || "").trim(), entry])
  );

  return DEFAULT_TOOL_CREDENTIALS.map((fallback) =>
    normalizeToolCredential(
      {
        ...parsedById.get(fallback.id),
        value: decryptSecret(parsedById.get(fallback.id)?.value),
      },
      fallback
    )
  );
}

async function savePrismToolCredentials(entries = []) {
  const entriesById = new Map(
    entries.map((entry) => [String(entry.id || "").trim(), entry])
  );

  const normalized = DEFAULT_TOOL_CREDENTIALS.map((fallback) =>
    normalizeToolCredential(entriesById.get(fallback.id) || {}, fallback)
  );

  const stored = DEFAULT_TOOL_CREDENTIALS.map((fallback) =>
    serializeToolCredential(entriesById.get(fallback.id) || {}, fallback)
  );

  const { success, error } = await SystemSettings._updateSettings({
    [TOOL_CREDENTIALS_LABEL]: JSON.stringify(stored),
  });

  return {
    success,
    error,
    credentials: normalized,
  };
}

async function getPrismToolCredentialMap() {
  const credentials = await getPrismToolCredentials();
  return credentials.reduce((acc, entry) => {
    if (!entry.value) return acc;
    acc[entry.id] = entry.value;
    return acc;
  }, {});
}

async function getPrismToolCredential(id = "") {
  const map = await getPrismToolCredentialMap();
  return map[String(id || "").trim()] || null;
}

module.exports = {
  PROVIDER_SLOT_COUNT,
  DEFAULT_TOOL_CREDENTIALS,
  getPrismProviderSlots,
  savePrismProviderSlots,
  getPrismToolCredentials,
  savePrismToolCredentials,
  getPrismToolCredentialMap,
  getPrismToolCredential,
};
