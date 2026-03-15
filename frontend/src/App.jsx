import React, { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { AuthProvider } from "@/AuthContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import i18n from "./i18n";

import { PfpProvider } from "./PfpContext";
import { LogoProvider } from "./LogoContext";
import { FullScreenLoader } from "./components/Preloader";
import { ThemeProvider } from "./ThemeContext";
import { PWAModeProvider } from "./PWAContext";
import KeyboardShortcutsHelp from "@/components/KeyboardShortcutsHelp";
import { ErrorBoundary } from "react-error-boundary";
import ErrorBoundaryFallback from "./components/ErrorBoundaryFallback";
import { PrismProvider } from "./PrismContext";
import { signalPrismError } from "@/utils/prism/events";

export default function App() {
  const location = useLocation();
  return (
    <ErrorBoundary
      FallbackComponent={ErrorBoundaryFallback}
      onError={(error) => {
        console.error(error);
        signalPrismError({ source: "error-boundary", message: error?.message });
      }}
      resetKeys={[location.pathname]}
    >
      <ThemeProvider>
        <PWAModeProvider>
          <PrismProvider>
            <Suspense fallback={<FullScreenLoader />}>
              <AuthProvider>
                <LogoProvider>
                  <PfpProvider>
                    <I18nextProvider i18n={i18n}>
                      <div className="prism-app-shell">
                        <div
                          className="prism-app-ambient prism-app-ambient--left"
                          aria-hidden="true"
                        />
                        <div
                          className="prism-app-ambient prism-app-ambient--right"
                          aria-hidden="true"
                        />
                        <div className="prism-app-grid" aria-hidden="true" />
                        <div className="prism-app-content">
                          <Outlet />
                          <ToastContainer />
                          <KeyboardShortcutsHelp />
                        </div>
                      </div>
                    </I18nextProvider>
                  </PfpProvider>
                </LogoProvider>
              </AuthProvider>
            </Suspense>
          </PrismProvider>
        </PWAModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
