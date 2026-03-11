import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { NotificationItem, type NotificationData, type NotificationType } from "@/components/NotificationItem";
import clsx from "clsx";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

const filterOptions: { label: string; value: NotificationType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Assigned", value: "assigned" },
  { label: "Mentioned", value: "mentioned" },
  { label: "Comments", value: "commented" },
  { label: "Updates", value: "card_updated" },
];

interface TimeGroup {
  label: string;
  notifications: NotificationData[];
}

function groupByTime(notifications: NotificationData[]): TimeGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - (now.getDay() * 86400000);

  const groups: Record<string, NotificationData[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    Older: [],
  };

  for (const n of notifications) {
    if (n.createdAt >= todayStart) {
      groups["Today"].push(n);
    } else if (n.createdAt >= yesterdayStart) {
      groups["Yesterday"].push(n);
    } else if (n.createdAt >= weekStart) {
      groups["This week"].push(n);
    } else {
      groups["Older"].push(n);
    }
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, notifications]) => ({ label, notifications }));
}

function NotificationsPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email;
  const [activeFilter, setActiveFilter] = useState<NotificationType | "all">("all");
  const [limit, setLimit] = useState(50);

  const notifications = useQuery(
    api.notifications.list,
    userEmail
      ? { userEmail, limit, ...(activeFilter !== "all" ? { type: activeFilter } : {}) }
      : "skip",
  );

  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const removeNotification = useMutation(api.notifications.remove);

  const hasUnread = notifications?.some((n: NotificationData) => !n.read);
  const timeGroups = notifications ? groupByTime(notifications as NotificationData[]) : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-dark-text">Notifications</h1>
        {hasUnread && (
          <button
            onClick={() => userEmail && markAllAsRead({ userEmail })}
            className="text-sm text-accent hover:text-accent/80 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter chips — sticky */}
      <div className="sticky top-14 z-20 bg-dark-bg py-3 -mx-4 px-4 border-b border-dark-border mb-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {filterOptions.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                activeFilter === filter.value
                  ? "bg-accent text-white"
                  : "bg-dark-hover text-dark-muted hover:text-dark-text"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {notifications === undefined ? (
        <div className="p-12 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mx-auto" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-16 text-center">
          <svg className="w-20 h-20 mx-auto text-dark-muted/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="text-dark-muted">
            {activeFilter === "all"
              ? "No notifications yet"
              : `No ${filterOptions.find(f => f.value === activeFilter)?.label.toLowerCase()} notifications`}
          </p>
        </div>
      ) : (
        <>
          {timeGroups.map((group) => (
            <div key={group.label} className="mb-6">
              <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wider mb-2 px-5">
                {group.label}
              </h3>
              <div className="bg-dark-surface rounded-lg border border-dark-border divide-y divide-dark-border overflow-hidden">
                {group.notifications.map((notification) => (
                  <NotificationItem
                    key={notification._id}
                    notification={notification}
                    onMarkAsRead={(id) => markAsRead({ notificationId: id })}
                    onDelete={(id) => removeNotification({ notificationId: id })}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Load more */}
          {notifications.length >= limit && (
            <div className="text-center py-6">
              <button
                onClick={() => setLimit((prev) => prev + 50)}
                className="px-4 py-2 text-sm text-dark-muted hover:text-dark-text bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
