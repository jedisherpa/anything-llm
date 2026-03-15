import PrismHoverTarget from "@/components/PrismHoverTarget";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import MetacanonRepo from "@/models/metacanonRepo";
import paths from "@/utils/paths";
import showToast from "@/utils/toast";
import { isMobile } from "react-device-detect";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

function MetacanonMark({ className = "h-11 w-11" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M32 6 54 22l-8.4 26H18.4L10 22 32 6Z"
        fill="rgba(214,180,107,0.12)"
        stroke="rgba(214,180,107,0.95)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill="rgba(255,244,220,0.95)"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        MC
      </text>
    </svg>
  );
}

function normalizeRepoPath(input = "") {
  return String(input || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/\/$/, "");
}

function parentDirectory(relativePath = "") {
  const normalized = normalizeRepoPath(relativePath);
  if (!normalized || !normalized.includes("/")) return "";
  return normalized.split("/").slice(0, -1).join("/");
}

function basename(relativePath = "") {
  const normalized = normalizeRepoPath(relativePath);
  return normalized.split("/").pop() || normalized || "repo";
}

function formatBytes(size = 0) {
  if (!size && size !== 0) return "unknown";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildFallbackDiff(previousText = "", nextText = "") {
  const previousLines = previousText.split("\n");
  const nextLines = nextText.split("\n");
  const maxLines = Math.max(previousLines.length, nextLines.length);
  const rows = [];
  let oldLine = 1;
  let newLine = 1;

  for (let index = 0; index < maxLines; index += 1) {
    const previousLine = previousLines[index];
    const nextLine = nextLines[index];

    if (previousLine === nextLine) {
      rows.push({
        type: "context",
        oldLineNumber: previousLine === undefined ? null : oldLine,
        newLineNumber: nextLine === undefined ? null : newLine,
        text: previousLine ?? nextLine ?? "",
      });
      if (previousLine !== undefined) oldLine += 1;
      if (nextLine !== undefined) newLine += 1;
      continue;
    }

    if (previousLine !== undefined) {
      rows.push({
        type: "remove",
        oldLineNumber: oldLine,
        newLineNumber: null,
        text: previousLine,
      });
      oldLine += 1;
    }

    if (nextLine !== undefined) {
      rows.push({
        type: "add",
        oldLineNumber: null,
        newLineNumber: newLine,
        text: nextLine,
      });
      newLine += 1;
    }
  }

  return rows;
}

function buildDiffRows(previousText = "", nextText = "") {
  const previousLines = previousText.split("\n");
  const nextLines = nextText.split("\n");
  const cellCount = previousLines.length * nextLines.length;

  if (cellCount > 160000) {
    return buildFallbackDiff(previousText, nextText);
  }

  const lcs = Array.from({ length: previousLines.length + 1 }, () =>
    Array(nextLines.length + 1).fill(0)
  );

  for (let i = previousLines.length - 1; i >= 0; i -= 1) {
    for (let j = nextLines.length - 1; j >= 0; j -= 1) {
      if (previousLines[i] === nextLines[j]) {
        lcs[i][j] = lcs[i + 1][j + 1] + 1;
      } else {
        lcs[i][j] = Math.max(lcs[i + 1][j], lcs[i][j + 1]);
      }
    }
  }

  const rows = [];
  let previousIndex = 0;
  let nextIndex = 0;
  let oldLineNumber = 1;
  let newLineNumber = 1;

  while (previousIndex < previousLines.length && nextIndex < nextLines.length) {
    if (previousLines[previousIndex] === nextLines[nextIndex]) {
      rows.push({
        type: "context",
        oldLineNumber,
        newLineNumber,
        text: previousLines[previousIndex],
      });
      previousIndex += 1;
      nextIndex += 1;
      oldLineNumber += 1;
      newLineNumber += 1;
      continue;
    }

    if (
      lcs[previousIndex + 1][nextIndex] >= lcs[previousIndex][nextIndex + 1]
    ) {
      rows.push({
        type: "remove",
        oldLineNumber,
        newLineNumber: null,
        text: previousLines[previousIndex],
      });
      previousIndex += 1;
      oldLineNumber += 1;
      continue;
    }

    rows.push({
      type: "add",
      oldLineNumber: null,
      newLineNumber,
      text: nextLines[nextIndex],
    });
    nextIndex += 1;
    newLineNumber += 1;
  }

  while (previousIndex < previousLines.length) {
    rows.push({
      type: "remove",
      oldLineNumber,
      newLineNumber: null,
      text: previousLines[previousIndex],
    });
    previousIndex += 1;
    oldLineNumber += 1;
  }

  while (nextIndex < nextLines.length) {
    rows.push({
      type: "add",
      oldLineNumber: null,
      newLineNumber,
      text: nextLines[nextIndex],
    });
    nextIndex += 1;
    newLineNumber += 1;
  }

  return rows;
}

function ShellPanel({ title, eyebrow = null, actions = null, children }) {
  return (
    <section className="rounded-[22px] border border-theme-sidebar-border bg-theme-bg-sidebar px-5 py-5 shadow-[0_12px_36px_rgba(0,0,0,0.18)]">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-lg font-semibold text-theme-text-primary">
            {title}
          </h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function RepoEntryRow({
  entry,
  active = false,
  onClick,
  prefix = entry.isDirectory ? "DIR" : "FILE",
}) {
  return (
    <PrismHoverTarget
      targetId={`repo-entry-${entry.relativePath || entry.name}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-3 rounded-[16px] border px-3 py-3 text-left transition-all duration-150 ${
          active
            ? "border-theme-primary-button bg-theme-sidebar-footer-icon"
            : "border-theme-sidebar-border bg-theme-bg-container hover:border-theme-primary-button/50"
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-black/20 text-[10px] font-semibold tracking-[0.16em] text-theme-primary-button">
          {prefix}
        </span>
        <span className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-theme-text-primary">
            {entry.name}
          </div>
          <div className="truncate text-xs text-theme-text-secondary">
            {entry.relativePath}
          </div>
        </span>
      </button>
    </PrismHoverTarget>
  );
}

function Breadcrumbs({ currentDirectory = "", onSelect }) {
  const segments = currentDirectory ? currentDirectory.split("/") : [];

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-theme-text-secondary">
      <button
        type="button"
        className="rounded-full border border-theme-sidebar-border px-3 py-1 hover:border-theme-primary-button hover:text-theme-text-primary"
        onClick={() => onSelect("")}
      >
        repo
      </button>
      {segments.map((segment, index) => {
        const relativePath = segments.slice(0, index + 1).join("/");
        return (
          <button
            key={relativePath}
            type="button"
            className="rounded-full border border-theme-sidebar-border px-3 py-1 hover:border-theme-primary-button hover:text-theme-text-primary"
            onClick={() => onSelect(relativePath)}
          >
            {segment}
          </button>
        );
      })}
    </div>
  );
}

function CodeEditor({ value, onChange }) {
  const lineRef = useRef(null);

  return (
    <div className="overflow-hidden rounded-[18px] border border-theme-sidebar-border bg-[#0F0F0F]">
      <div className="border-b border-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
        Editable buffer
      </div>
      <div className="flex max-h-[620px] min-h-[620px] overflow-hidden">
        <pre
          ref={lineRef}
          className="m-0 min-w-[60px] overflow-hidden border-r border-white/5 bg-[#0A0A0A] px-3 py-4 text-right text-xs leading-6 text-white/25"
        >
          {value.split("\n").map((_, index) => (
            <div key={index}>{index + 1}</div>
          ))}
        </pre>
        <textarea
          spellCheck={false}
          wrap="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            if (lineRef.current)
              lineRef.current.scrollTop = event.target.scrollTop;
          }}
          className="min-h-full w-full resize-none bg-[#0F0F0F] px-4 py-4 font-mono text-[13px] leading-6 text-[#F5EEDA] outline-none"
        />
      </div>
    </div>
  );
}

function DiffPanel({ originalContent, draftContent }) {
  const rows = useMemo(
    () => buildDiffRows(originalContent, draftContent),
    [originalContent, draftContent]
  );
  const additions = rows.filter((row) => row.type === "add").length;
  const removals = rows.filter((row) => row.type === "remove").length;
  const changed = originalContent !== draftContent;

  return (
    <ShellPanel
      eyebrow="Exact changes"
      title="Diff Preview"
      actions={
        <div className="flex items-center gap-2 text-xs text-theme-text-secondary">
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-emerald-200">
            +{additions}
          </span>
          <span className="rounded-full border border-red-400/25 bg-red-400/10 px-3 py-1 text-red-200">
            -{removals}
          </span>
        </div>
      }
    >
      {!changed ? (
        <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-5 text-sm leading-7 text-theme-text-secondary">
          No unsaved changes yet. Once you edit the buffer, this panel will show
          the exact before/after line changes.
        </div>
      ) : (
        <div className="max-h-[420px] overflow-auto rounded-[18px] border border-theme-sidebar-border bg-[#0F0F0F]">
          <div className="grid grid-cols-[42px_56px_56px_minmax(0,1fr)] border-b border-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
            <span>op</span>
            <span>old</span>
            <span>new</span>
            <span>content</span>
          </div>
          {rows.map((row, index) => {
            const tone =
              row.type === "add"
                ? "bg-emerald-400/10 text-emerald-100"
                : row.type === "remove"
                  ? "bg-red-400/10 text-red-100"
                  : "bg-transparent text-[#E7DECC]";

            return (
              <div
                key={`${row.type}-${index}-${row.oldLineNumber}-${row.newLineNumber}`}
                className={`grid grid-cols-[42px_56px_56px_minmax(0,1fr)] gap-0 border-b border-white/5 px-4 py-2 font-mono text-xs leading-6 ${tone}`}
              >
                <span>
                  {row.type === "add" ? "+" : row.type === "remove" ? "-" : "·"}
                </span>
                <span>{row.oldLineNumber ?? ""}</span>
                <span>{row.newLineNumber ?? ""}</span>
                <span className="whitespace-pre-wrap break-words">
                  {row.text || " "}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </ShellPanel>
  );
}

export default function MetacanonAIRepoPage() {
  const [repoInfo, setRepoInfo] = useState(null);
  const [fileIndex, setFileIndex] = useState([]);
  const [currentDirectory, setCurrentDirectory] = useState("");
  const [directoryEntries, setDirectoryEntries] = useState([]);
  const [pathInput, setPathInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [originalContent, setOriginalContent] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [loading, setLoading] = useState({
    boot: true,
    directory: true,
    file: false,
    save: false,
  });

  const dirty = selectedFile && draftContent !== originalContent;
  const selectedPath = selectedFile?.relativePath || "";

  const filteredFiles = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];
    return fileIndex
      .filter((entry) => entry.toLowerCase().includes(normalizedQuery))
      .slice(0, 240);
  }, [fileIndex, searchQuery]);

  async function loadDirectory(relativePath = "") {
    setLoading((state) => ({ ...state, directory: true }));
    const response = await MetacanonRepo.children(relativePath);
    if (response.error) {
      showToast(response.error, "error");
      setLoading((state) => ({ ...state, directory: false }));
      return false;
    }
    setCurrentDirectory(response.relativePath || "");
    setDirectoryEntries(response.entries || []);
    setLoading((state) => ({ ...state, directory: false }));
    return true;
  }

  async function openFile(relativePath = "", options = {}) {
    const normalizedPath = normalizeRepoPath(relativePath);
    if (!normalizedPath) return false;

    if (
      dirty &&
      selectedPath &&
      selectedPath !== normalizedPath &&
      !options.force &&
      !window.confirm(
        "You have unsaved changes in the current file. Switch files anyway?"
      )
    ) {
      return false;
    }

    setLoading((state) => ({ ...state, file: true }));
    const response = await MetacanonRepo.file(normalizedPath);

    if (response.error) {
      showToast(response.error, "error");
      setLoading((state) => ({ ...state, file: false }));
      return false;
    }

    setSelectedFile(response);
    setOriginalContent(response.content ?? "");
    setDraftContent(response.content ?? "");
    setPathInput(response.relativePath || normalizedPath);
    await loadDirectory(parentDirectory(response.relativePath));
    setLoading((state) => ({ ...state, file: false }));
    return true;
  }

  async function jumpToPath() {
    const normalizedPath = normalizeRepoPath(pathInput);
    if (!normalizedPath) {
      await loadDirectory("");
      return;
    }

    if (fileIndex.includes(normalizedPath)) {
      await openFile(normalizedPath);
      return;
    }

    const openedDirectory = await loadDirectory(normalizedPath);
    if (!openedDirectory) {
      showToast("That path was not found in the repo index.", "warning");
    }
  }

  async function saveFile() {
    if (!selectedPath) return;
    setLoading((state) => ({ ...state, save: true }));
    const response = await MetacanonRepo.save(selectedPath, draftContent);
    setLoading((state) => ({ ...state, save: false }));

    if (response.error || !response.success) {
      showToast(response.error || "Unable to save file.", "error");
      return;
    }

    setSelectedFile(response.file);
    setOriginalContent(response.file?.content ?? draftContent);
    setDraftContent(response.file?.content ?? draftContent);
    showToast(`${selectedPath} saved.`, "success");
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const [info, indexResponse] = await Promise.all([
        MetacanonRepo.info(),
        MetacanonRepo.index(),
      ]);

      if (cancelled) return;

      if (info.error) {
        showToast(info.error, "error");
      } else {
        setRepoInfo(info);
        setPathInput(info.defaultOpenFile || "");
      }

      if (indexResponse.error) {
        showToast(indexResponse.error, "error");
      } else {
        setFileIndex(indexResponse.files || []);
      }

      await loadDirectory("");

      if (info?.defaultOpenFile) {
        await openFile(info.defaultOpenFile, { force: true });
      }

      if (!cancelled) {
        setLoading((state) => ({ ...state, boot: false }));
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-theme-bg-container flex">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="relative h-full w-full overflow-y-scroll bg-theme-bg-secondary p-4 md:my-[16px] md:ml-[2px] md:mr-[16px] md:rounded-[16px] md:p-0"
      >
        <div className="flex w-full flex-col gap-6 px-1 py-20 md:px-6 md:py-6">
          <section className="rounded-[24px] border border-theme-sidebar-border bg-theme-bg-sidebar px-6 py-6 shadow-[0_16px_48px_rgba(0,0,0,0.18)]">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <MetacanonMark />
                <div className="flex flex-col gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">
                    PrismAI
                  </div>
                  <h1 className="text-2xl font-semibold text-theme-text-primary md:text-[32px]">
                    Repo Lab
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-theme-text-secondary md:text-base">
                    Browse the fork, inspect exact file contents, edit them by
                    hand, and review a line-by-line diff before saving. This is
                    the local collaboration surface for surgical UI and code
                    changes.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:min-w-[420px] md:grid-cols-3">
                <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
                    Repo Root
                  </div>
                  <div className="mt-2 text-sm font-semibold text-theme-text-primary break-all">
                    {repoInfo?.root || "Loading..."}
                  </div>
                </div>
                <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
                    Indexed Files
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-theme-text-primary">
                    {fileIndex.length}
                  </div>
                </div>
                <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
                    Current File
                  </div>
                  <div className="mt-2 text-sm font-semibold text-theme-text-primary">
                    {selectedPath ? basename(selectedPath) : "None selected"}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="flex flex-col gap-6">
              <ShellPanel
                eyebrow="Browse"
                title="Navigator"
                actions={
                  <Link
                    to={paths.metacanonAI()}
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-primary-button"
                  >
                    Back to features
                  </Link>
                }
              >
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
                    Search files
                  </label>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="frontend/src/pages/..."
                    className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-3 text-sm text-theme-text-primary outline-none transition-all focus:border-theme-primary-button"
                  />
                  <label className="pt-2 text-xs font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">
                    Open exact path
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={pathInput}
                      onChange={(event) => setPathInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") jumpToPath();
                      }}
                      placeholder="frontend/src/main.jsx"
                      className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-3 text-sm text-theme-text-primary outline-none transition-all focus:border-theme-primary-button"
                    />
                    <button
                      type="button"
                      onClick={jumpToPath}
                      className="rounded-[14px] border border-theme-primary-button bg-theme-sidebar-footer-icon px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-theme-text-primary"
                    >
                      Open
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <Breadcrumbs
                    currentDirectory={currentDirectory}
                    onSelect={(relativePath) => loadDirectory(relativePath)}
                  />
                </div>

                <div className="mt-5 flex max-h-[560px] flex-col gap-2 overflow-auto">
                  {searchQuery.trim() ? (
                    filteredFiles.length > 0 ? (
                      filteredFiles.map((relativePath) => (
                        <RepoEntryRow
                          key={relativePath}
                          active={selectedPath === relativePath}
                          prefix="HIT"
                          entry={{
                            name: basename(relativePath),
                            relativePath,
                            isDirectory: false,
                          }}
                          onClick={() => openFile(relativePath)}
                        />
                      ))
                    ) : (
                      <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-5 text-sm leading-7 text-theme-text-secondary">
                        No files matched that search.
                      </div>
                    )
                  ) : loading.directory ? (
                    <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-5 text-sm leading-7 text-theme-text-secondary">
                      Loading directory...
                    </div>
                  ) : (
                    <>
                      {currentDirectory ? (
                        <RepoEntryRow
                          entry={{
                            name: "..",
                            relativePath: parentDirectory(currentDirectory),
                            isDirectory: true,
                          }}
                          prefix="UP"
                          onClick={() =>
                            loadDirectory(parentDirectory(currentDirectory))
                          }
                        />
                      ) : null}
                      {directoryEntries.map((entry) => (
                        <RepoEntryRow
                          key={entry.relativePath}
                          entry={entry}
                          active={selectedPath === entry.relativePath}
                          onClick={() =>
                            entry.isDirectory
                              ? loadDirectory(entry.relativePath)
                              : openFile(entry.relativePath)
                          }
                        />
                      ))}
                    </>
                  )}
                </div>
              </ShellPanel>
            </div>

            <div className="flex flex-col gap-6">
              <ShellPanel
                eyebrow="Inspect and edit"
                title={selectedPath || "Select a file to begin"}
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedFile?.absolutePath ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await window.navigator.clipboard.writeText(
                            selectedFile.absolutePath
                          );
                          showToast("Absolute path copied.", "success");
                        }}
                        className="rounded-full border border-theme-sidebar-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-theme-text-secondary hover:border-theme-primary-button hover:text-theme-text-primary"
                      >
                        Copy path
                      </button>
                    ) : null}
                    {selectedPath ? (
                      <button
                        type="button"
                        onClick={() => openFile(selectedPath, { force: true })}
                        className="rounded-full border border-theme-sidebar-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-theme-text-secondary hover:border-theme-primary-button hover:text-theme-text-primary"
                      >
                        Reload
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={!dirty}
                      onClick={() => setDraftContent(originalContent)}
                      className="rounded-full border border-theme-sidebar-border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-theme-text-secondary disabled:cursor-not-allowed disabled:opacity-40 hover:border-theme-primary-button hover:text-theme-text-primary"
                    >
                      Revert
                    </button>
                    <button
                      type="button"
                      disabled={!dirty || !selectedPath || loading.save}
                      onClick={saveFile}
                      className="rounded-full border border-theme-primary-button bg-theme-sidebar-footer-icon px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-theme-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading.save ? "Saving..." : "Save file"}
                    </button>
                  </div>
                }
              >
                {!selectedFile ? (
                  <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-5 text-sm leading-7 text-theme-text-secondary">
                    Pick a file from the navigator to inspect it. The editor
                    always shows the exact text from disk, and the diff panel
                    below will show each unsaved change line by line.
                  </div>
                ) : selectedFile.isBinary ? (
                  <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-5 text-sm leading-7 text-theme-text-secondary">
                    This file looks binary, so Repo Lab will not open it in the
                    editor.
                  </div>
                ) : selectedFile.tooLarge ? (
                  <div className="rounded-[18px] border border-theme-sidebar-border bg-theme-bg-container px-4 py-5 text-sm leading-7 text-theme-text-secondary">
                    This file is {formatBytes(selectedFile.size)}, which is over
                    the Repo Lab text limit of{" "}
                    {formatBytes(selectedFile.maxTextFileBytes)}.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-theme-text-secondary">
                      <span className="rounded-full border border-theme-sidebar-border px-3 py-1">
                        {formatBytes(selectedFile.size)}
                      </span>
                      <span className="rounded-full border border-theme-sidebar-border px-3 py-1">
                        {draftContent.split("\n").length} lines
                      </span>
                      <span className="rounded-full border border-theme-sidebar-border px-3 py-1">
                        {dirty ? "Unsaved changes" : "Clean buffer"}
                      </span>
                    </div>
                    <CodeEditor
                      value={draftContent}
                      onChange={(value) => setDraftContent(value)}
                    />
                  </div>
                )}
              </ShellPanel>

              <DiffPanel
                originalContent={originalContent}
                draftContent={draftContent}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
