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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_card", ["cardId"])
    .index("by_author", ["authorId"]),
});
