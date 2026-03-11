# Seven Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comment reactions, card watchers, keyboard shortcuts, invite links, bulk operations, real-time presence, and webhooks to the kanban app.

**Architecture:** Each feature adds a Convex backend (schema + mutations/queries) and React frontend (components + hooks). Features are independent and built in dependency order. No test runner is configured — verify via `pnpm dev` and browser.

**Tech Stack:** React 19, Convex, TanStack Router, Tailwind CSS, dnd-kit

**Spec:** `docs/superpowers/specs/2026-03-11-seven-features-design.md`

---

## Chunk 1: Comment Reactions

### Task 1: Schema — Add commentReactions table

**Files:**
- Modify: `convex/schema.ts` (after cardLabels table, ~line 240)

- [ ] **Step 1: Add commentReactions table to schema**

Add after the `cardLabels` table definition (~line 240):

```typescript
commentReactions: defineTable({
  commentId: v.id("comments"),
  userId: v.id("users"),
  emoji: v.string(),
  createdAt: v.number(),
})
  .index("by_comment", ["commentId"])
  .index("by_comment_and_user", ["commentId", "userId"]),
```

- [ ] **Step 2: Verify schema compiles**

Run: `cd /Users/jirkab/code/b-kanban && npx convex dev --once`
Expected: Schema pushed successfully.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add commentReactions table to schema"
```

### Task 2: Backend — Comment reactions mutations/queries

**Files:**
- Create: `convex/commentReactions.ts`

- [ ] **Step 1: Create commentReactions.ts with toggle mutation and listByComment query**

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/rbac";

export const toggle = mutation({
  args: {
    commentId: v.id("comments"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify comment exists and get board access
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Check if reaction already exists
    const existing = await ctx.db
      .query("commentReactions")
      .withIndex("by_comment_and_user", (q) =>
        q.eq("commentId", args.commentId).eq("userId", user._id)
      )
      .collect();

    const existingReaction = existing.find((r) => r.emoji === args.emoji);

    if (existingReaction) {
      await ctx.db.delete(existingReaction._id);
      return { action: "removed" };
    } else {
      await ctx.db.insert("commentReactions", {
        commentId: args.commentId,
        userId: user._id,
        emoji: args.emoji,
        createdAt: Date.now(),
      });
      return { action: "added" };
    }
  },
});

export const listByComment = query({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const reactions = await ctx.db
      .query("commentReactions")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();

    // Enrich with user info
    const enriched = await Promise.all(
      reactions.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return {
          ...r,
          userName: user?.name || "Unknown",
        };
      })
    );

    return enriched;
  },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx convex dev --once`

- [ ] **Step 3: Commit**

```bash
git add convex/commentReactions.ts
git commit -m "feat: add comment reactions backend (toggle + listByComment)"
```

### Task 3: Frontend — Reaction UI on comments

**Files:**
- Create: `src/components/kanban/CommentReactions.tsx`
- Modify: `src/components/kanban/CardSlidePanel.tsx` (where comments are rendered)

- [ ] **Step 1: Create CommentReactions component**

```typescript
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useState } from "react";

const REACTION_EMOJIS = ["👍", "👎", "❤️", "😄", "🎉", "👀", "✅"];

interface Props {
  commentId: Id<"comments">;
  currentUserId?: Id<"users">;
}

export function CommentReactions({ commentId, currentUserId }: Props) {
  const reactions = useQuery(api.commentReactions.listByComment, { commentId });
  const toggle = useMutation(api.commentReactions.toggle);
  const [showPicker, setShowPicker] = useState(false);

  if (!reactions) return null;

  // Group reactions by emoji
  const grouped = reactions.reduce(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasReacted: false };
      acc[r.emoji].count++;
      acc[r.emoji].users.push(r.userName);
      if (r.userId === currentUserId) acc[r.emoji].hasReacted = true;
      return acc;
    },
    {} as Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }>
  );

  const handleToggle = async (emoji: string) => {
    await toggle({ commentId, emoji });
    setShowPicker(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {Object.values(grouped).map((g) => (
        <button
          key={g.emoji}
          onClick={() => handleToggle(g.emoji)}
          title={g.users.join(", ")}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
            g.hasReacted
              ? "border-accent bg-accent/10 text-accent"
              : "border-dark-border bg-dark-surface text-dark-muted hover:border-dark-text"
          }`}
        >
          <span>{g.emoji}</span>
          <span>{g.count}</span>
        </button>
      ))}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs border border-dark-border bg-dark-surface text-dark-muted hover:border-dark-text hover:text-dark-text transition-colors"
        >
          +
        </button>
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 rounded-lg border border-dark-border bg-dark-surface shadow-lg z-10">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleToggle(emoji)}
                className="hover:scale-125 transition-transform text-base p-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate CommentReactions into comment display**

Find where comments are rendered in `CardSlidePanel.tsx` (the comments section, roughly lines 550-620). Add `<CommentReactions commentId={comment._id} currentUserId={currentUser?._id} />` below each comment's content.

Look for the comment rendering loop — it maps over comments and renders author, content, timestamp. Add the `CommentReactions` component after the comment content div.

- [ ] **Step 3: Verify in browser**

Run: `pnpm dev`
- Open a card with comments
- Click "+" to add a reaction
- Click a reaction pill to toggle
- Verify counts and highlight update in real-time

- [ ] **Step 4: Commit**

```bash
git add src/components/kanban/CommentReactions.tsx src/components/kanban/CardSlidePanel.tsx
git commit -m "feat: add comment reactions UI with emoji picker"
```

---

## Chunk 2: Card Watchers

### Task 4: Schema — Add cardWatchers table

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add cardWatchers table after commentReactions**

```typescript
cardWatchers: defineTable({
  cardId: v.id("cards"),
  userId: v.id("users"),
  createdAt: v.number(),
})
  .index("by_card", ["cardId"])
  .index("by_user", ["userId"])
  .index("by_card_and_user", ["cardId", "userId"]),
```

- [ ] **Step 2: Push schema**

Run: `npx convex dev --once`

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add cardWatchers table to schema"
```

### Task 5: Backend — Card watchers mutations/queries

**Files:**
- Create: `convex/cardWatchers.ts`
- Modify: `convex/notifications.ts` (extend create to notify watchers)
- Modify: `convex/cards.ts` (add cleanup in permanentDelete)

- [ ] **Step 1: Create cardWatchers.ts**

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, getBoardIdFromCard, requireBoardAccess } from "./lib/rbac";

export const toggle = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify card exists and board access
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, user._id, boardId, "member");

    const existing = await ctx.db
      .query("cardWatchers")
      .withIndex("by_card_and_user", (q) =>
        q.eq("cardId", args.cardId).eq("userId", user._id)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { watching: false };
    } else {
      await ctx.db.insert("cardWatchers", {
        cardId: args.cardId,
        userId: user._id,
        createdAt: Date.now(),
      });
      return { watching: true };
    }
  },
});

export const list = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const watchers = await ctx.db
      .query("cardWatchers")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    return Promise.all(
      watchers.map(async (w) => {
        const user = await ctx.db.get(w.userId);
        return { ...w, user: user ? { id: user._id, name: user.name, image: user.image } : null };
      })
    );
  },
});

export const isWatching = query({
  args: {
    cardId: v.id("cards"),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    if (!args.userId) return false;
    const existing = await ctx.db
      .query("cardWatchers")
      .withIndex("by_card_and_user", (q) =>
        q.eq("cardId", args.cardId).eq("userId", args.userId!)
      )
      .first();
    return !!existing;
  },
});
```

- [ ] **Step 2: Update notifications.create to notify watchers**

In `convex/notifications.ts`, in the `create` internal mutation (around line 192), after the existing notification insert, add watcher notification logic:

```typescript
// After the main notification is created, also notify watchers
const watchers = await ctx.db
  .query("cardWatchers")
  .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
  .collect();

for (const watcher of watchers) {
  // Skip: the user who triggered the action, and the user who already got notified above
  if (watcher.userId === args.fromUserId || watcher.userId === args.userId) {
    continue;
  }

  // Dedup check for watcher too
  const recentWatcher = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", watcher.userId))
    .order("desc")
    .first();

  const isDuplicate =
    recentWatcher &&
    recentWatcher.type === args.type &&
    recentWatcher.cardId === args.cardId &&
    recentWatcher.fromUserId === args.fromUserId &&
    Date.now() - recentWatcher.createdAt < 60000;

  if (!isDuplicate) {
    await ctx.db.insert("notifications", {
      userId: watcher.userId,
      type: args.type,
      cardId: args.cardId,
      boardId,
      fromUserId: args.fromUserId,
      read: false,
      message: args.message,
      createdAt: Date.now(),
    });
  }
}
```

- [ ] **Step 3: Add cardWatchers cleanup to permanentDelete in cards.ts**

In `convex/cards.ts`, in the `permanentDelete` mutation (around line 430, before `await ctx.db.delete(args.cardId)`), add:

```typescript
// Delete card watchers
const watchers = await ctx.db
  .query("cardWatchers")
  .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
  .collect();
for (const watcher of watchers) {
  await ctx.db.delete(watcher._id);
}

// Delete comment reactions (for all comments on this card)
for (const comment of comments) {
  const reactions = await ctx.db
    .query("commentReactions")
    .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
    .collect();
  for (const reaction of reactions) {
    await ctx.db.delete(reaction._id);
  }
}
```

Note: The `comments` variable is already collected earlier in permanentDelete for deletion. Add the reactions cleanup BEFORE the comments are deleted.

- [ ] **Step 4: Verify compilation**

Run: `npx convex dev --once`

- [ ] **Step 5: Commit**

```bash
git add convex/cardWatchers.ts convex/notifications.ts convex/cards.ts
git commit -m "feat: add card watchers backend with notification integration"
```

### Task 6: Frontend — Watch button in CardSlidePanel

**Files:**
- Modify: `src/components/kanban/CardSlidePanel.tsx`

- [ ] **Step 1: Add watch toggle button to CardSlidePanel header**

In `CardSlidePanel.tsx`, in the header area (around lines 282-391), add a watch button next to the copy-link button. Import the needed hooks:

```typescript
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
```

Add the query and mutation:
```typescript
const isWatching = useQuery(api.cardWatchers.isWatching, {
  cardId: card._id,
  userId: currentUser?._id,
});
const watchersList = useQuery(api.cardWatchers.list, { cardId: card._id });
const toggleWatch = useMutation(api.cardWatchers.toggle);
```

Add the button in the header (near the expand/close buttons):
```tsx
<button
  onClick={() => toggleWatch({ cardId: card._id })}
  title={isWatching ? "Stop watching" : "Watch this card"}
  className={`p-1.5 rounded-lg transition-colors ${
    isWatching
      ? "text-accent bg-accent/10"
      : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
  }`}
>
  {isWatching ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )}
  {watchersList && watchersList.length > 0 && (
    <span className="ml-0.5 text-xs">{watchersList.length}</span>
  )}
</button>
```

- [ ] **Step 2: Verify in browser**

- Open a card
- Click the eye icon to watch/unwatch
- Check another user gets notifications when comments are added

- [ ] **Step 3: Commit**

```bash
git add src/components/kanban/CardSlidePanel.tsx
git commit -m "feat: add card watcher toggle button in card panel"
```

---

## Chunk 3: Keyboard Shortcuts

### Task 7: Keyboard navigation hook

**Files:**
- Create: `src/hooks/useKeyboardNavigation.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useCallback, useEffect } from "react";
import type { Id } from "convex/_generated/dataModel";

interface Card {
  _id: Id<"cards">;
  [key: string]: any;
}

interface Column {
  _id: Id<"columns">;
  cards: Card[];
  [key: string]: any;
}

interface UseKeyboardNavigationOptions {
  columns: Column[];
  onCardOpen?: (card: Card) => void;
  onCardEdit?: (card: Card) => void;
  onCardArchive?: (card: Card) => void;
  onNewCard?: (columnId: Id<"columns">) => void;
  enabled?: boolean;
}

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  if (el.closest(".ProseMirror")) return true;
  return false;
}

export function useKeyboardNavigation({
  columns,
  onCardOpen,
  onCardEdit,
  onCardArchive,
  onNewCard,
  enabled = true,
}: UseKeyboardNavigationOptions) {
  const [focusedColumnIndex, setFocusedColumnIndex] = useState<number>(-1);
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(-1);

  const focusedColumn = focusedColumnIndex >= 0 ? columns[focusedColumnIndex] : null;
  const focusedCard =
    focusedColumn && focusedCardIndex >= 0
      ? focusedColumn.cards[focusedCardIndex]
      : null;

  const clearFocus = useCallback(() => {
    setFocusedColumnIndex(-1);
    setFocusedCardIndex(-1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          setFocusedColumnIndex((prev) => {
            const next = Math.min(prev + 1, columns.length - 1);
            setFocusedCardIndex((ci) => {
              const col = columns[next];
              if (!col || col.cards.length === 0) return -1;
              return Math.min(Math.max(ci, 0), col.cards.length - 1);
            });
            return next;
          });
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          setFocusedColumnIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            setFocusedCardIndex((ci) => {
              const col = columns[next];
              if (!col || col.cards.length === 0) return -1;
              return Math.min(Math.max(ci, 0), col.cards.length - 1);
            });
            return next;
          });
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (focusedColumnIndex < 0 && columns.length > 0) {
            setFocusedColumnIndex(0);
            setFocusedCardIndex(columns[0]?.cards.length > 0 ? 0 : -1);
          } else {
            setFocusedCardIndex((prev) => {
              const col = columns[focusedColumnIndex];
              if (!col) return prev;
              return Math.min(prev + 1, col.cards.length - 1);
            });
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedCardIndex((prev) => Math.max(prev - 1, 0));
          break;
        }
        case "Enter": {
          if (focusedCard && onCardOpen) {
            e.preventDefault();
            onCardOpen(focusedCard);
          }
          break;
        }
        case "Escape": {
          clearFocus();
          break;
        }
        case "n":
        case "N": {
          e.preventDefault();
          const colId = focusedColumn?._id || columns[0]?._id;
          if (colId && onNewCard) onNewCard(colId);
          break;
        }
        case "e":
        case "E": {
          if (focusedCard && onCardEdit) {
            e.preventDefault();
            onCardEdit(focusedCard);
          }
          break;
        }
        case "a":
        case "A": {
          if (focusedCard && onCardArchive) {
            e.preventDefault();
            onCardArchive(focusedCard);
          }
          break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, columns, focusedColumnIndex, focusedCardIndex, focusedCard, focusedColumn, onCardOpen, onCardEdit, onCardArchive, onNewCard, clearFocus]);

  return {
    focusedColumnIndex,
    focusedCardIndex,
    focusedCardId: focusedCard?._id ?? null,
    clearFocus,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useKeyboardNavigation.ts
git commit -m "feat: add useKeyboardNavigation hook for board shortcuts"
```

### Task 8: Global shortcuts hook

**Files:**
- Create: `src/hooks/useGlobalShortcuts.ts`

- [ ] **Step 1: Create global shortcuts hook**

```typescript
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  if (el.closest(".ProseMirror")) return true;
  return false;
}

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (e.key === "b" || e.key === "B") {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          navigate({ to: "/boards" });
        }
      }

      if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  return { showShortcutsModal, setShowShortcutsModal };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useGlobalShortcuts.ts
git commit -m "feat: add global keyboard shortcuts hook (B, ?)"
```

### Task 9: Keyboard shortcuts help modal

**Files:**
- Create: `src/components/KeyboardShortcutsModal.tsx`

- [ ] **Step 1: Create the modal component**

```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_SECTIONS = [
  {
    title: "Board Navigation",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Navigate between cards" },
      { keys: ["←", "→"], description: "Navigate between columns" },
      { keys: ["Enter"], description: "Open selected card" },
      { keys: ["Escape"], description: "Close panel / deselect" },
    ],
  },
  {
    title: "Board Actions",
    shortcuts: [
      { keys: ["N"], description: "New card" },
      { keys: ["E"], description: "Edit selected card" },
      { keys: ["A"], description: "Archive selected card" },
    ],
  },
  {
    title: "Card Detail",
    shortcuts: [
      { keys: ["1"], description: "Priority: Low" },
      { keys: ["2"], description: "Priority: Medium" },
      { keys: ["3"], description: "Priority: High" },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { keys: ["B"], description: "Go to boards" },
      { keys: ["?"], description: "Show this help" },
      { keys: ["⌘", "K"], description: "Spotlight search" },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-dark-surface border border-dark-border rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-dark-text">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-hover transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-6">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-medium text-dark-muted mb-2">{section.title}</h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((shortcut) => (
                  <div key={shortcut.description} className="flex items-center justify-between">
                    <span className="text-sm text-dark-text">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="px-2 py-0.5 text-xs font-mono bg-dark-hover border border-dark-border rounded text-dark-muted"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/KeyboardShortcutsModal.tsx
git commit -m "feat: add keyboard shortcuts help modal"
```

### Task 10: Integrate shortcuts into board and layout

**Files:**
- Modify: `src/routes/boards.$boardId.index.tsx` (add useKeyboardNavigation)
- Modify: `src/components/layout/AppLayout.tsx` (add useGlobalShortcuts + modal)
- Modify: `src/components/kanban/KanbanCard.tsx` (add focused ring style)

- [ ] **Step 1: Integrate useKeyboardNavigation into board route**

In `src/routes/boards.$boardId.index.tsx`:
- Import `useKeyboardNavigation` from `@/hooks/useKeyboardNavigation`
- Call it with the board's columns, passing `onCardOpen: handleCardClick`, `onCardEdit: handleCardDoubleClick`, `onCardArchive` (new handler that calls cards.remove mutation)
- Pass `focusedCardId` as a prop to `KanbanBoard`

- [ ] **Step 2: Pass focusedCardId through KanbanBoard to KanbanCard**

In `KanbanBoard.tsx`, accept `focusedCardId` prop, pass it through to `KanbanColumn`, then to `KanbanCard`.

In `KanbanCard.tsx`, accept `isFocused` prop and add ring styling:
```tsx
className={`... ${isFocused ? "ring-2 ring-accent" : ""}`}
```

- [ ] **Step 3: Integrate global shortcuts into AppLayout**

In `src/components/layout/AppLayout.tsx`:
- Import `useGlobalShortcuts` and `KeyboardShortcutsModal`
- Call `useGlobalShortcuts()` to get `showShortcutsModal, setShowShortcutsModal`
- Render `<KeyboardShortcutsModal isOpen={showShortcutsModal} onClose={() => setShowShortcutsModal(false)} />`

- [ ] **Step 4: Add priority shortcuts in CardSlidePanel**

In `CardSlidePanel.tsx`, add a `useEffect` that listens for `1`, `2`, `3` keys when the panel is open (and input is not focused). On press, call `updateCard` with the appropriate priority.

- [ ] **Step 5: Verify in browser**

- Arrow keys navigate cards
- Focused card shows accent ring
- `N` opens new card form
- `?` shows help modal
- `B` navigates to boards
- `1`/`2`/`3` in card detail changes priority

- [ ] **Step 6: Commit**

```bash
git add src/routes/boards.$boardId.index.tsx src/components/kanban/KanbanBoard.tsx src/components/kanban/KanbanCard.tsx src/components/layout/AppLayout.tsx src/components/kanban/CardSlidePanel.tsx
git commit -m "feat: integrate keyboard shortcuts into board and layout"
```

---

## Chunk 4: Invite Links

### Task 11: Schema — Add boardInvites table

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add boardInvites table**

```typescript
boardInvites: defineTable({
  boardId: v.id("boards"),
  token: v.string(),
  role: v.union(v.literal("admin"), v.literal("member")),
  createdById: v.id("users"),
  expiresAt: v.optional(v.number()),
  maxUses: v.optional(v.number()),
  useCount: v.number(),
  isActive: v.boolean(),
  createdAt: v.number(),
})
  .index("by_token", ["token"])
  .index("by_board", ["boardId"]),
```

- [ ] **Step 2: Push schema, commit**

```bash
npx convex dev --once
git add convex/schema.ts
git commit -m "feat: add boardInvites table to schema"
```

### Task 12: Backend — Invite mutations

**Files:**
- Create: `convex/invites.ts`

- [ ] **Step 1: Create invites.ts**

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireBoardAccess } from "./lib/rbac";

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export const create = mutation({
  args: {
    boardId: v.id("boards"),
    role: v.union(v.literal("admin"), v.literal("member")),
    expiresAt: v.optional(v.number()),
    maxUses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId, "admin");

    const token = generateToken();
    const id = await ctx.db.insert("boardInvites", {
      boardId: args.boardId,
      token,
      role: args.role,
      createdById: user._id,
      expiresAt: args.expiresAt,
      maxUses: args.maxUses,
      useCount: 0,
      isActive: true,
      createdAt: Date.now(),
    });

    return { id, token };
  },
});

export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("boardInvites")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    return invites.filter((i) => i.isActive);
  },
});

export const revoke = mutation({
  args: { inviteId: v.id("boardInvites") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");

    await requireBoardAccess(ctx, user._id, invite.boardId, "admin");
    await ctx.db.patch(args.inviteId, { isActive: false });
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("boardInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite || !invite.isActive) return null;

    // Check expiration
    if (invite.expiresAt && Date.now() > invite.expiresAt) return null;

    // Check max uses
    if (invite.maxUses && invite.useCount >= invite.maxUses) return null;

    const board = await ctx.db.get(invite.boardId);
    const creator = await ctx.db.get(invite.createdById);

    return {
      boardName: board?.name || "Unknown Board",
      role: invite.role,
      creatorName: creator?.name || "Unknown",
      boardId: invite.boardId,
    };
  },
});

export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const invite = await ctx.db
      .query("boardInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite || !invite.isActive) throw new Error("Invalid or expired invite");
    if (invite.expiresAt && Date.now() > invite.expiresAt) throw new Error("Invite expired");
    if (invite.maxUses && invite.useCount >= invite.maxUses) throw new Error("Invite max uses reached");

    // Check if already a member
    const existingMember = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", invite.boardId).eq("userId", user._id)
      )
      .first();

    if (existingMember) {
      return { boardId: invite.boardId, alreadyMember: true };
    }

    // Add as member
    await ctx.db.insert("boardMembers", {
      boardId: invite.boardId,
      userId: user._id,
      role: invite.role,
      createdAt: Date.now(),
    });

    // Increment use count
    await ctx.db.patch(invite._id, { useCount: invite.useCount + 1 });

    return { boardId: invite.boardId, alreadyMember: false };
  },
});
```

- [ ] **Step 2: Verify compilation, commit**

```bash
npx convex dev --once
git add convex/invites.ts
git commit -m "feat: add invite links backend (create, accept, revoke, getByToken)"
```

### Task 13: Frontend — Invite accept page

**Files:**
- Create: `src/routes/invite.$token.tsx`

- [ ] **Step 1: Create invite page route**

```typescript
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useState } from "react";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { userEmail } = useConvexUser();
  const invite = useQuery(api.invites.getByToken, { token });
  const acceptInvite = useMutation(api.invites.accept);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!userEmail) {
    // Redirect to login, preserve invite URL for after login
    navigate({ to: "/login", search: { redirect: `/invite/${token}` } });
    return null;
  }

  if (invite === undefined) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-dark-muted">Loading...</div>
      </div>
    );
  }

  if (invite === null) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="bg-dark-surface border border-dark-border rounded-xl p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-dark-text mb-2">Invalid Invite</h1>
          <p className="text-dark-muted mb-4">This invite link is invalid, expired, or has reached its maximum uses.</p>
          <button
            onClick={() => navigate({ to: "/boards" })}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Go to Boards
          </button>
        </div>
      </div>
    );
  }

  const handleAccept = async () => {
    try {
      setAccepting(true);
      setError(null);
      const result = await acceptInvite({ token });
      navigate({ to: "/boards/$boardId", params: { boardId: result.boardId } });
    } catch (e: any) {
      setError(e.message || "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="bg-dark-surface border border-dark-border rounded-xl p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold text-dark-text mb-2">Board Invitation</h1>
        <p className="text-dark-muted mb-6">
          <span className="text-dark-text font-medium">{invite.creatorName}</span> invited you to join{" "}
          <span className="text-dark-text font-medium">{invite.boardName}</span> as{" "}
          <span className="text-accent font-medium">{invite.role}</span>.
        </p>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate({ to: "/boards" })}
            className="px-4 py-2 border border-dark-border text-dark-text rounded-lg hover:bg-dark-hover transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {accepting ? "Joining..." : "Join Board"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/invite.\$token.tsx
git commit -m "feat: add invite accept page route"
```

### Task 14: Frontend — Invite link manager in BoardMembers

**Files:**
- Create: `src/components/InviteLinkManager.tsx`
- Modify: Board members modal component (find the exact component)

- [ ] **Step 1: Create InviteLinkManager component**

Component that shows inside the BoardMembers modal:
- "Create Invite Link" button with role selector
- List of active invite links with copy + revoke buttons
- Shows invite URL, role, uses, expiration

- [ ] **Step 2: Integrate into BoardMembers modal**

Add an "Invite Links" section (visible for admin+) at the top of the members modal.

- [ ] **Step 3: Verify in browser, commit**

```bash
git add src/components/InviteLinkManager.tsx src/components/kanban/BoardMembers.tsx
git commit -m "feat: add invite link manager UI in board members modal"
```

---

## Chunk 5: Bulk Operations

### Task 15: Backend — Bulk mutations

**Files:**
- Modify: `convex/cards.ts` (add bulkUpdatePriority, bulkArchive, bulkDelete, bulkSetVersion)
- Modify: `convex/labels.ts` (add bulkAddToCards, bulkRemoveFromCards)

- [ ] **Step 1: Add bulk mutations to cards.ts**

Add these mutations. Each one: collects all cards, verifies they belong to the same board, checks board access, then performs the batch update.

```typescript
export const bulkUpdatePriority = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    // Get first card to determine board
    const firstCard = await ctx.db.get(args.cardIds[0]);
    if (!firstCard) throw new Error("Card not found");
    const boardId = await getBoardIdFromCard(ctx, firstCard._id);
    if (!boardId) throw new Error("Board not found");
    await requireBoardAccess(ctx, user._id, boardId, "member");

    for (const cardId of args.cardIds) {
      await ctx.db.patch(cardId, { priority: args.priority, updatedAt: Date.now() });
    }
  },
});

// bulkArchive, bulkDelete, bulkSetVersion follow same pattern
```

- [ ] **Step 2: Add bulk label mutations to labels.ts**

```typescript
export const bulkAddToCards = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    // Verify board access, then for each card:
    // Check if cardLabel already exists, skip if so, else insert
  },
});

export const bulkRemoveFromCards = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    // For each card, find and delete the cardLabel entry
  },
});
```

- [ ] **Step 3: Verify compilation, commit**

```bash
npx convex dev --once
git add convex/cards.ts convex/labels.ts
git commit -m "feat: add bulk operation mutations for cards and labels"
```

### Task 16: Frontend — Bulk select hook and action bar

**Files:**
- Create: `src/hooks/useBulkSelect.ts`
- Create: `src/components/kanban/BulkActionBar.tsx`
- Modify: `src/routes/boards.$boardId.index.tsx`
- Modify: `src/components/kanban/KanbanCard.tsx`

- [ ] **Step 1: Create useBulkSelect hook**

```typescript
import { useState, useCallback } from "react";
import type { Id } from "convex/_generated/dataModel";

export function useBulkSelect() {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<Id<"cards">>>(new Set());

  const toggleCard = useCallback((cardId: Id<"cards">) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedCardIds(new Set());
  }, []);

  const isSelected = useCallback(
    (cardId: Id<"cards">) => selectedCardIds.has(cardId),
    [selectedCardIds]
  );

  return {
    selectedCardIds,
    selectedCount: selectedCardIds.size,
    isSelectionMode: selectedCardIds.size > 0,
    toggleCard,
    clearSelection,
    isSelected,
  };
}
```

- [ ] **Step 2: Create BulkActionBar component**

Floating bar at bottom of screen showing:
- "{N} cards selected" count
- Priority dropdown (Low/Medium/High)
- Label picker button (opens label selector)
- Version picker button
- Archive button
- Delete button (with ConfirmDialog)
- "Deselect All" button

Each action calls the corresponding bulk mutation, then clears selection.

- [ ] **Step 3: Integrate into board route and KanbanCard**

In `boards.$boardId.index.tsx`:
- Import `useBulkSelect` and `BulkActionBar`
- Pass `onShiftClick` to KanbanBoard/KanbanCard for selection
- Render `<BulkActionBar>` when `isSelectionMode`

In `KanbanCard.tsx`:
- Accept `isSelected` and `onShiftClick` props
- On Shift+Click, call `onShiftClick(card._id)` instead of normal click
- Show checkbox overlay and accent border when selected

- [ ] **Step 4: Verify in browser, commit**

```bash
git add src/hooks/useBulkSelect.ts src/components/kanban/BulkActionBar.tsx src/routes/boards.$boardId.index.tsx src/components/kanban/KanbanCard.tsx src/components/kanban/KanbanBoard.tsx
git commit -m "feat: add bulk operations with multi-select and floating action bar"
```

---

## Chunk 6: Real-time Presence

### Task 17: Schema — Add boardPresence table

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add boardPresence table**

```typescript
boardPresence: defineTable({
  boardId: v.id("boards"),
  userId: v.id("users"),
  activeCardId: v.optional(v.id("cards")),
  lastSeen: v.number(),
  createdAt: v.number(),
})
  .index("by_board", ["boardId"])
  .index("by_user_and_board", ["userId", "boardId"]),
```

- [ ] **Step 2: Push schema, commit**

```bash
npx convex dev --once
git add convex/schema.ts
git commit -m "feat: add boardPresence table to schema"
```

### Task 18: Backend — Presence mutations and cleanup

**Files:**
- Create: `convex/presence.ts`
- Create or modify: `convex/crons.ts` (for stale presence cleanup)

- [ ] **Step 1: Create presence.ts**

```typescript
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireAuth } from "./lib/rbac";

const STALE_THRESHOLD_MS = 30_000; // 30 seconds

export const heartbeat = mutation({
  args: {
    boardId: v.id("boards"),
    activeCardId: v.optional(v.id("cards")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const existing = await ctx.db
      .query("boardPresence")
      .withIndex("by_user_and_board", (q) =>
        q.eq("userId", user._id).eq("boardId", args.boardId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        activeCardId: args.activeCardId,
        lastSeen: Date.now(),
      });
    } else {
      await ctx.db.insert("boardPresence", {
        boardId: args.boardId,
        userId: user._id,
        activeCardId: args.activeCardId,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      });
    }
  },
});

export const leave = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const existing = await ctx.db
      .query("boardPresence")
      .withIndex("by_user_and_board", (q) =>
        q.eq("userId", user._id).eq("boardId", args.boardId)
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("boardPresence")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const now = Date.now();
    const active = all.filter((p) => now - p.lastSeen < STALE_THRESHOLD_MS);

    return Promise.all(
      active.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        let cardSlug: string | undefined;
        if (p.activeCardId) {
          const card = await ctx.db.get(p.activeCardId);
          cardSlug = card?.slug;
        }
        return {
          userId: p.userId,
          userName: user?.name || "Unknown",
          userImage: user?.image,
          activeCardSlug: cardSlug,
        };
      })
    );
  },
});

// Cron cleanup
export const cleanupStale = internalMutation({
  handler: async (ctx) => {
    const cutoff = Date.now() - 5 * 60_000; // 5 minutes
    const all = await ctx.db.query("boardPresence").collect();
    for (const p of all) {
      if (p.lastSeen < cutoff) {
        await ctx.db.delete(p._id);
      }
    }
  },
});
```

- [ ] **Step 2: Create or update crons.ts**

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup stale presence",
  { minutes: 2 },
  internal.presence.cleanupStale
);

export default crons;
```

If `convex/crons.ts` already exists, add the presence cron to it.

- [ ] **Step 3: Verify, commit**

```bash
npx convex dev --once
git add convex/presence.ts convex/crons.ts
git commit -m "feat: add presence backend with heartbeat, list, and cron cleanup"
```

### Task 19: Frontend — Presence hook and bar

**Files:**
- Create: `src/hooks/usePresence.ts`
- Create: `src/components/kanban/PresenceBar.tsx`
- Modify: `src/routes/boards.$boardId.index.tsx`

- [ ] **Step 1: Create usePresence hook**

```typescript
import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

const HEARTBEAT_INTERVAL = 15_000;

export function usePresence(boardId: Id<"boards">, activeCardId?: Id<"cards">) {
  const heartbeat = useMutation(api.presence.heartbeat);
  const leave = useMutation(api.presence.leave);
  const onlineUsers = useQuery(api.presence.list, { boardId });
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // Initial heartbeat
    heartbeat({ boardId, activeCardId });

    // Periodic heartbeat
    intervalRef.current = setInterval(() => {
      heartbeat({ boardId, activeCardId });
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      leave({ boardId });
    };
  }, [boardId]); // eslint-disable-line

  // Update activeCardId on change
  useEffect(() => {
    heartbeat({ boardId, activeCardId });
  }, [activeCardId]); // eslint-disable-line

  return { onlineUsers: onlineUsers || [] };
}
```

- [ ] **Step 2: Create PresenceBar component**

Shows up to 5 user avatars with colored ring. Tooltip shows name + card being viewed. +N overflow.

- [ ] **Step 3: Integrate into board route header**

In `boards.$boardId.index.tsx`, call `usePresence(boardId, selectedCard?._id)` and render `<PresenceBar>` in the top bar next to notification bell.

- [ ] **Step 4: Verify, commit**

```bash
git add src/hooks/usePresence.ts src/components/kanban/PresenceBar.tsx src/routes/boards.$boardId.index.tsx
git commit -m "feat: add real-time presence indicators on board"
```

---

## Chunk 7: Webhooks

### Task 20: Schema — Add webhooks table

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add webhooks table**

```typescript
webhooks: defineTable({
  boardId: v.id("boards"),
  name: v.string(),
  url: v.string(),
  type: v.union(v.literal("generic"), v.literal("slack"), v.literal("discord")),
  events: v.array(v.string()),
  secret: v.optional(v.string()),
  isActive: v.boolean(),
  createdById: v.id("users"),
  lastTriggeredAt: v.optional(v.number()),
  lastStatus: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_board", ["boardId"]),
```

- [ ] **Step 2: Push schema, commit**

```bash
npx convex dev --once
git add convex/schema.ts
git commit -m "feat: add webhooks table to schema"
```

### Task 21: Backend — Webhook CRUD and dispatch

**Files:**
- Create: `convex/webhooks.ts`
- Create: `convex/lib/webhookDispatch.ts`

- [ ] **Step 1: Create webhooks.ts with CRUD mutations**

Mutations: `create`, `list` (strips secret), `update`, `remove`, `test` (action), `dispatch` (internal action).

`create` validates HTTPS URL. `list` returns webhooks without secret field. `test` sends a test payload.

- [ ] **Step 2: Create webhookDispatch helper**

Internal action that:
1. Queries webhooks for `boardId` + matching event in `events` array
2. Filters to active webhooks only
3. For each webhook, formats payload based on type:
   - `generic`: JSON with HMAC-SHA256 signature header
   - `slack`: Slack Block Kit message
   - `discord`: Discord embed
4. Sends HTTP POST with 10s timeout
5. Updates `lastTriggeredAt` and `lastStatus`

- [ ] **Step 3: Verify, commit**

```bash
npx convex dev --once
git add convex/webhooks.ts convex/lib/webhookDispatch.ts
git commit -m "feat: add webhook CRUD and dispatch backend"
```

### Task 22: Backend — Add webhook triggers to existing mutations

**Files:**
- Modify: `convex/cards.ts` (create, update, reorder, archive)
- Modify: `convex/comments.ts` (create)
- Modify: `convex/members.ts` (add)
- Modify: `convex/invites.ts` (accept)

- [ ] **Step 1: Add webhook dispatch calls**

At the end of each relevant mutation, add:
```typescript
ctx.scheduler.runAfter(0, internal.webhooks.dispatch, {
  boardId,
  event: "card.created", // appropriate event
  data: { card: { id: cardId, slug, title, priority }, user: { id: user._id, name: user.name } },
});
```

Mutations to modify:
- `cards.create` → `card.created`
- `cards.update` → `card.updated`
- `cards.reorderCards` (when card moves columns) → `card.moved`
- `cards.remove` (archive) → `card.archived`
- `cards.bulkArchive` → `card.archived` (one dispatch per card)
- `comments.create` → `comment.created`
- `members.add` → `member.joined`
- `invites.accept` → `member.joined`

- [ ] **Step 2: Verify compilation, commit**

```bash
npx convex dev --once
git add convex/cards.ts convex/comments.ts convex/members.ts convex/invites.ts
git commit -m "feat: add webhook dispatch triggers to existing mutations"
```

### Task 23: Frontend — Webhook management page

**Files:**
- Create: `src/routes/boards.$boardId.webhooks.tsx` or `src/routes/boards.$boardId.webhooks.index.tsx`
- Create: `src/components/WebhookManager.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (add webhooks link)

- [ ] **Step 1: Create webhook management route**

Page showing:
- List of webhooks with name, URL, type badge, active toggle, status indicator
- "Add Webhook" button opens form
- Form: name input, URL input, type selector (generic/slack/discord), event checkboxes, secret input (for generic)
- Each webhook row has: edit, test, delete buttons
- Test button calls the test action and shows result toast

- [ ] **Step 2: Create WebhookManager component**

CRUD interface with:
- Webhook list table/cards
- Create/edit form modal
- Event checkbox grid
- Type selector with icons (generic/Slack/Discord)
- Status indicator (green dot = last 200, red = error, gray = never triggered)

- [ ] **Step 3: Add webhooks link to Sidebar**

In `Sidebar.tsx`, add a "Webhooks" link under the board sub-navigation (next to Documents, Secrets, Archive). Only show for admin+ role.

Path: `/boards/${boardId}/webhooks`

- [ ] **Step 4: Verify in browser, commit**

```bash
git add src/routes/boards.\$boardId.webhooks.tsx src/components/WebhookManager.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: add webhook management page and sidebar link"
```

---

## Final Task

### Task 24: Final verification and cleanup

- [ ] **Step 1: Run build to check for type errors**

```bash
pnpm build
```

Fix any TypeScript errors.

- [ ] **Step 2: Verify all features in browser**

1. Comment reactions: add/remove reactions on comments
2. Card watchers: toggle watch, verify notification delivery
3. Keyboard shortcuts: arrow nav, N/E/A actions, ? help modal, B navigation
4. Invite links: create invite, copy link, open in incognito, accept
5. Bulk operations: Shift+click to select, use action bar
6. Presence: open board in 2 tabs, see other user's avatar
7. Webhooks: create webhook, test it, verify Slack/Discord format

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: cleanup and type fixes for all 7 features"
```
