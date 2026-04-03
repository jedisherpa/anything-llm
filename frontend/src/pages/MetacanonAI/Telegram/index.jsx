import { useState } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import { TelegramLogo } from "@phosphor-icons/react/dist/csr/TelegramLogo";
import { Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { Trash } from "@phosphor-icons/react/dist/csr/Trash";

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-theme-text-primary">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-all ${
          checked ? "bg-theme-primary-button" : "bg-theme-sidebar-border"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

export default function TelegramPage() {
  const [botToken, setBotToken] = useState("");
  const [chatIds, setChatIds] = useState([]);
  const [newChatId, setNewChatId] = useState("");
  const [threadMode, setThreadMode] = useState(false);
  const [autoReply, setAutoReply] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [useWebhook, setUseWebhook] = useState(false);
  const [proofLinkFormat, setProofLinkFormat] = useState("https://t.me/c/{chat_id}/{message_id}");
  const [testStatus, setTestStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const addChatId = () => {
    if (!newChatId.trim() || chatIds.includes(newChatId.trim())) return;
    setChatIds(prev => [...prev, newChatId.trim()]);
    setNewChatId("");
  };

  const removeChatId = (id) => {
    setChatIds(prev => prev.filter(c => c !== id));
  };

  const testConnection = () => {
    if (!botToken.trim()) {
      setTestStatus({ success: false, message: "Bot token is required." });
      return;
    }
    setTestStatus({ success: true, message: "Connection test simulated. In production, this validates the bot token against the Telegram API." });
  };

  const saveConfig = () => {
    setSaving(true);
    // Simulate save — replace with Tauri update_telegram_integration call
    setTimeout(() => {
      setSaving(false);
      setTestStatus({ success: true, message: "Configuration saved." });
    }, 500);
  };

  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:px-6 md:py-6 py-20 gap-6 max-w-2xl">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">PrismAI</div>
            <div className="flex items-center gap-3 mt-1">
              <TelegramLogo className="h-7 w-7 text-theme-text-primary" />
              <h1 className="text-2xl font-semibold text-theme-text-primary">Telegram Bot</h1>
            </div>
            <p className="text-sm text-theme-text-secondary mt-2">
              Configure the Telegram bot integration for agent messaging, proof links, and webhook delivery.
            </p>
          </div>

          {/* Bot Token */}
          <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6 flex flex-col gap-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary">Bot Configuration</h2>

            <div>
              <label className="text-xs font-medium text-theme-text-secondary block mb-1">Bot Token</label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2.5 text-sm text-theme-text-primary font-mono focus:outline-none focus:border-theme-primary-button/50"
              />
            </div>

            {/* Allowed Chat IDs */}
            <div>
              <label className="text-xs font-medium text-theme-text-secondary block mb-1">Allowed Chat IDs</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newChatId}
                  onChange={(e) => setNewChatId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addChatId()}
                  placeholder="-1001234567890"
                  className="flex-1 rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2 text-sm text-theme-text-primary font-mono focus:outline-none focus:border-theme-primary-button/50"
                />
                <button
                  onClick={addChatId}
                  className="rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-3 py-2 text-theme-text-secondary hover:text-theme-text-primary transition-all"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {chatIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {chatIds.map((id) => (
                    <span key={id} className="flex items-center gap-1 rounded-full border border-theme-sidebar-border bg-theme-settings-input-bg px-3 py-1 text-xs font-mono text-theme-text-secondary">
                      {id}
                      <button onClick={() => removeChatId(id)} className="text-theme-text-secondary hover:text-red-400">
                        <Trash className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <ToggleSwitch checked={threadMode} onChange={setThreadMode} label="Thread Mode" />
              <ToggleSwitch checked={autoReply} onChange={setAutoReply} label="Auto Reply" />
              <ToggleSwitch checked={useWebhook} onChange={setUseWebhook} label="Use Webhook" />
            </div>

            {useWebhook && (
              <div>
                <label className="text-xs font-medium text-theme-text-secondary block mb-1">Webhook URL</label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://your-domain.com/webhook/telegram"
                  className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2.5 text-sm text-theme-text-primary focus:outline-none focus:border-theme-primary-button/50"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-theme-text-secondary block mb-1">Proof Link Format</label>
              <input
                type="text"
                value={proofLinkFormat}
                onChange={(e) => setProofLinkFormat(e.target.value)}
                className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2.5 text-sm text-theme-text-primary font-mono focus:outline-none focus:border-theme-primary-button/50"
              />
              <p className="text-[10px] text-theme-text-secondary mt-1">
                Variables: {"{chat_id}"}, {"{message_id}"}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={saveConfig}
              disabled={saving}
              className="rounded-[14px] bg-theme-primary-button px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
            <button
              onClick={testConnection}
              className="rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2.5 text-sm font-medium text-theme-text-primary hover:bg-theme-action-menu-item-hover transition-all"
            >
              Test Connection
            </button>
          </div>

          {testStatus && (
            <div className={`rounded-[14px] border px-4 py-3 text-sm ${
              testStatus.success
                ? "border-green-500/20 bg-green-500/10 text-green-400"
                : "border-red-500/20 bg-red-500/10 text-red-400"
            }`}>
              {testStatus.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
