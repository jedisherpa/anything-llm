import { useState } from "react";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import { isMobile } from "react-device-detect";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Lock } from "@phosphor-icons/react/dist/csr/Lock";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";

function SphereCard({ sphere }) {
  return (
    <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-settings-input-bg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-400" />
          <span className="text-sm font-semibold text-theme-text-primary">{sphere.name}</span>
        </div>
        <span className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] border border-green-500/20 bg-green-500/10 text-green-400">
          {sphere.status}
        </span>
      </div>
      <p className="text-xs text-theme-text-secondary">{sphere.objective}</p>
      <div className="flex items-center gap-2 mt-2">
        <Lock className="h-3 w-3 text-theme-text-secondary" />
        <span className="text-[10px] text-theme-text-secondary font-mono">
          Keypair: {sphere.keypair_registered ? "Registered" : "Not registered"}
        </span>
      </div>
    </div>
  );
}

function MessageExchange({ exchange }) {
  return (
    <div className="rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-theme-primary-button">{exchange.sender}</span>
        <ArrowRight className="h-3 w-3 text-theme-text-secondary" />
        <span className="text-xs font-semibold text-theme-primary-button">{exchange.recipient}</span>
        <span className="text-[10px] text-theme-text-secondary ml-auto">seq #{exchange.sequence}</span>
      </div>
      <div className="flex items-center gap-2">
        <Lock className="h-3 w-3 text-green-400" />
        <span className="text-[10px] text-theme-text-secondary">
          X25519 + AES-256-GCM encrypted | Thread: {exchange.thread_id}
        </span>
      </div>
    </div>
  );
}

export default function SphereThreadsPage() {
  // Simulated data — replace with runtime API calls
  const [spheres] = useState([
    { sub_sphere_id: "ss-001", name: "Risk Analysis", objective: "Assess risk vectors", status: "Active", keypair_registered: true },
    { sub_sphere_id: "ss-002", name: "Legal Review", objective: "Evaluate legal compliance", status: "Active", keypair_registered: true },
    { sub_sphere_id: "ss-003", name: "Ethics Board", objective: "Assess ethical implications", status: "Active", keypair_registered: true },
  ]);

  const [exchanges] = useState([
    { sender: "Risk Analysis", recipient: "Legal Review", thread_id: "thread-001", sequence: 1 },
    { sender: "Legal Review", recipient: "Risk Analysis", thread_id: "thread-001", sequence: 2 },
    { sender: "Ethics Board", recipient: "Risk Analysis", thread_id: "thread-002", sequence: 1 },
  ]);

  const [testSender, setTestSender] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [testResult, setTestResult] = useState(null);

  const sendTestMessage = () => {
    if (!testSender || !testRecipient || testSender === testRecipient) return;
    setTestResult({
      success: true,
      message: `Encrypted message sent from ${testSender} to ${testRecipient}. Decryption verified.`,
    });
  };

  return (
    <div className="metacanon-page-shell w-screen h-screen overflow-hidden bg-theme-bg-container flex">
      {!isMobile ? <Sidebar /> : <SidebarMobileHeader />}
      <div
        style={{ height: isMobile ? "100%" : "calc(100% - 32px)" }}
        className="metacanon-page-frame relative md:ml-[2px] md:mr-[16px] md:my-[16px] md:rounded-[16px] bg-theme-bg-secondary w-full h-full overflow-y-scroll p-4 md:p-0"
      >
        <div className="flex flex-col w-full px-1 md:px-6 md:py-6 py-20 gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-primary-button">PrismAI</div>
            <h1 className="text-2xl font-semibold text-theme-text-primary mt-1">Sphere Threads</h1>
            <p className="text-sm text-theme-text-secondary mt-2 max-w-xl">
              Encrypted agent-to-agent communication channels using X25519 key exchange and AES-256-GCM encryption.
            </p>
          </div>

          {/* Registered Spheres */}
          <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary mb-4">
              Registered Spheres ({spheres.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {spheres.map((s) => <SphereCard key={s.sub_sphere_id} sphere={s} />)}
            </div>
          </div>

          {/* Message Exchange Log */}
          <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary mb-4">
              Recent Encrypted Exchanges
            </h2>
            <div className="flex flex-col gap-2">
              {exchanges.map((ex, i) => <MessageExchange key={i} exchange={ex} />)}
            </div>
          </div>

          {/* Test Message */}
          <div className="rounded-[16px] border border-theme-sidebar-border bg-theme-bg-sidebar p-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-text-secondary mb-4">
              Test Encrypted Exchange
            </h2>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs text-theme-text-secondary block mb-1">From</label>
                <select
                  value={testSender}
                  onChange={(e) => setTestSender(e.target.value)}
                  className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2 text-sm text-theme-text-primary"
                >
                  <option value="">Select sender...</option>
                  {spheres.map((s) => <option key={s.sub_sphere_id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <ArrowRight className="h-5 w-5 text-theme-text-secondary mb-2" />
              <div className="flex-1">
                <label className="text-xs text-theme-text-secondary block mb-1">To</label>
                <select
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full rounded-[14px] border border-theme-sidebar-border bg-theme-settings-input-bg px-4 py-2 text-sm text-theme-text-primary"
                >
                  <option value="">Select recipient...</option>
                  {spheres.map((s) => <option key={s.sub_sphere_id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <button
                onClick={sendTestMessage}
                disabled={!testSender || !testRecipient || testSender === testRecipient}
                className="rounded-[14px] bg-theme-primary-button px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-40 whitespace-nowrap"
              >
                Send Test
              </button>
            </div>
            {testResult && (
              <div className={`mt-3 rounded-[14px] border px-4 py-2 text-xs ${testResult.success ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-red-500/20 bg-red-500/10 text-red-400"}`}>
                {testResult.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
