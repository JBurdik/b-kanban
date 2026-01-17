import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============================================
  // Better Auth Tables
  // These are managed by @convex-dev/better-auth component
  // but we define them here for type safety
  // ============================================

  users: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    role: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    expiresAt: v.number(),
    token: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  accounts: defineTable({
    userId: v.id("users"),
    accountId: v.string(),
    providerId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  verifications: defineTable({
    identifier: v.string(),
    value: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_identifier", ["identifier"]),

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
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    effort: v.optional(v.number()), // Time effort in hours
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
    .index("by_card", ["cardId"]),

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

  // Card-Document links (many-to-many)
  documentLinks: defineTable({
    cardId: v.id("cards"),
    documentId: v.id("documents"),
    createdById: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_card", ["cardId"])
    .index("by_document", ["documentId"]),
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
