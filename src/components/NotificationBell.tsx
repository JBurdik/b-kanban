import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { NotificationDropdown } from "./NotificationDropdown";

interface Props {
  userEmail?: string;
}

export function NotificationBell({ userEmail }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useQuery(
    api.notifications.unreadCount,
    userEmail ? { userEmail } : "skip",
  );

  if (!userEmail) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
        title="Notifications"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-accent text-white text-xs font-medium rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationDropdown
          userEmail={userEmail}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
