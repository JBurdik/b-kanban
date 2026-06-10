import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { Logo } from "@/components/ui/Logo";
import { BoardIcon } from "@/components/BoardIcon";
import clsx from "clsx";

const APP_VERSION = "1.0.0";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  userEmail?: string;
}

export function Sidebar({ isCollapsed, onToggle, userEmail }: SidebarProps) {
  const location = useLocation();
  const boards = useQuery(api.boards.list, userEmail ? { userEmail } : "skip");

  const isActive = (path: string) => location.pathname === path;
  const isBoardActive = (boardId: string) =>
    location.pathname.startsWith(`/boards/${boardId}`);

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 h-screen bg-dark-surface border-r border-dark-border flex flex-col z-40 transition-all duration-300 pt-safe pb-safe",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header with Logo */}
      <div
        className={clsx(
          "h-14 flex items-center border-b border-dark-border",
          isCollapsed ? "justify-center px-2" : "justify-between px-3",
        )}
      >
        {!isCollapsed && (
          <Link
            to="/boards"
            className="flex items-center gap-2 overflow-hidden"
          >
            <Logo size="sm" showText={true} />
          </Link>
        )}
        <button
          onClick={onToggle}
          className={clsx(
            "p-2 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-dark-text transition-colors",
            isCollapsed && "mx-auto",
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            className={clsx(
              "w-5 h-5 transition-transform",
              isCollapsed && "rotate-180",
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
            {boards
              ?.filter((b): b is NonNullable<typeof b> => b !== null)
              .map((board) => (
                <div key={board._id}>
                  <Link
                    to="/boards/$boardId"
                    params={{ boardId: board._id }}
                    className={clsx(
                      "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors",
                      isBoardActive(board._id)
                        ? "bg-accent/20 text-accent"
                        : "text-dark-muted hover:bg-dark-hover hover:text-dark-text",
                    )}
                    title={isCollapsed ? board.name : undefined}
                  >
                    <BoardIcon
                      board={{
                        name: board.name,
                        iconType: board.iconType,
                        iconEmoji: board.iconEmoji,
                        iconUrl: board.iconUrl,
                      }}
                      size="xs"
                      className="flex-shrink-0"
                    />
                    {!isCollapsed && (
                      <span className="truncate text-sm">{board.name}</span>
                    )}
                  </Link>
                  {/* Nested board links - only show when board is active and sidebar is expanded */}
                  {isBoardActive(board._id) && !isCollapsed && (
                    <div className="ml-7 mt-1 space-y-1">
                      {/* Documents link */}
                      <Link
                        to="/boards/$boardId/docs"
                        params={{ boardId: board._id }}
                        className={clsx(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          location.pathname.includes(
                            `/boards/${board._id}/docs`,
                          )
                            ? "bg-accent/10 text-accent"
                            : "text-dark-muted hover:bg-dark-hover hover:text-dark-text",
                        )}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <span>Documents</span>
                      </Link>
                      {/* HTML Docs link */}
                      <Link
                        to="/boards/$boardId/htmldocs"
                        params={{ boardId: board._id }}
                        className={clsx(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          location.pathname.includes(
                            `/boards/${board._id}/htmldocs`,
                          )
                            ? "bg-accent/10 text-accent"
                            : "text-dark-muted hover:bg-dark-hover hover:text-dark-text",
                        )}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                        <span>HTML Docs</span>
                      </Link>
                      {/* Secrets link */}
                      <Link
                        to="/boards/$boardId/secrets"
                        params={{ boardId: board._id }}
                        className={clsx(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          location.pathname === `/boards/${board._id}/secrets`
                            ? "bg-accent/10 text-accent"
                            : "text-dark-muted hover:bg-dark-hover hover:text-dark-text",
                        )}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                          />
                        </svg>
                        <span>Secrets</span>
                      </Link>
                      {/* Webhooks link */}
                      <Link
                        to="/boards/$boardId/webhooks"
                        params={{ boardId: board._id }}
                        className={clsx(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          location.pathname === `/boards/${board._id}/webhooks`
                            ? "bg-accent/10 text-accent"
                            : "text-dark-muted hover:bg-dark-hover hover:text-dark-text",
                        )}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                          />
                        </svg>
                        <span>Webhooks</span>
                      </Link>
                      {/* Archive link */}
                      <Link
                        to="/boards/$boardId/archive"
                        params={{ boardId: board._id }}
                        className={clsx(
                          "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          location.pathname === `/boards/${board._id}/archive`
                            ? "bg-accent/10 text-accent"
                            : "text-dark-muted hover:bg-dark-hover hover:text-dark-text",
                        )}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                          />
                        </svg>
                        <span>Archive</span>
                      </Link>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-dark-border mx-3 my-2" />

        {/* Tools Section */}
        <div className="px-3 mb-4">
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-dark-muted uppercase tracking-wider mb-2 px-2">
              Tools
            </h3>
          )}
          <div className="space-y-1">
            <Link
              to="/time"
              className={clsx(
                "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors",
                isActive("/time")
                  ? "bg-accent/20 text-accent"
                  : "text-dark-muted hover:bg-dark-hover hover:text-dark-text",
              )}
              title={isCollapsed ? "Time Tracking" : undefined}
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              {!isCollapsed && <span className="text-sm">Time Tracking</span>}
            </Link>
          </div>
        </div>
      </nav>

      {/* App Info Footer */}
      <div
        className={clsx(
          "border-t border-dark-border p-3",
          isCollapsed ? "text-center" : "",
        )}
      >
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
        <Sidebar isCollapsed={false} onToggle={onClose} userEmail={userEmail} />
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
