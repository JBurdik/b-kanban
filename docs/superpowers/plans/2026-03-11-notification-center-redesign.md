# Notification Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the small notification dropdown with a slide-over panel + full page, improving readability and adding filtering/grouping.

**Architecture:** Backend auth refactor (requireAuth instead of userEmail params) → shared NotificationItem component → slide-over panel replacing dropdown → full page route with time grouping and pagination.

**Tech Stack:** React 19, Convex, TanStack Router, Tailwind CSS, clsx

**Spec:** `docs/superpowers/specs/2026-03-11-notification-center-redesign.md`

**Note:** No test runner is configured in this project. Verification is done via `pnpm build` (TypeScript check + Vite build) and manual testing with `pnpm dev`.

---

## Chunk 1: Backend Changes

### Task 1: Add schema index and refactor backend auth

**Files:**
- Modify: `convex/schema.ts:144-161` — add `by_user_type` index
- Modify: `convex/notifications.ts` — refactor all queries/mutations to use `requireAuth`

- [ ] **Step 1: Add `by_user_type` index to schema**

In `convex/schema.ts`, add the new index to the notifications table:

```ts
// After .index("by_card", ["cardId"]), add:
.index("by_user_type", ["userId", "type"])
```

- [ ] **Step 2: Refactor `list` query to use requireAuth and add type filter**

Replace the entire `list` export in `convex/notifications.ts`:

```ts
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/rbac";

export const list = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    type: v.optional(
      v.union(
        v.literal("assigned"),
        v.literal("mentioned"),
        v.literal("commented"),
        v.literal("card_updated"),
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    let notifications;
    if (args.type) {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", user._id).eq("type", args.type!)
        )
        .order("desc")
        .collect();
    } else {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect();
    }

    // Filter by read status if needed
    const filtered = args.unreadOnly
      ? notifications.filter((n) => !n.read)
      : notifications;

    // Apply limit
    const limited = args.limit ? filtered.slice(0, args.limit) : filtered;

    // Enrich with card and user info
    const enriched = await Promise.all(
      limited.map(async (notification) => {
        const card = await ctx.db.get(notification.cardId);
        const fromUser = await ctx.db.get(notification.fromUserId);

        return {
          ...notification,
          card: card
            ? { id: card._id, slug: card.slug, title: card.title }
            : null,
          fromUser: fromUser
            ? { id: fromUser._id, name: fromUser.name, image: fromUser.image }
            : null,
        };
      }),
    );

    return enriched;
  },
});
```

- [ ] **Step 3: Refactor `unreadCount` to use requireAuth**

```ts
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("read", false),
      )
      .collect();

    return unread.length;
  },
});
```

- [ ] **Step 4: Refactor `markAsRead` with ownership check**

```ts
export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) throw new Error("Unauthorized");

    await ctx.db.patch(args.notificationId, { read: true });
    return { success: true };
  },
});
```

- [ ] **Step 5: Refactor `markAllAsRead` to use requireAuth**

```ts
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("read", false),
      )
      .collect();

    for (const notification of unread) {
      await ctx.db.patch(notification._id, { read: true });
    }

    return { success: true, count: unread.length };
  },
});
```

- [ ] **Step 6: Add ownership check to `remove` mutation**

```ts
export const remove = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) throw new Error("Unauthorized");

    await ctx.db.delete(args.notificationId);
    return { success: true };
  },
});
```

- [ ] **Step 7: Update all frontend callers to remove userEmail params**

Update these files to stop passing `userEmail`:

**`src/components/NotificationBell.tsx`** — change query call:
```ts
// Before:
const unreadCount = useQuery(api.notifications.unreadCount, userEmail ? { userEmail } : "skip");
// After:
const unreadCount = useQuery(api.notifications.unreadCount, {});
```
Remove `userEmail` prop — component no longer needs it.

**`src/components/NotificationToast.tsx`** — change query call:
```ts
// Before:
const notifications = useQuery(api.notifications.list, userEmail ? { userEmail, limit: 5, unreadOnly: true } : "skip");
// After:
const notifications = useQuery(api.notifications.list, { limit: 5, unreadOnly: true });
```
Remove `userEmail` prop.

**`src/components/layout/AppLayout.tsx`** — stop passing `userEmail` to `NotificationBell`:
```tsx
// Before:
<NotificationBell userEmail={userEmail} />
// After:
<NotificationBell />
```

**`src/routes/__root.tsx`** — stop passing `userEmail` to `NotificationToast`:
Find where `<NotificationToast userEmail={...} />` is rendered and remove the prop.

- [ ] **Step 8: Verify build passes**

Run: `pnpm build`
Expected: Clean build with no TypeScript errors

- [ ] **Step 9: Commit**

```bash
git add convex/schema.ts convex/notifications.ts src/components/NotificationBell.tsx src/components/NotificationToast.tsx src/components/layout/AppLayout.tsx src/routes/__root.tsx
git commit -m "refactor: notification backend auth + type filter index"
```

---

## Chunk 2: Shared NotificationItem Component

### Task 2: Create NotificationItem shared component

**Files:**
- Create: `src/components/NotificationItem.tsx`

- [ ] **Step 1: Create NotificationItem component**

This component is used by both the panel and full page. Create `src/components/NotificationItem.tsx`:

```tsx
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

const typeIcons: Record<NotificationType, JSX.Element> = {
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
        <p className="text-sm text-dark-text">
          {notification.message || getDefaultMessage(notification.type)}
        </p>
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
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Clean build (component not yet used, but should compile)

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationItem.tsx
git commit -m "feat: add shared NotificationItem component"
```

---

## Chunk 3: Slide-over Panel

### Task 3: Create NotificationPanel and wire into NotificationBell

**Files:**
- Create: `src/components/NotificationPanel.tsx`
- Modify: `src/components/NotificationBell.tsx`
- Delete: `src/components/NotificationDropdown.tsx`

- [ ] **Step 1: Create NotificationPanel component**

Create `src/components/NotificationPanel.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { NotificationItem, type NotificationData, type NotificationType } from "./NotificationItem";
import clsx from "clsx";

interface Props {
  onClose: () => void;
}

const filterOptions: { label: string; value: NotificationType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Assigned", value: "assigned" },
  { label: "Mentioned", value: "mentioned" },
  { label: "Comments", value: "commented" },
  { label: "Updates", value: "card_updated" },
];

export function NotificationPanel({ onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<NotificationType | "all">("all");
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  const notifications = useQuery(api.notifications.list, {
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
          "absolute right-0 top-0 bottom-0 w-[440px] max-w-full bg-dark-surface border-l border-dark-border shadow-2xl flex flex-col transition-transform duration-200 ease-out",
          isVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold text-dark-text">Notifications</h2>
          <div className="flex items-center gap-3">
            {hasUnread && (
              <button
                onClick={() => markAllAsRead({})}
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
```

- [ ] **Step 2: Update NotificationBell to use NotificationPanel**

Rewrite `src/components/NotificationBell.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { NotificationPanel } from "./NotificationPanel";

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useQuery(api.notifications.unreadCount, {});

  return (
    <>
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

      {isOpen && <NotificationPanel onClose={() => setIsOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 3: Delete NotificationDropdown.tsx**

```bash
rm src/components/NotificationDropdown.tsx
```

- [ ] **Step 4: Verify build passes**

Run: `pnpm build`
Expected: Clean build. If anything still imports NotificationDropdown, fix the import.

- [ ] **Step 5: Commit**

```bash
git add src/components/NotificationPanel.tsx src/components/NotificationBell.tsx
git rm src/components/NotificationDropdown.tsx
git commit -m "feat: replace notification dropdown with slide-over panel"
```

---

## Chunk 4: Full Page Route

### Task 4: Create /notifications page

**Files:**
- Create: `src/routes/notifications.tsx`

- [ ] **Step 1: Create the notifications page**

Create `src/routes/notifications.tsx`:

```tsx
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
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
  const [activeFilter, setActiveFilter] = useState<NotificationType | "all">("all");
  const [limit, setLimit] = useState(50);

  const notifications = useQuery(api.notifications.list, {
    limit,
    ...(activeFilter !== "all" ? { type: activeFilter } : {}),
  });

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
            onClick={() => markAllAsRead({})}
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
```

- [ ] **Step 2: Regenerate route tree**

Run: `pnpm dev:app` briefly (or `npx tsr generate` if available) to regenerate `src/routeTree.gen.ts` with the new `/notifications` route.

- [ ] **Step 3: Verify build passes**

Run: `pnpm build`
Expected: Clean build with new route registered

- [ ] **Step 4: Commit**

```bash
git add src/routes/notifications.tsx src/routeTree.gen.ts
git commit -m "feat: add full notifications page with time grouping and filters"
```

---

## Chunk 5: Final Cleanup

### Task 5: Update NotificationToast and verify everything

**Files:**
- Modify: `src/components/NotificationToast.tsx` — remove now-redundant type/icon definitions (they moved to NotificationItem)

- [ ] **Step 1: Manual verification**

Run: `pnpm dev`

Verify:
1. Click bell icon → slide-over panel opens from right with backdrop
2. Filter chips work (All/Assigned/Mentioned/Comments/Updates)
3. Click notification → navigates to card, panel closes
4. "Mark all as read" works
5. "View all" navigates to `/notifications` and closes panel
6. Escape closes panel, backdrop click closes panel
7. `/notifications` page shows time-grouped notifications
8. Delete button appears on hover on full page
9. "Load more" button works
10. Toast notifications still work

- [ ] **Step 2: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: notification center cleanup and fixes"
```
