const invoke = window.__TAURI__?.tauri?.invoke;

const projectName = document.getElementById("projectName");
const upstreamVersion = document.getElementById("upstreamVersion");
const upstreamCommit = document.getElementById("upstreamCommit");
const repositoryUrl = document.getElementById("repositoryUrl");
const docTabs = document.getElementById("docTabs");
const docTitle = document.getElementById("docTitle");
const docPath = document.getElementById("docPath");
const docBody = document.getElementById("docBody");
const openFileBtn = document.getElementById("openFileBtn");

let materials = null;
let activeDocumentId = "";

function getDocument(id) {
  return materials?.documents?.find((document) => document.id === id) || null;
}

function renderDocument(id) {
  const document = getDocument(id);
  if (!document) return;

  activeDocumentId = id;
  docTitle.textContent = document.title;
  docPath.textContent = document.path || "Bundled for this release";
  docBody.textContent = document.body || "No document text available.";
  openFileBtn.disabled = !document.path;

  for (const button of docTabs.querySelectorAll(".legal-tab")) {
    button.setAttribute("aria-selected", button.dataset.id === id ? "true" : "false");
  }
}

function renderTabs() {
  docTabs.innerHTML = "";
  for (const legalDocument of materials.documents) {
    const button = window.document.createElement("button");
    button.type = "button";
    button.className = "legal-tab";
    button.dataset.id = legalDocument.id;
    button.setAttribute("aria-selected", legalDocument.id === activeDocumentId ? "true" : "false");
    button.innerHTML = `
      <span class="legal-tab__title">${legalDocument.title}</span>
      <span class="legal-tab__path">${legalDocument.path || "Bundled document"}</span>
    `;
    button.addEventListener("click", () => renderDocument(legalDocument.id));
    docTabs.appendChild(button);
  }
}

async function loadMaterials() {
  if (!invoke) {
    docBody.textContent = "The PrismAI desktop bridge is not available in this window.";
    openFileBtn.disabled = true;
    return;
  }

  try {
    materials = await invoke("get_open_source_materials");
    projectName.textContent = materials.projectName || "AnythingLLM";
    upstreamVersion.textContent = materials.upstreamVersion || "Unknown";
    upstreamCommit.textContent = materials.upstreamCommit || "Unknown";
    repositoryUrl.textContent = materials.repositoryUrl || "Unavailable";
    repositoryUrl.href = materials.repositoryUrl || "#";

    activeDocumentId = materials.documents?.[0]?.id || "";
    renderTabs();
    renderDocument(activeDocumentId);
  } catch (error) {
    docBody.textContent = `Unable to load bundled open-source materials:\n\n${String(error)}`;
    openFileBtn.disabled = true;
  }
}

openFileBtn.addEventListener("click", async () => {
  if (!invoke || !activeDocumentId) return;
  try {
    await invoke("open_open_source_document", { id: activeDocumentId });
  } catch (error) {
    docBody.textContent = `${docBody.textContent}\n\nOpen failed: ${String(error)}`;
  }
});

loadMaterials();
