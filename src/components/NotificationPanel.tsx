import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { NotificationItem, type NotificationData, type NotificationType } from "./NotificationItem";
import clsx from "clsx";

interface Props {
  userEmail: string;
  onClose: () => void;
}

const filterOptions: { label: string; value: NotificationType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Assigned", value: "assigned" },
  { label: "Mentioned", value: "mentioned" },
  { label: "Comments", value: "commented" },
  { label: "Updates", value: "card_updated" },
];

export function NotificationPanel({ userEmail, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<NotificationType | "all">("all");
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  const notifications = useQuery(api.notifications.list, {
    userEmail,
    limit: 30,
    ...(activeFilter !== "all" ? { type: activeFilter } : {}),
  });

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Close with animation
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Focus trap
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const focusableSelector = 'a, button, input, [tabindex]:not([tabindex="-1"])';
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = panel.querySelectorAll(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    // Focus first focusable element
    const firstFocusable = panel.querySelector(focusableSelector) as HTMLElement;
    firstFocusable?.focus();

    return () => document.removeEventListener("keydown", handleTab);
  }, []);

  const hasUnread = notifications?.some((n: NotificationData) => !n.read);

  const handleViewAll = () => {
    handleClose();
    navigate({ to: "/notifications" });
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={clsx(
          "absolute inset-0 bg-black/30 transition-opacity duration-200",
          isVisible ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={clsx(
          "absolute right-0 top-0 bottom-0 w-[440px] max-w-full bg-dark-surface border-l border-dark-border shadow-2xl flex flex-col transition-transform duration-200 ease-out pb-safe",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-dark-border">
          <h2 className="text-lg font-semibold text-dark-text">Notifications</h2>
          <div className="flex items-center gap-3">
            {hasUnread && (
              <button
                onClick={() => markAllAsRead({ userEmail })}
                className="text-xs text-accent hover:text-accent/80 transition-colors"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={handleViewAll}
              className="text-xs text-dark-muted hover:text-dark-text transition-colors"
            >
              View all
            </button>
            <button
              onClick={handleClose}
              className="text-dark-muted hover:text-dark-text transition-colors p-1 rounded hover:bg-dark-hover"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-dark-border overflow-x-auto">
          {filterOptions.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={clsx(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                activeFilter === filter.value
                  ? "bg-accent text-white"
                  : "bg-dark-hover text-dark-muted hover:text-dark-text"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {notifications === undefined ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-dark-muted/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <p className="text-dark-muted text-sm">
                {activeFilter === "all" ? "You're all caught up!" : `No ${activeFilter} notifications`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-dark-border">
              {notifications.map((notification: NotificationData) => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  onMarkAsRead={(id) => markAsRead({ notificationId: id })}
                  onNavigate={handleClose}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
