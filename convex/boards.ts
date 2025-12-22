import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireBoardAccess } from "./lib/rbac";

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
 * Get all boards for current user
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all board memberships for user
    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const boardIds = memberships.map((m) => m.boardId);

    // Fetch boards with columns count
    const boards = await Promise.all(
      boardIds.map(async (boardId) => {
        const board = await ctx.db.get(boardId);
        if (!board) return null;

        const columns = await ctx.db
          .query("columns")
          .withIndex("by_board", (q) => q.eq("boardId", boardId))
          .collect();

        // Get user's role for this board
        const membership = memberships.find((m) => m.boardId === boardId);

        return {
          ...board,
          columnCount: columns.length,
          userRole: membership?.role,
        };
      })
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
    const user = await requireAuth(ctx);
    const { role } = await requireBoardAccess(ctx, user._id, args.boardId, "member");

    const board = await ctx.db.get(args.boardId);
    if (!board) throw new Error("Board not found");

    // Get columns sorted by position
    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    columns.sort((a, b) => a.position - b.position);

    // Get cards for each column
    const columnsWithCards = await Promise.all(
      columns.map(async (column) => {
        const cards = await ctx.db
          .query("cards")
          .withIndex("by_column", (q) => q.eq("columnId", column._id))
          .collect();

        cards.sort((a, b) => a.position - b.position);

        // Get assignee info for each card
        const cardsWithAssignee = await Promise.all(
          cards.map(async (card) => {
            let assignee = null;
            if (card.assigneeId) {
              const assigneeUser = await ctx.db.get(card.assigneeId);
              if (assigneeUser) {
                assignee = {
                  id: assigneeUser._id,
                  name: assigneeUser.name,
                  email: assigneeUser.email,
                  image: assigneeUser.image,
                };
              }
            }
            return { ...card, assignee };
          })
        );

        return { ...column, cards: cardsWithAssignee };
      })
    );

    // Get members with user info
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
                name: memberUser.name,
                email: memberUser.email,
                image: memberUser.image,
              }
            : null,
        };
      })
    );

    return {
      ...board,
      columns: columnsWithCards,
      members,
      userRole: role,
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

    // Create board
    const boardId = await ctx.db.insert("boards", {
      name: args.name,
      description: args.description,
      slugPrefix,
      cardCounter: 0,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    // Create default columns
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

    // Add owner as board member
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
 * Update board (owner only)
 */
export const update = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId, "owner");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.boardId, updates);

    return args.boardId;
  },
});

/**
 * Delete board (owner only)
 */
export const remove = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId, "owner");

    // Delete all columns (cards cascade via application logic)
    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    for (const column of columns) {
      // Delete cards in column
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_column", (q) => q.eq("columnId", column._id))
        .collect();

      for (const card of cards) {
        // Delete attachments
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

    // Delete board members
    const members = await ctx.db
      .query("boardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete board
    await ctx.db.delete(args.boardId);

    return { success: true };
  },
});
