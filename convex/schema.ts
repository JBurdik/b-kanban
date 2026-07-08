import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Convex Auth owns the auth tables (authSessions, authAccounts, authVerificationCodes,
// authRefreshTokens, authVerifiers, authRateLimits) + the users table. We extend
// users with our app-specific fields. authAccounts.secret holds the password hash;
// legacy better-auth hashes are verified via convex/lib/legacyPassword.ts.
const { users: _authUsers, ...authTablesRest } = authTables;

export default defineSchema({
  ...authTablesRest,

  // users = Convex Auth users + our app fields. name/email optional per Convex
  // Auth; in practice the Password provider's profile() always sets email+name.
  // Legacy fields (emailVerified/createdAt/updatedAt) kept optional for existing rows.
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // app fields
    role: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // ============================================
  // Application Tables
  // ============================================

  // Boards table
  boards: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    slugPrefix: v.string(),
    cardCounter: v.number(),
    ownerId: v.id("users"),
    // Board icon (either emoji or uploaded image)
    iconType: v.optional(v.union(v.literal("emoji"), v.literal("image"))),
    iconEmoji: v.optional(v.string()),
    iconStorageId: v.optional(v.id("_storage")),
    // Configurable badge shown next to board title (admins/owners can edit)
    badgeText: v.optional(v.string()),
    badgeColor: v.optional(v.string()), // palette key, e.g. "blue"
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  // Board members (for role-based access)
  boardMembers: defineTable({
    boardId: v.id("boards"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    createdAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_user", ["userId"])
    .index("by_board_and_user", ["boardId", "userId"]),

  // Columns table
  columns: defineTable({
    boardId: v.id("boards"),
    name: v.string(),
    position: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_board_position", ["boardId", "position"]),

  // Cards table
  cards: defineTable({
    columnId: v.id("columns"),
    slug: v.string(),
    title: v.string(),
    content: v.optional(v.string()),
    position: v.number(),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    type: v.optional(v.union(v.literal("task"), v.literal("bug"))),
    assigneeId: v.optional(v.id("users")),
    versionId: v.optional(v.id("versions")),
    dueDate: v.optional(v.number()),
    effort: v.optional(v.number()), // Time effort in hours
    reporterId: v.optional(v.id("users")), // Who created the card
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_column", ["columnId"])
    .index("by_column_position", ["columnId", "position"])
    .index("by_slug", ["slug"])
    .index("by_assignee", ["assigneeId"]),

  // Attachments table (uses Convex file storage)
  attachments: defineTable({
    cardId: v.id("cards"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    storageId: v.id("_storage"),
    uploadedById: v.optional(v.id("users")),
    createdAt: v.number(),
  }).index("by_card", ["cardId"]),

  // Comments table
  comments: defineTable({
    cardId: v.id("cards"),
    authorId: v.id("users"),
    content: v.string(),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_card", ["cardId"])
    .index("by_author", ["authorId"]),

  // Card activity / history log. One row per change (created, moved,
  // field edit, archive/restore, label add/remove). Values stored as
  // display strings; column moves store names, not ids.
  cardActivity: defineTable({
    cardId: v.id("cards"),
    userId: v.id("users"),
    action: v.string(), // created | moved | field | archived | restored | label_added | label_removed
    field: v.optional(v.string()), // e.g. title, priority, assignee, column
    oldValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_card", ["cardId"]),

  // Notifications table
  notifications: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("assigned"),
      v.literal("mentioned"),
      v.literal("commented"),
      v.literal("card_updated"),
    ),
    cardId: v.id("cards"),
    boardId: v.id("boards"),
    fromUserId: v.id("users"),
    read: v.boolean(),
    message: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"])
    .index("by_card", ["cardId"])
    .index("by_user_type", ["userId", "type"]),

  // ============================================
  // Time Tracking Tables
  // ============================================

  // Time entries - logged time records
  timeEntries: defineTable({
    userId: v.id("users"),
    cardId: v.optional(v.id("cards")), // Optional link to card
    boardId: v.optional(v.id("boards")), // Denormalized for filtering
    description: v.string(),
    durationMs: v.number(), // Duration in milliseconds
    date: v.number(), // Start of day timestamp
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_card", ["cardId"])
    .index("by_user_board", ["userId", "boardId"]),

  // Active timers - persisted timer state (one per user)
  activeTimers: defineTable({
    userId: v.id("users"),
    cardId: v.optional(v.id("cards")),
    boardId: v.optional(v.id("boards")),
    description: v.string(),
    startedAt: v.number(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // ============================================
  // Documents Tables
  // ============================================

  // Documents - shared notes/docs per board
  documents: defineTable({
    boardId: v.id("boards"),
    title: v.string(),
    content: v.optional(v.string()), // TipTap HTML content
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_board_updated", ["boardId", "updatedAt"]),

  // HTML documentation files per board (raw HTML stored in Convex file storage,
  // rendered in a sandboxed iframe). Uploadable via UI or the remote MCP server.
  htmlDocs: defineTable({
    boardId: v.id("boards"),
    title: v.string(),
    fileName: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_board_updated", ["boardId", "updatedAt"]),

  // Infinite canvases per board (Excalidraw scenes).
  // ponytail: whole scene in one doc. Convex caps a doc at 1MB (~a few thousand
  // elements). If that becomes a real limit, move to one row per element keyed by
  // (canvasId, elementId) and reconcile on version/versionNonce.
  canvases: defineTable({
    boardId: v.id("boards"),
    name: v.string(),
    elements: v.string(), // JSON.stringify(ExcalidrawElement[])
    appState: v.string(), // JSON.stringify(persisted appState subset)
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_board_updated", ["boardId", "updatedAt"]),

  // Image bytes referenced by canvas elements. Kept out of the canvas doc so
  // images never count against its 1MB budget.
  canvasFiles: defineTable({
    canvasId: v.id("canvases"),
    fileId: v.string(), // Excalidraw BinaryFileData.id
    storageId: v.id("_storage"),
    mimeType: v.string(),
  })
    .index("by_canvas", ["canvasId"])
    .index("by_canvas_file", ["canvasId", "fileId"]),

  // Card-Canvas links (many-to-many), mirroring documentLinks
  canvasLinks: defineTable({
    cardId: v.id("cards"),
    canvasId: v.id("canvases"),
    createdById: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_card", ["cardId"])
    .index("by_canvas", ["canvasId"]),

  // Card-Document links (many-to-many)
  documentLinks: defineTable({
    cardId: v.id("cards"),
    documentId: v.id("documents"),
    createdById: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_card", ["cardId"])
    .index("by_document", ["documentId"]),
  // ============================================
  // Labels Tables
  // ============================================

  // Labels table - board-specific labels
  labels: defineTable({
    boardId: v.id("boards"),
    name: v.string(),
    color: v.string(), // Tailwind bg class e.g., "bg-blue-500"
    textColor: v.string(), // Tailwind text class e.g., "text-white"
    applyToCardBg: v.boolean(), // If true, cards with this label get colored bg
    createdAt: v.number(),
  }).index("by_board", ["boardId"]),

  // Junction table for card-label many-to-many
  cardLabels: defineTable({
    cardId: v.id("cards"),
    labelId: v.id("labels"),
    createdAt: v.number(),
  })
    .index("by_card", ["cardId"])
    .index("by_label", ["labelId"]),

  // Versions table - board-specific milestones/releases
  versions: defineTable({
    boardId: v.id("boards"),
    name: v.string(), // e.g., "v1.0", "Sprint 3"
    color: v.string(), // Tailwind color class e.g., "bg-purple-500"
    isActive: v.boolean(), // Active versions shown prominently
    createdAt: v.number(),
  })
    .index("by_board", ["boardId"]),

  // Secrets Table - E2E Encrypted
  // ============================================

  // Secret groups for organizing secrets by app/service
  secretGroups: defineTable({
    boardId: v.id("boards"),
    name: v.string(), // e.g., "Landing Page", "Admin", "Reservation App"
    color: v.optional(v.string()), // Hex color for visual distinction
    createdAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_board_name", ["boardId", "name"]),

  // ============================================
  // Comment Reactions
  // ============================================
  commentReactions: defineTable({
    commentId: v.id("comments"),
    userId: v.id("users"),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_comment", ["commentId"])
    .index("by_comment_and_user", ["commentId", "userId"]),

  // ============================================
  // Card Watchers
  // ============================================
  cardWatchers: defineTable({
    cardId: v.id("cards"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_card", ["cardId"])
    .index("by_user", ["userId"])
    .index("by_card_and_user", ["cardId", "userId"]),

  // ============================================
  // Board Invites
  // ============================================
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

  // ============================================
  // Board Presence
  // ============================================
  boardPresence: defineTable({
    boardId: v.id("boards"),
    userId: v.id("users"),
    activeCardId: v.optional(v.id("cards")),
    lastSeen: v.number(),
    createdAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_user_and_board", ["userId", "boardId"]),

  // ============================================
  // Board Cursors (high-frequency, separate from boardPresence)
  // ============================================
  boardCursors: defineTable({
    boardId: v.id("boards"),
    userId: v.id("users"),
    x: v.number(), // content-space px (includes scrollLeft)
    y: v.number(), // content-space px (includes scrollTop)
    lastSeen: v.number(),
    cardId: v.optional(v.id("cards")), // set when cursor is inside a card panel
  })
    .index("by_board", ["boardId"])
    .index("by_user_and_board", ["userId", "boardId"]),

  // ============================================
  // Webhooks
  // ============================================
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
  }).index("by_board", ["boardId"]),

  // Per-user API keys for the remote MCP server (Claude Code over HTTP).
  // Only the SHA-256 hash is stored; the plaintext key is shown once at creation.
  mcpApiKeys: defineTable({
    userId: v.id("users"),
    name: v.string(), // user-facing label, e.g. "laptop"
    keyHash: v.string(), // SHA-256 hex of the full key
    prefix: v.string(), // first chars for display, e.g. "bprod_a1b2c3"
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["keyHash"]),

  secrets: defineTable({
    boardId: v.id("boards"),
    name: v.string(), // e.g., "API_KEY", "DATABASE_URL"
    encryptedValue: v.string(), // Base64 AES-256-GCM ciphertext
    iv: v.string(), // Base64 initialization vector
    salt: v.string(), // Base64 PBKDF2 salt
    visibility: v.union(v.literal("public"), v.literal("hidden")),
    description: v.optional(v.string()),
    groupId: v.optional(v.id("secretGroups")), // Optional group for organization
    createdById: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_board", ["boardId"])
    .index("by_board_name", ["boardId", "name"])
    .index("by_group", ["groupId"]),
});
