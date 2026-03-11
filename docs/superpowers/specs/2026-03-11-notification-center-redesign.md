# Notification Center Redesign

## Problem

The current notification center is a small 320px dropdown with max-height 384px. It feels cramped and hard to scan, especially with multiple notifications.

## Solution

Replace the dropdown with a slide-over panel + add a dedicated full page for notification history.

## Components

### 1. Slide-over Panel (NotificationPanel.tsx)

**Replaces** `NotificationDropdown.tsx`.

**Layout:**
- Right-side panel, 440px wide, full viewport height
- Semi-transparent backdrop (`bg-black/30`) — click to close
- Animation: slide-in from right (translateX), backdrop fade-in
- Close: backdrop click, Escape key, X button

**Header:**
- Title "Notifications" (`text-lg font-semibold`)
- "Mark all as read" button (visible only when unread exist)
- "View all" link → `/notifications` (closes panel on click)
- X close button
- Focus trapped within panel when open (WAI-ARIA dialog pattern)

**Filter chips (below header):**
- Pill buttons: All | Assigned | Mentioned | Comments | Updates
- Active filter highlighted with accent color
- Client-side filtering of already-loaded notifications

**Notification items (improved):**
- Larger padding (`px-5 py-4`)
- Avatar size `md` (up from `sm`)
- Colored type icon badge on avatar corner
- Message as main text (`text-sm`)
- Below message: card slug (mono, clickable) + card title (truncated) + time ago
- Unread: 4px accent left border (replaces subtle background)
- Hover state with `bg-dark-hover`

**Empty state:**
- Larger bell icon + "You're all caught up!" text

### 2. Full Page (/notifications route)

**Route:** `src/routes/notifications.tsx` (consistent with existing routes like `time.tsx`, `profile.tsx`)

**Layout:**
- Centered container, max-width 720px
- Page header: "Notifications" title + "Mark all as read" button

**Filters (sticky):**
- Same pill/chip buttons as panel: All | Assigned | Mentioned | Comments | Updates
- Sticky at top during scroll

**Time sections:**
- Grouped: "Today", "Yesterday", "This week", "Older" (using browser's local timezone)
- Gray label separators between sections
- Empty sections hidden

**Items:**
- Same design as panel (shared component)
- Additional: delete button (X icon, visible on hover)

**Empty states:**
- No notifications: larger illustration + text
- No filter results: "No [type] notifications"

**Pagination:**
- "Load more" button at bottom

### 3. Backend Changes (convex/notifications.ts)

- Add optional `type` filter parameter to `list` query
- Use Convex-native `.paginate()` API with cursor for the full page (replace `.collect()` + slice)
- Add `by_user_type` index to notifications table in `convex/schema.ts`: `index("by_user_type", ["userId", "type"])` for server-side type filtering
- Add ownership verification to `remove` mutation (check `notification.userId === authenticated user`)
- Refactor `list`, `markAllAsRead`, and `unreadCount` to use `requireAuth(ctx)` instead of accepting raw `userEmail` parameter — derive user from session

**Filter chip → type mapping:**
- "Assigned" → `assigned`
- "Mentioned" → `mentioned`
- "Comments" → `commented`
- "Updates" → `card_updated`

### 4. Integration Changes

- `NotificationBell.tsx` — toggle `NotificationPanel` instead of `NotificationDropdown`
- `NotificationDropdown.tsx` — deleted, replaced by `NotificationPanel.tsx`
- `NotificationToast.tsx` — no changes

## Shared Components

Extract `NotificationItem` as a shared component used by both the panel and the full page. The full page variant adds a delete button.

## File Changes Summary

| File | Action |
|------|--------|
| `src/components/NotificationPanel.tsx` | New — slide-over panel |
| `src/components/NotificationItem.tsx` | New — shared notification item |
| `src/routes/notifications.tsx` | New — full page route |
| `convex/schema.ts` | Modify — add `by_user_type` index |
| `src/components/NotificationBell.tsx` | Modify — render panel instead of dropdown |
| `src/components/NotificationDropdown.tsx` | Delete |
| `convex/notifications.ts` | Modify — add type filter + pagination |
