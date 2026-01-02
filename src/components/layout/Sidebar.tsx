import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Logo, LogoIcon } from "@/components/ui/Logo";
import clsx from "clsx";

const APP_VERSION = "1.0.0";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  userEmail?: string;
}

export function Sidebar({
  isCollapsed,
  onToggle,
  userEmail,
}: SidebarProps) {
  const location = useLocation();
  const boards = useQuery(api.boards.list, userEmail ? { userEmail } : "skip");

  const isActive = (path: string) => location.pathname === path;
  const isBoardActive = (boardId: string) =>
    location.pathname.startsWith(`/boards/${boardId}`);

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-screen bg-dark-surface border-r border-dark-border flex flex-col z-40 transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header with Logo */}
      <div className={clsx(
        "h-14 flex items-center border-b border-dark-border",
        isCollapsed ? "justify-center px-2" : "justify-between px-3"
      )}>
        {!isCollapsed && (
          <Link to="/boards" className="flex items-center gap-2 overflow-hidden">
            <Logo size="sm" showText={true} />
          </Link>
        )}
        <button
          onClick={onToggle}
          className={clsx(
            "p-2 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-dark-text transition-colors",
            isCollapsed && "mx-auto"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className={clsx(
              "w-5 h-5 transition-transform",
              isCollapsed && "rotate-180"
            )}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {/* Boards Section */}
        <div className="px-3 mb-4">
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2 px-2">
              Boards
            </h3>
          )}
          <div className="space-y-1">
            {boards?.filter((b): b is NonNullable<typeof b> => b !== null).map((board) => (
              <Link
                key={board._id}
                to="/boards/$boardId"
                params={{ boardId: board._id }}
                className={clsx(
                  "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors",
                  isBoardActive(board._id)
                    ? "bg-accent/20 text-accent"
                    : "text-dark-muted hover:bg-dark-hover hover:text-dark-text"
                )}
                title={isCollapsed ? board.name : undefined}
              >
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                    />
                  </svg>
                </span>
                {!isCollapsed && (
                  <span className="truncate text-sm">{board.name}</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-dark-border mx-3 my-2" />

        {/* Settings Section */}
        <div className="px-3">
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2 px-2">
              Settings
            </h3>
          )}
          <div className="space-y-1">
            <Link
              to="/profile"
              className={clsx(
                "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors",
                isActive("/profile")
                  ? "bg-accent/20 text-accent"
                  : "text-dark-muted hover:bg-dark-hover hover:text-dark-text"
              )}
              title={isCollapsed ? "Profile Settings" : undefined}
            >
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </span>
              {!isCollapsed && <span className="text-sm">Settings</span>}
            </Link>
          </div>
        </div>
      </nav>

      {/* App Info Footer */}
      <div className={clsx(
        "border-t border-dark-border p-3",
        isCollapsed ? "text-center" : ""
      )}>
        {!isCollapsed ? (
          <div className="text-xs text-dark-muted">
            <p className="font-medium text-dark-muted/70">bProductive</p>
            <p>Kanban Board v{APP_VERSION}</p>
          </div>
        ) : (
          <p className="text-[10px] text-dark-muted/50">v{APP_VERSION}</p>
        )}
      </div>
    </aside>
  );
}

// Mobile sidebar overlay
export function MobileSidebar({
  isOpen,
  onClose,
  userEmail,
}: {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-dark-surface border-r border-dark-border flex flex-col z-50 lg:hidden animate-slide-in-left">
        <Sidebar
          isCollapsed={false}
          onToggle={onClose}
          userEmail={userEmail}
        />
      </aside>
    </>
  );
}

// Menu button for mobile
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-dark-text transition-colors"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
  );
}
