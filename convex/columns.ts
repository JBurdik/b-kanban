import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth, requireBoardAccess, getBoardIdFromColumn } from "./lib/rbac";

/**
 * Create a new column
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.string(),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId, "admin");

    const now = Date.now();

    // Get max position if not provided
    let position = args.position;
    if (position === undefined) {
      const columns = await ctx.db
        .query("columns")
        .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
        .collect();
      position = columns.length;
    }

    const columnId = await ctx.db.insert("columns", {
      boardId: args.boardId,
      name: args.name,
      position,
      createdAt: now,
      updatedAt: now,
    });

    return columnId;
  },
});

/**
 * Update a column
 */
export const update = mutation({
  args: {
    columnId: v.id("columns"),
    name: v.optional(v.string()),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const boardId = await getBoardIdFromColumn(ctx, args.columnId);
    if (!boardId) throw new Error("Column not found");

    await requireBoardAccess(ctx, user._id, boardId, "admin");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.position !== undefined) updates.position = args.position;

    await ctx.db.patch(args.columnId, updates);

    return args.columnId;
  },
});

/**
 * Delete a column
 */
export const remove = mutation({
  args: { columnId: v.id("columns") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const boardId = await getBoardIdFromColumn(ctx, args.columnId);
    if (!boardId) throw new Error("Column not found");

    await requireBoardAccess(ctx, user._id, boardId, "admin");

    // Delete all cards in column
    const cards = await ctx.db
      .query("cards")
      .withIndex("by_column", (q) => q.eq("columnId", args.columnId))
      .collect();

    for (const card of cards) {
      // Delete attachments first
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

    await ctx.db.delete(args.columnId);

    return { success: true };
  },
});

/**
 * Reorder columns
 */
export const reorder = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.id("columns"),
        position: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    if (args.items.length === 0) return { success: true };

    // Verify access via first column
    const boardId = await getBoardIdFromColumn(ctx, args.items[0].id);
    if (boardId) {
      await requireBoardAccess(ctx, user._id, boardId, "admin");
    }

    for (const item of args.items) {
      await ctx.db.patch(item.id, { position: item.position, updatedAt: Date.now() });
    }

    return { success: true };
  },
});
