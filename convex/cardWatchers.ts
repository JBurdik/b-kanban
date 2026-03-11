import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuth, getBoardIdFromCard, requireBoardAccess } from "./lib/rbac";

/**
 * Toggle watching a card (watch if not watching, unwatch if watching)
 */
export const toggle = mutation({
  args: {
    cardId: v.id("cards"),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, userId, boardId, "member");

    // Check if already watching
    const existing = await ctx.db
      .query("cardWatchers")
      .withIndex("by_card_and_user", (q) =>
        q.eq("cardId", args.cardId).eq("userId", userId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { watching: false };
    }

    await ctx.db.insert("cardWatchers", {
      cardId: args.cardId,
      userId: userId,
      createdAt: Date.now(),
    });

    return { watching: true };
  },
});

/**
 * List all watchers for a card with user info
 */
export const list = query({
  args: {
    cardId: v.id("cards"),
  },
  handler: async (ctx, args) => {
    const watchers = await ctx.db
      .query("cardWatchers")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    const enriched = await Promise.all(
      watchers.map(async (watcher) => {
        const user = await ctx.db.get(watcher.userId);
        return {
          ...watcher,
          user: user
            ? { id: user._id, name: user.name, image: user.image }
            : null,
        };
      })
    );

    return enriched.filter((w) => w.user !== null);
  },
});

/**
 * Check if a specific user is watching a card
 */
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
