# Design Spec: 7 New Features

## Cross-cutting Concerns

### Auth Pattern
All new mutations use `requireAuth(ctx)` from `convex/lib/rbac.ts` for session-based auth. Do NOT use the legacy email-passing pattern.

### Board Access
All board-scoped mutations use `requireBoardAccess(ctx, boardId, minRole)`. For bulk operations, validate ALL cards belong to the same board.

### Index Naming
Follow existing convention: `by_x_and_y` for compound indexes.

### Theme
All new UI components use existing dark theme classes: `bg-dark-surface`, `border-dark-border`, `text-dark-text`, `text-dark-muted`, `bg-dark-hover`.

### Cleanup
All new junction tables (`commentReactions`, `cardWatchers`) must be cleaned up in `cards.permanentDelete`.

---

## Feature 1: Real-time Presence (Online Users on Board)

### Overview
Show which users are currently viewing a board and which card they're looking at.

### Data Model
New table `boardPresence`:
```
boardPresence {
  boardId: Id<"boards">
  userId: Id<"users">
  activeCardId?: Id<"cards">    // v.optional(v.id("cards"))
  lastSeen: number              // timestamp, for cleanup
  createdAt: number
  indexes: by_board, by_user_and_board (compound)
}
```

### Backend
- `presence.heartbeat(boardId, activeCardId?)` — mutation, upserts presence row, called every 15s from client
- `presence.list(boardId)` — query, returns users active in last 30s with user info
- `presence.leave(boardId)` — mutation, deletes presence row on unmount
- Stale entries (>30s) filtered out in query
- Cron job: clean up entries older than 5 minutes (scheduled function every 2 min)

### Frontend
- `usePresence(boardId)` hook — sends heartbeat on mount + interval, calls leave on unmount, updates activeCardId when card selected
- `PresenceBar` component in board header — shows avatars of online users with colored ring
- Tooltip on hover shows user name + "viewing CARD-123" if activeCardId set
- Max 5 avatars shown, +N overflow indicator
- Current user excluded from display

### UI Location
Board header, right side, next to notification bell.

---

## Feature 2: Invite Links

### Overview
Generate shareable invite links for boards. Link contains a token; visiting it adds the user as a member.

### Data Model
New table `boardInvites`:
```
boardInvites {
  boardId: Id<"boards">
  token: string               // crypto random, 32 chars
  role: "admin" | "member"    // role assigned on join
  createdById: Id<"users">
  expiresAt?: number          // optional expiration
  maxUses?: number            // optional usage limit
  useCount: number            // current uses
  isActive: boolean
  createdAt: number
  indexes: by_token, by_board
}
```

### Backend
- `invites.create(boardId, role, expiresAt?, maxUses?)` — mutation, requires admin+, generates token
- `invites.list(boardId)` — query, returns active invites for board
- `invites.revoke(inviteId)` — mutation, sets isActive=false, admin+ only
- `invites.accept(token)` — mutation, requires auth, validates token/expiry/uses, adds user as member with specified role, increments useCount
- `invites.getByToken(token)` — query, requires auth, returns invite + board name only (minimal info to prevent leaking)

### Frontend
- New route: `/invite/$token` — requires auth (redirect to login if not). Shows board name, role; "Join Board" button. If already member, show "Already a member" with link to board.
- `InviteLinkManager` component in BoardMembers modal — create/list/revoke invites
- Copy link button with feedback
- Admin+ can create invites, admin+ can revoke

### Invite URL Format
`{SITE_URL}/invite/{token}`

---

## Feature 3: Comment Reactions

### Overview
Predefined emoji reactions on comments: 👍 👎 ❤️ 😄 🎉 👀 ✅

### Data Model
New table `commentReactions`:
```
commentReactions {
  commentId: Id<"comments">
  userId: Id<"users">
  emoji: string               // one of the predefined set
  createdAt: number
  indexes: by_comment, by_comment_and_user (compound for uniqueness)
}
```

### Backend
- `commentReactions.toggle(commentId, emoji)` — mutation, verifies board access via comment→card→column→board chain, adds if not exists, removes if exists (same user+comment+emoji)
- `commentReactions.listByComment(commentId)` — query, returns flat list of reactions. Frontend groups them.

### Frontend
- Reaction bar below each comment — shows existing reactions as pills (emoji + count)
- Clicking existing reaction toggles it (add/remove)
- "+" button at end opens reaction picker (horizontal row of 7 emojis)
- Reacted pills highlighted with accent border
- Tooltip on pill shows user names who reacted
- Grouping logic in frontend: aggregate flat reaction list into `{ emoji, count, userNames[], hasReacted }`

### Predefined Emojis
`['👍', '👎', '❤️', '😄', '🎉', '👀', '✅']`

---

## Feature 4: Card Watchers

### Overview
Users can "watch" a card to receive notifications about changes without being assigned.

### Data Model
New table `cardWatchers`:
```
cardWatchers {
  cardId: Id<"cards">
  userId: Id<"users">
  createdAt: number
  indexes: by_card, by_user, by_card_and_user (compound for uniqueness)
}
```

### Watcher Model
Watchers are **explicit only** — stored as rows in `cardWatchers`. No implicit watchers. Card creator and assignee are NOT auto-added. Users manually toggle watch status.

### Backend
- `cardWatchers.toggle(cardId)` — mutation, adds/removes current user as watcher, checks board access
- `cardWatchers.list(cardId)` — query, returns watchers with user info
- `cardWatchers.isWatching(cardId, userId)` — query, returns boolean
- Update `internal.notifications.create` — after creating notification for assignee/mentioned, also query `cardWatchers` for the card and create notifications for all watchers (excluding action performer and already-notified users). Use existing notification types (`commented`, `card_updated`) — no new type needed.

### Frontend
- Eye icon button in CardSlidePanel header — toggle watch status
- Filled eye = watching, outline = not watching
- Tooltip: "Watch this card" / "Stop watching"
- Watcher count badge next to icon

### Notification Integration
In `internal.notifications.create`, after the existing notification logic, query `cardWatchers.by_card` and send notifications to watchers not already in the recipient set.

---

## Feature 5: Bulk Operations

### Overview
Multi-select cards on the board for batch actions: change priority, add/remove label, archive, delete, add version.

### Data Model
No new tables. New bulk mutations.

### Backend
All bulk mutations: validate ALL cardIds belong to the same board, check board access once.

- `cards.bulkUpdatePriority(cardIds[], priority)` — mutation
- `cards.bulkArchive(cardIds[])` — mutation, sets isArchived + archivedAt
- `cards.bulkDelete(cardIds[])` — mutation, uses shared cleanup helper (attachments, comments, notifications, documentLinks, timeEntries, cardWatchers, commentReactions)
- `cards.bulkSetVersion(cardIds[], versionId | null)` — mutation
- `labels.bulkAddToCards(cardIds[], labelId)` — mutation, skips duplicates
- `labels.bulkRemoveFromCards(cardIds[], labelId)` — mutation

### Frontend
- Enter selection mode via Shift+Click on a card
- Selected cards get accent border + checkbox overlay
- Floating action bar at bottom (z-50, above content, below modals):
  - Count: "3 cards selected"
  - Actions: Priority dropdown, Label picker, Version picker, Archive button, Delete button (with confirm)
  - "Deselect All"
- Escape exits selection mode
- `useBulkSelect()` hook manages selected card IDs set

### Interaction
- Click card in selection mode → toggle selection
- Shift+Click first card → enter selection mode + select that card
- Action applied → clear selection + show toast
- Closing selection mode deselects all

---

## Feature 6: Keyboard Shortcuts

### Overview
Global and contextual keyboard shortcuts for power users.

### Shortcut Map

**Board Navigation:**
| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate between cards in column |
| `←` / `→` | Navigate between columns |
| `Enter` | Open focused card |
| `Escape` | Close panel/modal, exit selection |

**Board Actions:**
| Key | Action |
|-----|--------|
| `N` | New card in focused column (default: first column if none focused) |
| `E` | Edit focused card |
| `A` | Archive focused card |

**Card Detail:**
| Key | Action |
|-----|--------|
| `1` / `2` / `3` | Set priority Low/Med/High |

**Global:**
| Key | Action |
|-----|--------|
| `B` | Go to boards list |
| `?` | Show shortcuts help modal |
| `Cmd/Ctrl+K` | Spotlight (existing) |

### Implementation
- `useKeyboardNavigation(columns)` hook — manages focused column/card index, handles arrow keys
- Focused card gets visible ring/outline (`ring-2 ring-accent`)
- `KeyboardShortcutsModal` — grid of shortcuts, opened with `?`
- Board-scoped shortcuts registered in board route component
- Global shortcuts (`B`, `?`) registered in AppLayout

### Guard
All single-key shortcuts disabled when any of these is true:
```typescript
const isInputFocused = () => {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  if (el.closest('.ProseMirror')) return true; // TipTap editor
  return false;
};
```

---

## Feature 7: Webhooks

### Overview
Board-level webhooks that POST JSON to user-specified URLs when events occur. Plus pre-formatted Slack/Discord integration.

### Data Model
New table `webhooks`:
```
webhooks {
  boardId: Id<"boards">
  name: string
  url: string                  // must be HTTPS
  type: "generic" | "slack" | "discord"
  events: string[]             // event types subscribed to
  secret?: string              // HMAC signing secret (not returned in list queries)
  isActive: boolean
  createdById: Id<"users">
  lastTriggeredAt?: number
  lastStatus?: number
  createdAt: number
  updatedAt: number
  indexes: by_board
}
```

### Events
| Event | Trigger |
|-------|---------|
| `card.created` | New card created |
| `card.updated` | Card fields changed |
| `card.moved` | Card moved to different column |
| `card.archived` | Card archived |
| `comment.created` | New comment on card |
| `member.joined` | New member added to board |

### Backend
- `webhooks.create(boardId, name, url, type, events)` — mutation, admin+ only, validates HTTPS URL
- `webhooks.list(boardId)` — query, strips `secret` from response
- `webhooks.update(webhookId, ...)` — mutation, admin+
- `webhooks.remove(webhookId)` — mutation, admin+
- `webhooks.test(webhookId)` — action, sends test payload
- `lib/webhookDispatch.ts` — internal action:
  - Queries webhooks for board + event type
  - Formats payload per webhook type (generic JSON / Slack blocks / Discord embed)
  - Generic: HMAC-SHA256 signature in `X-Webhook-Signature` header
  - Sets 10s timeout on outbound requests
  - Updates `lastTriggeredAt` and `lastStatus`
- Dispatch called via `ctx.scheduler.runAfter(0, internal.webhooks.dispatch, { boardId, event, data })` from mutations

### Security
- HTTPS-only URLs enforced at creation
- Webhook secrets not returned in list queries
- 10s timeout on outbound requests

### Mutations That Trigger Webhooks
- `cards.create` → `card.created`
- `cards.update` → `card.updated`
- `cards.reorderCards` (cross-column) → `card.moved`
- `cards.archive` / `cards.bulkArchive` → `card.archived`
- `comments.create` → `comment.created`
- `members.add` / `invites.accept` → `member.joined`

### Frontend
- Route: `boards.$boardId.webhooks.tsx` (consistent with docs, secrets, archive)
- Sidebar link under board section (admin+ only)
- CRUD list with active/inactive toggle
- Create/edit form: name, URL, type selector (generic/slack/discord), event checkboxes
- "Test" button sends test event and shows result
- Status indicator (last trigger time + HTTP status badge)

---

## Implementation Order

1. **Comment Reactions** — standalone, simple
2. **Card Watchers** — standalone, extends notifications
3. **Keyboard Shortcuts** — standalone UX improvement
4. **Invite Links** — new route + backend
5. **Bulk Operations** — uses keyboard shortcuts (Escape)
6. **Real-time Presence** — heartbeat + cron
7. **Webhooks** — most complex, touches many mutations
