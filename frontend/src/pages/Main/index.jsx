import React from "react";
import PasswordModal, { usePasswordModal } from "@/components/Modals/Password";
import { FullScreenLoader } from "@/components/Preloader";
import Home from "./Home";
import { isMobile } from "react-device-detect";
import Sidebar, { SidebarMobileHeader } from "@/components/Sidebar";
import MetacanonAmbient from "@/components/Metacanon/Ambient";

export default function Main() {
  const { loading, requiresAuth, mode } = usePasswordModal();

  if (loading) return <FullScreenLoader />;
  if (requiresAuth !== false)
    return <>{requiresAuth !== null && <PasswordModal mode={mode} />}</>;

  return (
    <div className="metacanon-shell-root w-screen h-screen overflow-hidden flex">
      <MetacanonAmbient />
      {!isMobile ? (
        <div className="relative z-10 h-full">
          <Sidebar />
        </div>
      ) : (
        <SidebarMobileHeader />
      )}
      <div className="relative z-10 flex-1 min-w-0">
        <Home />
      </div>
    </div>
  );
}
