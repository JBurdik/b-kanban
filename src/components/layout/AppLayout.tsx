import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { Sidebar, MobileSidebar, MobileMenuButton } from "./Sidebar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { NotificationBell } from "@/components/NotificationBell";
import { UserDropdown } from "@/components/UserDropdown";
import clsx from "clsx";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { data: session } = useSession();
  const { isCollapsed, isMobileOpen, toggle, toggleMobile, closeMobile } =
    useSidebarState();

  // Fetch user from Convex to get updated avatar
  const convexUser = useQuery(
    api.users.getByEmail,
    session?.user?.email ? { email: session.user.email } : "skip"
  );

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
          userEmail={userEmail}
        />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={isMobileOpen}
        onClose={closeMobile}
        userEmail={userEmail}
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
        <div className="h-14 border-b border-dark-border flex items-center justify-between px-4 sticky top-0 bg-dark-bg z-30">
          {/* Left: Mobile menu button */}
          <div className="lg:hidden">
            <MobileMenuButton onClick={toggleMobile} />
          </div>
          <div className="hidden lg:block" />

          {/* Right: Notifications and User */}
          <div className="flex items-center gap-2">
            <NotificationBell userEmail={userEmail} />
            <UserDropdown
              userName={userName}
              userEmail={userEmail}
              userImage={userImage ?? undefined}
              userId={userId}
            />
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
