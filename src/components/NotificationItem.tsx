import { Link } from "@tanstack/react-router";
import { Avatar } from "./Avatar";
import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";

export type NotificationType = "assigned" | "mentioned" | "commented" | "card_updated";

export interface NotificationData {
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
  notification: NotificationData;
  onMarkAsRead: (id: Id<"notifications">) => void;
  onDelete?: (id: Id<"notifications">) => void;
  onNavigate?: () => void;
}

const typeColors: Record<NotificationType, string> = {
  assigned: "text-blue-400",
  mentioned: "text-amber-400",
  commented: "text-green-400",
  card_updated: "text-purple-400",
};

const typeIcons: Record<NotificationType, React.ReactNode> = {
  assigned: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  mentioned: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
    </svg>
  ),
  commented: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  card_updated: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

/** Render a notification message with colored diff segments (+added / −removed / old → new). */
function NotificationMessage({ message }: { message: string }) {
  // Pull off leading `"Card title":` prefix so it renders as a heading
  const titleMatch = message.match(/^"([^"]*)":\s*/);
  const title = titleMatch ? titleMatch[1] : null;
  const rest = titleMatch ? message.slice(titleMatch[0].length) : message;

  // Split on diff markers: +addition, −removal, or `old → new` transitions
  const TOKEN = /(\+[^/,]+|−[^/,]+|[\w-]+(?: [\w-]+)* → [\w-]+(?: [\w-]+)*)/g;
  const parts = rest.split(TOKEN).filter((p) => p !== "");

  const body = parts.map((part, i) => {
        if (part.startsWith("+")) {
          return (
            <span key={i} className="rounded bg-green-500/15 px-1 text-green-400">
              {part}
            </span>
          );
        }
        if (part.startsWith("−")) {
          return (
            <span key={i} className="rounded bg-red-500/15 px-1 text-red-400">
              {part}
            </span>
          );
        }
        if (part.includes(" → ")) {
          const [oldV, newV] = part.split(" → ");
          return (
            <span key={i}>
              <span className="text-red-400 line-through decoration-red-400/40">{oldV}</span>
              <span className="text-dark-muted px-1">→</span>
              <span className="text-green-400">{newV}</span>
            </span>
          );
        }
        // Plain text — bold a leading `label:`
        const labelMatch = part.match(/^(\s*)([\w ]+:)(.*)$/s);
        if (labelMatch) {
          return (
            <span key={i}>
              {labelMatch[1]}
              <span className="font-medium text-dark-text">{labelMatch[2]}</span>
              {labelMatch[3]}
            </span>
          );
        }
    return <span key={i}>{part}</span>;
  });

  return (
    <div className="text-sm leading-snug">
      {title && <p className="font-semibold text-dark-text">{title}</p>}
      <p className={clsx("text-dark-text", title && "mt-0.5")}>{body}</p>
    </div>
  );
}

function getDefaultMessage(type: NotificationType): string {
  switch (type) {
    case "assigned": return "You were assigned to a task";
    case "mentioned": return "You were mentioned";
    case "commented": return "Someone commented on your task";
    case "card_updated": return "A task was updated";
  }
}

export function formatTimeAgo(timestamp: number): string {
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

export function NotificationItem({ notification, onMarkAsRead, onDelete, onNavigate }: Props) {
  const handleClick = () => {
    if (!notification.read) {
      onMarkAsRead(notification._id);
    }
    onNavigate?.();
  };

  const content = (
    <>
      {/* Avatar with type badge */}
      <div className="relative flex-shrink-0">
        {notification.fromUser ? (
          <Avatar
            name={notification.fromUser.name}
            id={notification.fromUser.id}
            size="md"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-dark-bg flex items-center justify-center text-dark-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        )}
        {/* Type icon badge */}
        <div className={clsx(
          "absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-dark-surface border border-dark-border flex items-center justify-center",
          typeColors[notification.type]
        )}>
          {typeIcons[notification.type]}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <NotificationMessage message={notification.message || getDefaultMessage(notification.type)} />

        <div className="flex items-center gap-2 mt-1">
          {notification.card && (
            <>
              <span className="text-xs text-dark-muted font-mono">
                {notification.card.slug}
              </span>
              <span className="text-xs text-dark-muted truncate">
                {notification.card.title}
              </span>
            </>
          )}
          <span className="text-xs text-dark-muted flex-shrink-0">
            {formatTimeAgo(notification.createdAt)}
          </span>
        </div>
      </div>

      {/* Unread dot */}
      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-2" />
      )}
    </>
  );

  const itemClassName = clsx(
    "flex items-start gap-3 px-5 py-4 hover:bg-dark-hover transition-colors relative group",
    !notification.read && "border-l-4 border-l-accent bg-accent/5",
    notification.read && "border-l-4 border-l-transparent"
  );

  const deleteButton = onDelete && (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDelete(notification._id);
      }}
      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-dark-muted hover:text-dark-text transition-all p-1 rounded hover:bg-dark-bg"
      title="Delete notification"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );

  if (notification.card) {
    return (
      <Link
        to="/boards/$boardId/cards/$cardSlug"
        params={{
          boardId: notification.boardId,
          cardSlug: notification.card.slug,
        }}
        onClick={handleClick}
        className={itemClassName}
      >
        {content}
        {deleteButton}
      </Link>
    );
  }

  return (
    <div onClick={handleClick} className={clsx(itemClassName, "cursor-default")}>
      {content}
      {deleteButton}
    </div>
  );
}
