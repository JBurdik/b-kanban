# Kanban Board Feature Enhancement Plan

## Overview

This plan covers 5 features for the Kanban board application:
1. Rich text comments with Notion-style / commands
2. @ user mentions
3. Card detail improvements (full page + modal, sidebar layout)
4. Notifications system (in-app + real-time toasts)
5. Time effort field (hours)

## Implementation Order

Features ordered by dependencies:

1. **Time Effort Field** - standalone, no dependencies
2. **Rich Text Comments** - extends existing RichTextEditor
3. **@ User Mentions** - builds on rich text, needed for notifications
4. **Card Detail Improvements** - route + layout changes
5. **Notifications System** - depends on mentions

---

## Feature 1: Time Effort Field

### Schema Change
```typescript
// convex/schema.ts - cards table
effort: v.optional(v.number()), // Hours estimate
```

### Files to Modify
| File | Changes |
|------|---------|
| `convex/schema.ts` | Add `effort` field to cards |
| `convex/cards.ts` | Add `effort` to create/update mutations |
| `packages/app/src/components/kanban/CardModal.tsx` | Add effort input (number, step=0.5) |
| `packages/app/src/components/kanban/CardViewModal.tsx` | Display effort in metadata bar |

---

## Feature 2: Rich Text Comments

### Approach
- Reuse existing RichTextEditor and SlashCommands extension
- Comments now store HTML instead of plain text
- Create simplified CommentEditor component

### Files to Modify/Create
| File | Changes |
|------|---------|
| `packages/app/src/components/kanban/CommentEditor.tsx` | **NEW** - Simplified RichTextEditor for comments |
| `packages/app/src/components/kanban/CommentList.tsx` | Replace textarea with CommentEditor, render HTML |
| `convex/comments.ts` | No change needed (content is already string) |

### CommentEditor Features
- Smaller toolbar: bold, italic, bullet list, code
- Integrate existing SlashCommands
- No headings (keep comments concise)

---

## Feature 3: @ User Mentions

### Package to Install
```bash
pnpm add @tiptap/extension-mention
```

### Schema Change
```typescript
// convex/schema.ts - comments table
mentionedUserIds: v.optional(v.array(v.id("users"))),
```

### Files to Create
| File | Purpose |
|------|---------|
| `packages/app/src/components/editor/MentionExtension.tsx` | TipTap mention extension with user suggestion UI |
| `packages/app/src/utils/mentions.ts` | Extract mentioned user IDs from HTML |

### Files to Modify
| File | Changes |
|------|---------|
| `convex/schema.ts` | Add `mentionedUserIds` to comments |
| `convex/members.ts` | Add `searchBoardMembers` query |
| `convex/comments.ts` | Accept and store `mentionedUserIds` |
| `packages/app/src/components/RichTextEditor.tsx` | Add boardId prop, integrate MentionExtension |
| `packages/app/src/components/kanban/CommentEditor.tsx` | Integrate MentionExtension |
| `packages/app/src/components/kanban/CommentList.tsx` | Extract mentions before saving |

### Mention Extension Pattern
Follow existing `SlashCommands.tsx` pattern:
- Use `@tiptap/suggestion` for popup mechanism
- Use `ReactRenderer` + `tippy.js` for dropdown
- Store user ID in `data-user-id` attribute on mention span

---

## Feature 4: Card Detail Improvements

### Route Structure
- `/boards/$boardId` - Board view (existing)
- `/boards/$boardId/cards/$cardSlug` - **NEW** Full page card view

### User Preferences
- Quick click on card: Opens modal (existing behavior)
- Deep link/share: Opens full page view
- Large screens: Sidebar layout with metadata on right

### Files to Create
| File | Purpose |
|------|---------|
| `packages/app/src/routes/boards.$boardId.cards.$cardSlug.tsx` | Full page card route |
| `packages/app/src/components/kanban/CardDetailPage.tsx` | Full page layout with sidebar |

### Files to Modify
| File | Changes |
|------|---------|
| `convex/cards.ts` | Add `getBySlug` query |
| `packages/app/src/components/kanban/CardViewModal.tsx` | Add "Open in full page" link |
| `packages/app/src/components/kanban/KanbanCard.tsx` | Add full page link option |

### Layout (Large Screens)
```
+------------------------------------------+
| Breadcrumb: Board > PROJ-1               |
+------------------------------------------+
|                          |  SIDEBAR      |
|  Title                   |  Status       |
|  Description (rich text) |  Assignee     |
|  Comments                |  Priority     |
|                          |  Due Date     |
|                          |  Effort       |
|                          |  Attachments  |
+------------------------------------------+
```

---

## Feature 5: Notifications System

### User Preferences
- In-app notifications (bell icon with dropdown)
- Real-time toasts for live events

### Schema Addition
```typescript
// convex/schema.ts
notifications: defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("assigned"),
    v.literal("mentioned"),
    v.literal("commented"),
    v.literal("card_updated")
  ),
  cardId: v.id("cards"),
  fromUserId: v.id("users"),
  read: v.boolean(),
  message: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_unread", ["userId", "read"])
```

### Notification Triggers
| Event | Notify |
|-------|--------|
| Assigned to card | Assignee |
| Mentioned in comment | Mentioned users |
| Comment on card | Card assignee (if not commenter) |
| Card updated | Card assignee (if not updater) |

### Files to Create
| File | Purpose |
|------|---------|
| `convex/notifications.ts` | Queries and mutations for notifications |
| `packages/app/src/components/NotificationBell.tsx` | Bell icon with unread count |
| `packages/app/src/components/NotificationDropdown.tsx` | List of notifications |
| `packages/app/src/components/NotificationToast.tsx` | Real-time toast provider |

### Files to Modify
| File | Changes |
|------|---------|
| `convex/schema.ts` | Add notifications table |
| `convex/cards.ts` | Trigger notifications on assignment/update |
| `convex/comments.ts` | Trigger notifications on comment/mention |
| `packages/app/src/routes/__root.tsx` | Add NotificationBell, wrap in toast provider |

### Real-time Toasts
- Use Convex subscription to notifications query
- Compare current vs previous to detect new notifications
- Show toast for each new notification

---

## Complete File Summary

### New Files (10)
1. `convex/notifications.ts`
2. `packages/app/src/components/editor/MentionExtension.tsx`
3. `packages/app/src/components/kanban/CommentEditor.tsx`
4. `packages/app/src/components/kanban/CardDetailPage.tsx`
5. `packages/app/src/components/NotificationBell.tsx`
6. `packages/app/src/components/NotificationDropdown.tsx`
7. `packages/app/src/components/NotificationToast.tsx`
8. `packages/app/src/routes/boards.$boardId.cards.$cardSlug.tsx`
9. `packages/app/src/utils/mentions.ts`

### Modified Files (10)
1. `convex/schema.ts` - effort field, mentionedUserIds, notifications table
2. `convex/cards.ts` - effort, getBySlug, notification triggers
3. `convex/comments.ts` - mentionedUserIds, notification triggers
4. `convex/members.ts` - searchBoardMembers query
5. `packages/app/src/components/RichTextEditor.tsx` - MentionExtension
6. `packages/app/src/components/kanban/CommentList.tsx` - rich text, mentions
7. `packages/app/src/components/kanban/CardModal.tsx` - effort field
8. `packages/app/src/components/kanban/CardViewModal.tsx` - effort, full page link
9. `packages/app/src/components/kanban/KanbanCard.tsx` - full page link
10. `packages/app/src/routes/__root.tsx` - notifications UI

### Package to Install
```bash
pnpm add @tiptap/extension-mention
```

---

## Key Patterns to Follow

### Mention Extension
Follow `packages/app/src/components/editor/SlashCommands.tsx`:
- Use `@tiptap/suggestion` for trigger mechanism
- Use `ReactRenderer` + `tippy.js` for dropdown positioning
- Use `forwardRef` + `useImperativeHandle` for keyboard navigation

### Convex Notifications
Use `ctx.scheduler.runAfter(0, internal.notifications.create, {...})` to create notifications asynchronously from mutations.

### Real-time with Convex
All `useQuery` hooks automatically subscribe to changes - no extra WebSocket setup needed.
