import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Avatar } from "./Avatar";
import clsx from "clsx";

type NotificationType = "assigned" | "mentioned" | "commented" | "card_updated";

interface Notification {
  _id: Id<"notifications">;
  userId: Id<"users">;
  type: NotificationType;
  cardId: Id<"cards">;
  boardId: Id<"boards">;
  fromUserId: Id<"users">;
  read: boolean;
  message?: string;
  createdAt: number;
  card: {
    id: Id<"cards">;
    slug: string;
    title: string;
  } | null;
  fromUser: {
    id: Id<"users">;
    name: string;
    image?: string;
  } | null;
}

interface Props {
  userEmail: string;
  onClose: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const notificationIcons = {
  assigned: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  mentioned: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
    </svg>
  ),
  commented: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  card_updated: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

export function NotificationDropdown({ userEmail, onClose }: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notifications = useQuery(api.notifications.list, {
    userEmail,
    limit: 20,
  });

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleNotificationClick = async (notificationId: Id<"notifications">, read: boolean) => {
    if (!read) {
      await markAsRead({ notificationId });
    }
    onClose();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead({ userEmail });
  };

  const hasUnread = notifications?.some((n: Notification) => !n.read);

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
        <h3 className="font-medium text-dark-text">Notifications</h3>
        {hasUnread && (
          <button
            onClick={handleMarkAllAsRead}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div className="max-h-96 overflow-y-auto">
        {notifications === undefined ? (
          <div className="p-4 text-center">
            <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full mx-auto" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-dark-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="text-dark-muted text-sm">No notifications yet</p>
          </div>
        ) : (
          <div>
            {notifications.map((notification: Notification) => {
              const content = (
                <>
                  <div className="flex-shrink-0 mt-0.5">
                    {notification.fromUser ? (
                      <Avatar
                        name={notification.fromUser.name}
                        id={notification.fromUser.id}
                        size="sm"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-dark-bg flex items-center justify-center text-dark-muted">
                        {notificationIcons[notification.type]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-dark-text">
                      {notification.message || getDefaultMessage(notification.type)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {notification.card && (
                        <span className="text-xs text-dark-muted font-mono">
                          {notification.card.slug}
                        </span>
                      )}
                      <span className="text-xs text-dark-muted">
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                    </div>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
                  )}
                </>
              );

              const className = clsx(
                "flex items-start gap-3 px-4 py-3 hover:bg-dark-hover transition-colors border-b border-dark-border last:border-b-0",
                !notification.read && "bg-accent/5"
              );

              // If card exists, render as link; otherwise just a div
              if (notification.card) {
                return (
                  <Link
                    key={notification._id}
                    to="/boards/$boardId/cards/$cardSlug"
                    params={{
                      boardId: notification.boardId,
                      cardSlug: notification.card.slug,
                    }}
                    onClick={() => handleNotificationClick(notification._id, notification.read)}
                    className={className}
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification._id, notification.read)}
                  className={clsx(className, "cursor-default")}
                >
                  {content}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
