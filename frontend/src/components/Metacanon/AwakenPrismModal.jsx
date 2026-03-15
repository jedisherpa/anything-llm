import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { X } from "@phosphor-icons/react/dist/csr/X";

import ModalWrapper from "@/components/ModalWrapper";
import MobileConnection from "@/models/mobile";
import PreLoader from "@/components/Preloader";
import useLogo from "@/hooks/useLogo";

function getFallbackPairingUrl() {
  if (typeof window === "undefined") return "https://prismai.local/pair";
  return `${window.location.origin}/pair/prism`;
}

function normalizeConnectionUrl(rawUrl = "") {
  const value = String(rawUrl || "").trim();
  if (!value) return getFallbackPairingUrl();
  if (value.startsWith("http")) return value;
  if (typeof window === "undefined") return value;
  return new URL(value, window.location.origin).toString();
}

export default function AwakenPrismModal({
  isOpen = false,
  onClose = () => {},
}) {
  const { logo } = useLogo();
  const [connectionInfo, setConnectionInfo] = useState(getFallbackPairingUrl());
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Use this pairing QR to bring Prism onto your phone after the artifact is awake."
  );

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setStatusMessage(
      "Use this pairing QR to bring Prism onto your phone after the artifact is awake."
    );

    MobileConnection.getConnectionInfo()
      .then((res) => {
        if (cancelled) return;
        const nextUrl = normalizeConnectionUrl(res?.connectionUrl);
        setConnectionInfo(nextUrl);
        if (!res?.connectionUrl) {
          setStatusMessage(
            "Pairing preview is ready. The live QR activates once your local Prism runtime is available."
          );
        }
      })
      .catch(() => {
        if (cancelled) return;
        setConnectionInfo(getFallbackPairingUrl());
        setStatusMessage(
          "Pairing preview is ready. The live QR activates once your local Prism runtime is available."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const qrValue = useMemo(
    () => connectionInfo || getFallbackPairingUrl(),
    [connectionInfo]
  );

  return (
    <ModalWrapper isOpen={isOpen}>
      <div className="metacanon-modal-panel relative w-[min(92vw,720px)] rounded-[28px] px-6 pb-7 pt-6 md:px-8 md:pb-8 md:pt-7">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border-none bg-transparent text-theme-text-secondary transition hover:bg-theme-sidebar-item-hover hover:text-theme-text-primary"
          aria-label="Close awaken prism modal"
        >
          <X size={18} weight="bold" />
        </button>

        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-home-text-secondary">
              Mobile Pairing
            </div>
            <h2 className="mt-3 text-[34px] font-semibold leading-[1.02] text-theme-text-primary md:text-[42px]">
              Awaken Prism
            </h2>
            <p className="mt-4 text-[15px] leading-7 text-theme-text-secondary">
              {statusMessage}
            </p>
            <div className="mt-5 rounded-[20px] border border-theme-sidebar-border bg-theme-sidebar-item-default px-4 py-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-theme-home-text-secondary">
                What happens next
              </div>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-6 text-theme-text-secondary">
                <li>Finish waking Prism on this device.</li>
                <li>Open the mobile artifact and scan this QR.</li>
                <li>
                  Your workspace and active Lens alignment become portable.
                </li>
              </ol>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-4">
            <div className="flex h-[300px] w-[300px] items-center justify-center rounded-[28px] border border-theme-sidebar-border bg-theme-sidebar-item-default shadow-[0_24px_54px_rgba(0,0,0,0.22)]">
              {loading ? (
                <PreLoader size="[88px]" />
              ) : (
                <QRCodeSVG
                  value={qrValue}
                  size={248}
                  bgColor="transparent"
                  fgColor="currentColor"
                  className="text-theme-text-primary"
                  level="M"
                  imageSettings={{
                    src: logo,
                    height: 44,
                    width: 44,
                    excavate: true,
                  }}
                />
              )}
            </div>
            <div className="max-w-[300px] break-all text-center text-[12px] leading-6 text-theme-text-secondary">
              {qrValue}
            </div>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}
