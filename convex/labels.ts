import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuth, requireBoardAccess, checkBoardAccess, getBoardIdFromCard } from "./lib/rbac";

/**
 * Helper to get app user ID from email (used by internal MCP variants)
 */
async function getUserByEmail(
  ctx: QueryCtx | MutationCtx,
  email: string
): Promise<{ _id: Id<"users"> } | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

/**
 * Get all labels for a board
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check board access
    const { hasAccess } = await checkBoardAccess(ctx, user._id, args.boardId, "member");
    if (!hasAccess) {
      return [];
    }

    const labels = await ctx.db
      .query("labels")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    return labels;
  },
});

/**
 * Get labels attached to a specific card
 */
export const getForCard = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) return [];

    const { hasAccess } = await checkBoardAccess(ctx, user._id, boardId, "member");
    if (!hasAccess) {
      return [];
    }

    const cardLabels = await ctx.db
      .query("cardLabels")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    const labels = await Promise.all(
      cardLabels.map(async (cl) => {
        const label = await ctx.db.get(cl.labelId);
        return label;
      })
    );

    return labels.filter((l): l is NonNullable<typeof l> => l !== null);
  },
});

/**
 * Create a new label (admin/owner only)
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.string(),
    color: v.string(),
    textColor: v.string(),
    applyToCardBg: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requireBoardAccess(ctx, user._id, args.boardId, "admin");

    const labelId = await ctx.db.insert("labels", {
      boardId: args.boardId,
      name: args.name,
      color: args.color,
      textColor: args.textColor,
      applyToCardBg: args.applyToCardBg,
      createdAt: Date.now(),
    });

    return labelId;
  },
});

/**
 * Update a label (admin/owner only)
 */
export const update = mutation({
  args: {
    labelId: v.id("labels"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    textColor: v.optional(v.string()),
    applyToCardBg: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const label = await ctx.db.get(args.labelId);
    if (!label) throw new Error("Label not found");

    await requireBoardAccess(ctx, user._id, label.boardId, "admin");

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;
    if (args.textColor !== undefined) updates.textColor = args.textColor;
    if (args.applyToCardBg !== undefined) updates.applyToCardBg = args.applyToCardBg;

    await ctx.db.patch(args.labelId, updates);

    return args.labelId;
  },
});

/**
 * Remove a label and all card-label associations (admin/owner only)
 */
export const remove = mutation({
  args: { labelId: v.id("labels") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const label = await ctx.db.get(args.labelId);
    if (!label) throw new Error("Label not found");

    await requireBoardAccess(ctx, user._id, label.boardId, "admin");

    // Delete all card-label associations
    const cardLabels = await ctx.db
      .query("cardLabels")
      .withIndex("by_label", (q) => q.eq("labelId", args.labelId))
      .collect();

    for (const cl of cardLabels) {
      await ctx.db.delete(cl._id);
    }

    // Delete the label itself
    await ctx.db.delete(args.labelId);

    return { success: true };
  },
});

/**
 * Add a label to a card (any member can do this)
 */
export const addToCard = mutation({
  args: {
    cardId: v.id("cards"),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    await requireBoardAccess(ctx, user._id, boardId, "member");

    // Verify label belongs to the same board
    const label = await ctx.db.get(args.labelId);
    if (!label || label.boardId !== boardId) {
      throw new Error("Label not found or doesn't belong to this board");
    }

    // Check if already attached
    const existing = await ctx.db
      .query("cardLabels")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .filter((q) => q.eq(q.field("labelId"), args.labelId))
      .first();

    if (existing) {
      return existing._id; // Already attached
    }

    const cardLabelId = await ctx.db.insert("cardLabels", {
      cardId: args.cardId,
      labelId: args.labelId,
      createdAt: Date.now(),
    });

    return cardLabelId;
  },
});

/**
 * Remove a label from a card (any member can do this)
 */
export const removeFromCard = mutation({
  args: {
    cardId: v.id("cards"),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    await requireBoardAccess(ctx, user._id, boardId, "member");

    const cardLabel = await ctx.db
      .query("cardLabels")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .filter((q) => q.eq(q.field("labelId"), args.labelId))
      .first();

    if (cardLabel) {
      await ctx.db.delete(cardLabel._id);
    }

    return { success: true };
  },
});

/**
 * Bulk add a label to multiple cards
 */
export const bulkAddToCards = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    if (args.cardIds.length === 0) return { success: true };

    const user = await requireAuth(ctx);

    const boardId = await getBoardIdFromCard(ctx, args.cardIds[0]);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, user._id, boardId, "member");

    for (const cardId of args.cardIds) {
      // Check if already attached
      const existing = await ctx.db
        .query("cardLabels")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .filter((q) => q.eq(q.field("labelId"), args.labelId))
        .first();

      if (!existing) {
        await ctx.db.insert("cardLabels", {
          cardId,
          labelId: args.labelId,
          createdAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

/**
 * Bulk remove a label from multiple cards
 */
export const bulkRemoveFromCards = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    if (args.cardIds.length === 0) return { success: true };

    const user = await requireAuth(ctx);

    const boardId = await getBoardIdFromCard(ctx, args.cardIds[0]);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, user._id, boardId, "member");

    for (const cardId of args.cardIds) {
      const cardLabel = await ctx.db
        .query("cardLabels")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .filter((q) => q.eq(q.field("labelId"), args.labelId))
        .first();

      if (cardLabel) {
        await ctx.db.delete(cardLabel._id);
      }
    }

    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// Internal variants for MCP (email-based auth)
// ---------------------------------------------------------------------------

/**
 * List labels for a board, authenticated by email (MCP use)
 */
export const listByEmail = internalQuery({
  args: { boardId: v.id("boards"), userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");

    const { hasAccess } = await checkBoardAccess(ctx, user._id, args.boardId, "member");
    if (!hasAccess) throw new Error("Access denied");

    const labels = await ctx.db
      .query("labels")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    return labels;
  },
});

/**
 * Add a label to a card, authenticated by email (MCP use)
 */
export const addToCardByEmail = internalMutation({
  args: {
    cardId: v.id("cards"),
    labelId: v.id("labels"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    await requireBoardAccess(ctx, user._id, boardId, "member");

    // Verify label belongs to the same board
    const label = await ctx.db.get(args.labelId);
    if (!label || label.boardId !== boardId) {
      throw new Error("Label not found or doesn't belong to this board");
    }

    // Check if already attached
    const existing = await ctx.db
      .query("cardLabels")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .filter((q) => q.eq(q.field("labelId"), args.labelId))
      .first();

    if (existing) {
      return existing._id; // Already attached
    }

    const cardLabelId = await ctx.db.insert("cardLabels", {
      cardId: args.cardId,
      labelId: args.labelId,
      createdAt: Date.now(),
    });

    return cardLabelId;
  },
});
