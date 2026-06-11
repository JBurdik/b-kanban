import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOptionalAuth, requireAuth, requireBoardAccess, checkBoardAccess } from "./lib/rbac";

/**
 * Generate slug prefix from board name
 */
function generateSlugPrefix(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 4).toUpperCase();
  }
  return words
    .map((w) => w[0])
    .join("")
    .substring(0, 4)
    .toUpperCase();
}

/**
 * Get all boards for a user
 */
export const list = query({
  args: {},
  handler: async (ctx, _args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) {
      return [];
    }

    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const boardIds = memberships.map((m) => m.boardId);

    const boards = await Promise.all(
      boardIds.map(async (boardId) => {
        const board = await ctx.db.get(boardId);
        if (!board) return null;

        const columns = await ctx.db
          .query("columns")
          .withIndex("by_board", (q) => q.eq("boardId", boardId))
          .collect();

        const membership = memberships.find((m) => m.boardId === boardId);

        // Get icon URL if board has an uploaded image icon
        const iconUrl = board.iconStorageId
          ? await ctx.storage.getUrl(board.iconStorageId)
          : null;

        return {
          ...board,
          iconUrl,
          columnCount: columns.length,
          userRole: membership?.role,
        };
      }),
    );

    return boards.filter(Boolean);
  },
});

/**
 * Get single board with all data
 */
export const get = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const board = await ctx.db.get(args.boardId);
    if (!board) throw new Error("Board not found");

    // Look up current user to get role
    const currentUser = await getOptionalAuth(ctx);
    const currentUserId: Id<"users"> | undefined = currentUser?._id;

    // Only board members may read the board's contents.
    if (!currentUserId) return null;
    const { hasAccess } = await checkBoardAccess(
      ctx,
      currentUserId,
      args.boardId,
      "member",
    );
    if (!hasAccess) return null;

    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    columns.sort((a, b) => a.position - b.position);

    const columnsWithCards = await Promise.all(
      columns.map(async (column) => {
        const cards = await ctx.db
          .query("cards")
          .withIndex("by_column", (q) => q.eq("columnId", column._id))
          .filter((q) => q.neq(q.field("isArchived"), true))
          .collect();

        cards.sort((a, b) => a.position - b.position);

        const cardsWithAssignee = await Promise.all(
          cards.map(async (card) => {
            let assignee = null;
            if (card.assigneeId) {
              const assigneeUser = await ctx.db.get(card.assigneeId);
              if (assigneeUser) {
                assignee = {
                  id: assigneeUser._id,
                  name: assigneeUser.name ?? "",
                  email: assigneeUser.email ?? "",
                  image: assigneeUser.image,
                };
              }
            }

            // Fetch labels for this card
            const cardLabels = await ctx.db
              .query("cardLabels")
              .withIndex("by_card", (q) => q.eq("cardId", card._id))
              .collect();

            const labelPromises = await Promise.all(
              cardLabels.map(async (cl) => {
                const label = await ctx.db.get(cl.labelId);
                return label;
              })
            );

            const labels = labelPromises.filter(
              (l): l is NonNullable<typeof l> => l !== null
            );

            // Fetch version info
            let version = null;
            if (card.versionId) {
              const v = await ctx.db.get(card.versionId);
              if (v) {
                version = { _id: v._id, name: v.name, color: v.color };
              }
            }

            // Fetch reporter info
            let reporter = null;
            if (card.reporterId) {
              const reporterUser = await ctx.db.get(card.reporterId);
              if (reporterUser) {
                reporter = {
                  id: reporterUser._id,
                  name: reporterUser.name ?? "",
                  email: reporterUser.email ?? "",
                  image: reporterUser.image,
                };
              }
            }

            return {
              ...card,
              assignee,
              reporter,
              labels,
              version,
            };
          }),
        );

        return { ...column, cards: cardsWithAssignee };
      }),
    );

    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return {
          id: m._id,
          role: m.role,
          userId: m.userId,
          user: memberUser
            ? {
                id: memberUser._id,
                name: memberUser.name ?? "",
                email: memberUser.email ?? "",
                image: memberUser.image,
              }
            : null,
        };
      }),
    );

    const userRole = currentUserId
      ? memberships.find((m) => m.userId === currentUserId)?.role
      : undefined;

    // Get icon URL if board has an uploaded image icon
    const iconUrl = board.iconStorageId
      ? await ctx.storage.getUrl(board.iconStorageId)
      : null;

    return {
      ...board,
      iconUrl,
      columns: columnsWithCards,
      members,
      userRole,
    };
  },
});

/**
 * Create a new board
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const now = Date.now();
    const slugPrefix = generateSlugPrefix(args.name);

    const boardId = await ctx.db.insert("boards", {
      name: args.name,
      description: args.description,
      slugPrefix,
      cardCounter: 0,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    const defaultColumns = ["To Do", "In Progress", "Done"];
    for (let i = 0; i < defaultColumns.length; i++) {
      await ctx.db.insert("columns", {
        boardId,
        name: defaultColumns[i],
        position: i,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("boardMembers", {
      boardId,
      userId: user._id,
      role: "owner",
      createdAt: now,
    });

    return boardId;
  },
});

/**
 * Update board
 */
export const update = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const membership = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new Error("Only owners and admins can edit the board");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.boardId, updates);

    return args.boardId;
  },
});

/**
 * Delete board
 */
export const remove = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId, "owner");

    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    for (const column of columns) {
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_column", (q) => q.eq("columnId", column._id))
        .collect();

      for (const card of cards) {
        const attachments = await ctx.db
          .query("attachments")
          .withIndex("by_card", (q) => q.eq("cardId", card._id))
          .collect();

        for (const att of attachments) {
          await ctx.storage.delete(att.storageId);
          await ctx.db.delete(att._id);
        }

        await ctx.db.delete(card._id);
      }

      await ctx.db.delete(column._id);
    }

    const members = await ctx.db
      .query("boardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete all documents and their links
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    for (const doc of documents) {
      // Delete document links first
      const docLinks = await ctx.db
        .query("documentLinks")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();

      for (const link of docLinks) {
        await ctx.db.delete(link._id);
      }

      await ctx.db.delete(doc._id);
    }

    // Delete board icon from storage if exists
    const board = await ctx.db.get(args.boardId);
    if (board?.iconStorageId) {
      await ctx.storage.delete(board.iconStorageId);
    }

    await ctx.db.delete(args.boardId);

    return { success: true };
  },
});

/**
 * Set/clear the board badge (admins and owners only)
 * Empty/undefined text clears the badge.
 */
export const setBadge = mutation({
  args: {
    boardId: v.id("boards"),
    text: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const membership = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new Error("Only owners and admins can change the board badge");
    }

    const text = args.text?.trim();
    await ctx.db.patch(args.boardId, {
      badgeText: text ? text : undefined,
      badgeColor: text ? args.color : undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Generate upload URL for board icon
 */
export const generateIconUploadUrl = mutation({
  args: {
    boardId: v.id("boards"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check membership (should be owner or admin)
    const membership = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new Error("Only owners and admins can change board icon");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save uploaded board icon
 */
export const saveIcon = mutation({
  args: {
    boardId: v.id("boards"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check membership
    const membership = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new Error("Only owners and admins can change board icon");
    }

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    // Delete old icon from storage if exists
    if (board.iconStorageId) {
      await ctx.storage.delete(board.iconStorageId);
    }

    await ctx.db.patch(args.boardId, {
      iconType: "image",
      iconStorageId: args.storageId,
      iconEmoji: undefined,
      updatedAt: Date.now(),
    });

    const url = await ctx.storage.getUrl(args.storageId);
    return { success: true, url };
  },
});

/**
 * Set emoji icon for board
 */
export const setEmojiIcon = mutation({
  args: {
    boardId: v.id("boards"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check membership
    const membership = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new Error("Only owners and admins can change board icon");
    }

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    // Delete old image icon from storage if exists
    if (board.iconStorageId) {
      await ctx.storage.delete(board.iconStorageId);
    }

    await ctx.db.patch(args.boardId, {
      iconType: "emoji",
      iconEmoji: args.emoji,
      iconStorageId: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Remove board icon
 */
export const removeIcon = mutation({
  args: {
    boardId: v.id("boards"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check membership
    const membership = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();

    if (!membership || membership.role === "member") {
      throw new Error("Only owners and admins can change board icon");
    }

    const board = await ctx.db.get(args.boardId);
    if (!board) {
      throw new Error("Board not found");
    }

    // Delete image from storage if exists
    if (board.iconStorageId) {
      await ctx.storage.delete(board.iconStorageId);
    }

    await ctx.db.patch(args.boardId, {
      iconType: undefined,
      iconEmoji: undefined,
      iconStorageId: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal: List boards for a user identified by email (used by MCP after Bearer auth)
 */
export const listByEmail = internalQuery({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) return [];

    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const boards = await Promise.all(memberships.map((m) => ctx.db.get(m.boardId)));
    return boards.filter(Boolean);
  },
});

/**
 * Internal: Get a board with full data for a user identified by email (used by MCP after Bearer auth)
 */
export const getByEmail = internalQuery({
  args: { boardId: v.id("boards"), userEmail: v.string() },
  handler: async (ctx, args) => {
    const board = await ctx.db.get(args.boardId);
    if (!board) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) return null;

    const userMembership = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();
    if (!userMembership) return null;

    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    columns.sort((a, b) => a.position - b.position);

    const columnsWithCards = await Promise.all(
      columns.map(async (column) => {
        const cards = await ctx.db
          .query("cards")
          .withIndex("by_column", (q) => q.eq("columnId", column._id))
          .filter((q) => q.neq(q.field("isArchived"), true))
          .collect();

        cards.sort((a, b) => a.position - b.position);

        const cardsWithAssignee = await Promise.all(
          cards.map(async (card) => {
            let assignee = null;
            if (card.assigneeId) {
              const assigneeUser = await ctx.db.get(card.assigneeId);
              if (assigneeUser) {
                assignee = {
                  id: assigneeUser._id,
                  name: assigneeUser.name ?? "",
                  email: assigneeUser.email ?? "",
                  image: assigneeUser.image,
                };
              }
            }

            const cardLabels = await ctx.db
              .query("cardLabels")
              .withIndex("by_card", (q) => q.eq("cardId", card._id))
              .collect();

            const labelPromises = await Promise.all(
              cardLabels.map(async (cl) => ctx.db.get(cl.labelId))
            );
            const labels = labelPromises.filter(
              (l): l is NonNullable<typeof l> => l !== null
            );

            let reporter = null;
            if (card.reporterId) {
              const reporterUser = await ctx.db.get(card.reporterId);
              if (reporterUser) {
                reporter = {
                  id: reporterUser._id,
                  name: reporterUser.name ?? "",
                  email: reporterUser.email ?? "",
                  image: reporterUser.image,
                };
              }
            }

            return { ...card, assignee, reporter, labels };
          }),
        );

        return { ...column, cards: cardsWithAssignee };
      }),
    );

    const allMemberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const members = await Promise.all(
      allMemberships.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return {
          id: m._id,
          role: m.role,
          userId: m.userId,
          user: memberUser
            ? {
                id: memberUser._id,
                name: memberUser.name ?? "",
                email: memberUser.email ?? "",
                image: memberUser.image,
              }
            : null,
        };
      }),
    );

    const iconUrl = board.iconStorageId
      ? await ctx.storage.getUrl(board.iconStorageId)
      : null;

    return {
      ...board,
      iconUrl,
      columns: columnsWithCards,
      members,
      userRole: userMembership.role,
    };
  },
});

/**
 * Internal: Create a board for a user identified by email (used by MCP after Bearer auth)
 */
export const createByEmail = internalMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) throw new Error("User not found");

    const now = Date.now();
    const slugPrefix = generateSlugPrefix(args.name);

    const boardId = await ctx.db.insert("boards", {
      name: args.name,
      description: args.description,
      slugPrefix,
      cardCounter: 0,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    const defaultColumns = ["To Do", "In Progress", "Done"];
    for (let i = 0; i < defaultColumns.length; i++) {
      await ctx.db.insert("columns", {
        boardId,
        name: defaultColumns[i],
        position: i,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("boardMembers", {
      boardId,
      userId: user._id,
      role: "owner",
      createdAt: now,
    });

    return boardId;
  },
});
