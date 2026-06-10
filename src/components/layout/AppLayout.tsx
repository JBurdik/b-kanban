import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { Sidebar, MobileSidebar, MobileMenuButton } from "./Sidebar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { NotificationBell } from "@/components/NotificationBell";
import { UserDropdown } from "@/components/UserDropdown";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { useAutoUpdater } from "@/hooks/useAutoUpdater";
import clsx from "clsx";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { data: session } = useSession();
  const { isCollapsed, isMobileOpen, toggle, toggleMobile, closeMobile } =
    useSidebarState();
  const { showShortcutsModal, setShowShortcutsModal } = useGlobalShortcuts();
  const { state: updateState, version: updateVersion, installUpdate } = useAutoUpdater();

  // Fetch user from Convex to get updated avatar
  const convexUser = useQuery(api.users.me);

  const userName = convexUser?.name ?? session?.user?.name;
  const userImage = convexUser?.image ?? session?.user?.image;
  const userId = convexUser?.id ?? session?.user?.id;
  const userEmail = session?.user?.email;

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar
          isCollapsed={isCollapsed}
          onToggle={toggle}
        />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={isMobileOpen}
        onClose={closeMobile}
      />

      {/* Main Content */}
      <main
        className={clsx(
          "min-h-screen transition-all duration-300 flex flex-col",
          // On desktop, add margin for sidebar
          isCollapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      >
        {/* Top Bar */}
        <div className="pt-safe border-b border-dark-border sticky top-0 bg-dark-bg z-30">
          <div className="h-14 flex items-center justify-between px-4">
            {/* Left: Mobile menu button */}
            <div className="lg:hidden">
              <MobileMenuButton onClick={toggleMobile} />
            </div>
            <div className="hidden lg:block" />

            {/* Right: Notifications and User */}
            <div className="flex items-center gap-2">
              <NotificationBell />
              <UserDropdown
                userName={userName}
                userEmail={userEmail}
                userImage={userImage ?? undefined}
                userId={userId}
              />
            </div>
          </div>
        </div>

        {/* Update banner */}
        {(updateState === "available" || updateState === "downloading") && (
          <div className="bg-accent/10 border-b border-accent/30 px-4 py-2 flex items-center justify-between gap-4 text-sm">
            <span className="text-accent font-medium">
              {updateState === "downloading"
                ? "Downloading update…"
                : `Update available${updateVersion ? ` (v${updateVersion})` : ""}`}
            </span>
            {updateState === "available" && (
              <button
                onClick={installUpdate}
                className="px-3 py-1 rounded bg-accent text-white text-xs font-medium hover:bg-accent/80 transition-colors"
              >
                Download & Restart
              </button>
            )}
            {updateState === "downloading" && (
              <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full" />
            )}
          </div>
        )}

        {/* Page Content */}
        <div className="flex-1">
          {children}
        </div>
      </main>

      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
