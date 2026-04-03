import { useState, useEffect } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import { File } from "@phosphor-icons/react/dist/csr/File";
import { Folder } from "@phosphor-icons/react/dist/csr/Folder";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";

function FileRow({ entry, onSelect }) {
  return (
    <button
      onClick={() => onSelect(entry)}
      className="w-full flex items-center justify-between rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-3 hover:bg-theme-action-menu-item-hover transition-all text-left"
    >
      <div className="flex items-center gap-3">
        {entry.is_dir ? (
          <Folder className="h-4 w-4 text-theme-primary-button" />
        ) : (
          <File className="h-4 w-4 text-theme-text-secondary" />
        )}
        <span className="text-sm font-medium text-theme-text-primary">{entry.name}</span>
      </div>
      <span className="text-xs text-theme-text-secondary">
        {entry.is_dir ? "Directory" : `${(entry.size_bytes / 1024).toFixed(1)} KB`}
      </span>
    </button>
  );
}

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [loading, setLoading] = useState(true);

  const loadFiles = () => {
    setLoading(true);
    // Simulate file listing — replace with MCP file_list call
    setTimeout(() => {
      setFiles([
        { name: "agent_report.md", is_dir: false, size_bytes: 2048 },
        { name: "analysis_output.json", is_dir: false, size_bytes: 4096 },
        { name: "session_logs", is_dir: true, size_bytes: 0 },
      ]);
      setLoading(false);
    }, 400);
  };

  useEffect(() => { loadFiles(); }, []);

  const selectFile = (entry) => {
    if (entry.is_dir) return;
    setSelectedFile(entry);
    // Simulate file read — replace with MCP file_read call
    setFileContent(`# ${entry.name}\n\nFile content loaded from agent sandbox.\nSize: ${entry.size_bytes} bytes\n\nIn production, this reads from ~/.metacanon_ai/agent_files/ via the MCP file_read tool.`);
  };

  const createFile = () => {
    if (!newFileName.trim()) return;
    // Simulate file write — replace with MCP file_write call
    setFiles(prev => [...prev, { name: newFileName, is_dir: false, size_bytes: newFileContent.length }]);
    setShowCreate(false);
    setNewFileName("");
    setNewFileContent("");
  };

  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:px-6 md:py-6 py-20 gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">
                PrismAI
              </div>
              <h1 className="text-2xl font-semibold text-theme-text-primary mt-1">
                Agent Files
              </h1>
              <p className="text-sm text-theme-text-secondary mt-2">
                Browse and manage files in the agent sandbox at <code className="font-mono text-theme-text-primary bg-theme-settings-input-bg px-1 py-0.5 rounded text-xs">~/.metacanon_ai/agent_files</code>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-[14px] bg-theme-primary-button px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-all flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> New File
              </button>
              <button
                onClick={loadFiles}
                className="rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-3 py-2 text-theme-text-secondary hover:text-theme-text-primary transition-all"
              >
                <ArrowsClockwise className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* File List */}
            <div className="xl:col-span-1 rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-4 flex flex-col gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary mb-2">
                Files ({files.length})
              </h2>
              {loading ? (
                <p className="text-sm text-theme-text-secondary">Loading...</p>
              ) : files.length === 0 ? (
                <p className="text-sm text-theme-text-secondary">No files in sandbox.</p>
              ) : (
                files.map((entry) => (
                  <FileRow key={entry.name} entry={entry} onSelect={selectFile} />
                ))
              )}
            </div>

            {/* File Preview */}
            <div className="xl:col-span-2 rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6">
              {selectedFile ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-theme-text-primary">{selectedFile.name}</h2>
                    <button className="text-theme-text-secondary hover:text-red-400 transition-all">
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                  <pre className="text-sm text-theme-text-secondary font-mono bg-theme-settings-input-bg rounded-[14px] border border-theme-sidebar-border p-4 whitespace-pre-wrap overflow-auto max-h-[60vh]">
                    {fileContent}
                  </pre>
                </>
              ) : (
                <div className="flex items-center justify-center h-48 text-sm text-theme-text-secondary">
                  Select a file to preview
                </div>
              )}
            </div>
          </div>

          {/* Create File Modal */}
          {showCreate && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="rounded-[20px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6 w-full max-w-lg shadow-[0_28px_72px_rgba(0,0,0,0.32)]">
                <h2 className="text-lg font-semibold text-theme-text-primary mb-4">New File</h2>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="filename.txt"
                  className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2.5 text-sm text-theme-text-primary mb-3 focus:outline-none focus:border-theme-primary-button/50"
                />
                <textarea
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  placeholder="File content..."
                  rows={6}
                  className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2.5 text-sm text-theme-text-primary font-mono mb-4 focus:outline-none focus:border-theme-primary-button/50 resize-none"
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="rounded-[14px] border border-theme-sidebar-border px-4 py-2 text-sm text-theme-text-secondary hover:text-theme-text-primary transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createFile}
                    disabled={!newFileName.trim()}
                    className="rounded-[14px] bg-theme-primary-button px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-40"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
