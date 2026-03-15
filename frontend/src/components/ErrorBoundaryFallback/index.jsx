import { NavLink } from "react-router-dom";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { ArrowClockwise } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { Copy } from "@phosphor-icons/react/dist/csr/Copy";
import { Check } from "@phosphor-icons/react/dist/csr/Check";

import { useState } from "react";

export default function ErrorBoundaryFallback({ error, resetErrorBoundary }) {
  const [copied, setCopied] = useState(false);

  const copyErrorDetails = async () => {
    const details = {
      url: window.location.href,
      error: error?.name || "Unknown Error",
      message: error?.message || "No message available",
      stack: error?.stack || "No stack trace available",
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    const formattedDetails = `
Error Report
============
Timestamp: ${details.timestamp}
URL: ${details.url}
User Agent: ${details.userAgent}

Error: ${details.error}
Message: ${details.message}

Stack Trace:
${details.stack}
    `.trim();

    try {
      await navigator.clipboard.writeText(formattedDetails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy error details:", err);
    }
  };

  return (
    <div className="prism-auth-shell min-h-screen w-full">
      <div className="prism-auth-panel w-full max-w-4xl">
        <div className="prism-auth-brand items-start text-left">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--gold-text)]">
            Prism Recovery
          </p>
          <div className="space-y-3">
            <h1 className="text-2xl md:text-3xl font-semibold text-theme-text-primary">
              Prism hit an unexpected error
            </h1>
            <p className="text-theme-text-secondary text-sm md:text-base max-w-2xl">
              {error?.message ||
                "Something went wrong while rendering this view."}
            </p>
          </div>
        </div>
        {import.meta.env.DEV && (
          <div className="w-full mt-6">
            <div className="flex justify-end mb-3">
              <button
                onClick={copyErrorDetails}
                className="flex items-center gap-2 px-3 py-1.5 bg-theme-bg-secondary text-theme-text-primary rounded-lg hover:bg-theme-sidebar-item-hover transition-all duration-200 text-xs font-medium"
                title="Copy error details"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" weight="bold" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy Details
                  </>
                )}
              </button>
            </div>
            <pre className="w-full text-xs md:text-sm text-theme-text-secondary bg-theme-bg-secondary/80 p-4 md:p-6 rounded-[20px] overflow-x-auto overflow-y-auto max-h-[60vh] md:max-h-[70vh] whitespace-pre-wrap break-words font-mono border border-theme-border shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              {error?.stack}
            </pre>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3 md:gap-4 mt-8 w-full md:w-auto">
          <button
            onClick={resetErrorBoundary}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-theme-bg-secondary text-theme-text-primary rounded-lg hover:bg-theme-sidebar-item-hover transition-all duration-300 w-full md:w-auto"
          >
            <ArrowClockwise className="w-4 h-4" />
            Reset
          </button>
          <NavLink
            to="/"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-theme-bg-secondary text-theme-text-primary rounded-lg hover:bg-theme-sidebar-item-hover transition-all duration-300 w-full md:w-auto"
          >
            <House className="w-4 h-4" />
            Home
          </NavLink>
        </div>
      </div>
    </div>
  );
}
