import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOptionalAuth, requireAuth, requireBoardAccess, getBoardIdFromCard } from "./lib/rbac";

/** Resolve the card's board and assert write access, or throw. */
async function requireCardAccess(
  ctx: MutationCtx,
  cardId: Id<"cards">,
  userId: Id<"users">
): Promise<Id<"boards">> {
  const boardId = await getBoardIdFromCard(ctx, cardId);
  if (!boardId) throw new Error("Card not found");
  await requireBoardAccess(ctx, userId, boardId);
  return boardId;
}

/** Soft access check for queries, which return empty rather than throwing. */
async function canRead(
  ctx: QueryCtx,
  boardId: Id<"boards">,
  userId: Id<"users">
): Promise<boolean> {
  const member = await ctx.db
    .query("boardMembers")
    .withIndex("by_board_and_user", (q) => q.eq("boardId", boardId).eq("userId", userId))
    .first();
  return !!member;
}

/**
 * Canvases linked to a card.
 */
export const listByCard = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) return [];

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId || !(await canRead(ctx, boardId, user._id))) return [];

    const links = await ctx.db
      .query("canvasLinks")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    const canvases = await Promise.all(
      links.map(async (link) => {
        const canvas = await ctx.db.get(link.canvasId);
        if (!canvas) return null;
        return { _id: canvas._id, name: canvas.name, updatedAt: canvas.updatedAt };
      })
    );

    return canvases.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

/**
 * Cards a canvas is linked to — shown in the canvas editor header.
 */
export const listByCanvas = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) return [];

    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas || !(await canRead(ctx, canvas.boardId, user._id))) return [];

    const links = await ctx.db
      .query("canvasLinks")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    const cards = await Promise.all(
      links.map(async (link) => {
        const card = await ctx.db.get(link.cardId);
        if (!card) return null;
        return { _id: card._id, slug: card.slug, title: card.title };
      })
    );

    return cards.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

export const link = mutation({
  args: { cardId: v.id("cards"), canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const boardId = await requireCardAccess(ctx, args.cardId, user._id);

    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");
    // A cross-board link would leak a canvas to a board the viewer may not share.
    if (canvas.boardId !== boardId) {
      throw new Error("Canvas must belong to the same board as the card");
    }

    const existing = await ctx.db
      .query("canvasLinks")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    if (existing.some((l) => l.canvasId === args.canvasId)) {
      return { success: true, alreadyLinked: true };
    }

    await ctx.db.insert("canvasLinks", {
      cardId: args.cardId,
      canvasId: args.canvasId,
      createdById: user._id,
      createdAt: Date.now(),
    });

    return { success: true, alreadyLinked: false };
  },
});

export const unlink = mutation({
  args: { cardId: v.id("cards"), canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireCardAccess(ctx, args.cardId, user._id);

    const links = await ctx.db
      .query("canvasLinks")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    const target = links.find((l) => l.canvasId === args.canvasId);
    if (target) await ctx.db.delete(target._id);

    return { success: true };
  },
});
