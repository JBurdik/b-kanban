import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type NotificationType = "assigned" | "mentioned" | "commented" | "card_updated";

interface NotificationFromQuery {
  _id: Id<"notifications">;
  type: NotificationType;
  boardId: Id<"boards">;
  message?: string;
  card: { slug: string } | null;
  fromUser: { name: string } | null;
}

interface Toast {
  id: string;
  message: string;
  cardSlug: string;
  boardId: string;
  fromUserName: string;
  type: string;
}

interface Props {
  userEmail?: string;
}

export function NotificationToast({ userEmail }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const notifications = useQuery(
    api.notifications.list,
    userEmail ? { userEmail, limit: 5, unreadOnly: true } : "skip"
  );

  // Detect new notifications and show toasts
  useEffect(() => {
    if (!notifications) return;

    // On initial load, just mark all as seen without showing toasts
    if (initialLoadRef.current) {
      notifications.forEach((n: NotificationFromQuery) => seenIdsRef.current.add(n._id));
      initialLoadRef.current = false;
      return;
    }

    // Find new notifications
    const newNotifications = notifications.filter(
      (n: NotificationFromQuery) => !seenIdsRef.current.has(n._id)
    );

    // Mark as seen
    newNotifications.forEach((n: NotificationFromQuery) => seenIdsRef.current.add(n._id));

    // Create toasts for new notifications
    const newToasts: Toast[] = newNotifications.map((n: NotificationFromQuery) => ({
      id: n._id,
      message: n.message || getDefaultMessage(n.type),
      cardSlug: n.card?.slug || "",
      boardId: n.boardId,
      fromUserName: n.fromUser?.name || "Someone",
      type: n.type,
    }));

    if (newToasts.length > 0) {
      setToasts((prev) => [...prev, ...newToasts]);
    }
  }, [notifications]);

  // Auto-dismiss toasts after 5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 5000);

    return () => clearTimeout(timer);
  }, [toasts]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bg-dark-surface border border-dark-border rounded-lg shadow-xl p-4 w-80 animate-slide-in-right"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(toast.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-dark-text">{toast.message}</p>
              {toast.cardSlug && toast.boardId && (
                <Link
                  to="/boards/$boardId/cards/$cardSlug"
                  params={{ boardId: toast.boardId, cardSlug: toast.cardSlug }}
                  onClick={() => dismissToast(toast.id)}
                  className="text-xs text-accent hover:text-accent/80 mt-1 inline-block"
                >
                  View card
                </Link>
              )}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="flex-shrink-0 text-dark-muted hover:text-dark-text transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function getDefaultMessage(type: string): string {
  switch (type) {
    case "assigned":
      return "You were assigned to a task";
    case "mentioned":
      return "You were mentioned";
    case "commented":
      return "Someone commented on your task";
    case "card_updated":
      return "A task was updated";
    default:
      return "You have a notification";
  }
}

function getIcon(type: string) {
  const iconClass = "w-5 h-5 text-accent";

  switch (type) {
    case "assigned":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "mentioned":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
        </svg>
      );
    case "commented":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case "card_updated":
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      );
  }
}
