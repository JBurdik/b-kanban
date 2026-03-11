import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requireAuth } from "./lib/rbac";

/**
 * Send a heartbeat to indicate the user is still viewing the board.
 */
export const heartbeat = mutation({
  args: {
    boardId: v.id("boards"),
    activeCardId: v.optional(v.id("cards")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("boardPresence")
      .withIndex("by_user_and_board", (q) =>
        q.eq("userId", user._id).eq("boardId", args.boardId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastSeen: now,
        activeCardId: args.activeCardId,
      });
    } else {
      await ctx.db.insert("boardPresence", {
        boardId: args.boardId,
        userId: user._id,
        activeCardId: args.activeCardId,
        lastSeen: now,
        createdAt: now,
      });
    }
  },
});

/**
 * Remove presence when user leaves a board.
 */
export const leave = mutation({
  args: {
    boardId: v.id("boards"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const existing = await ctx.db
      .query("boardPresence")
      .withIndex("by_user_and_board", (q) =>
        q.eq("userId", user._id).eq("boardId", args.boardId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * List active users on a board (seen within last 30 seconds).
 */
export const list = query({
  args: {
    boardId: v.id("boards"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = now - 30_000;

    const presences = await ctx.db
      .query("boardPresence")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const active = presences.filter((p) => p.lastSeen >= cutoff);

    const results = await Promise.all(
      active.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        let activeCardSlug: string | undefined;

        if (p.activeCardId) {
          const card = await ctx.db.get(p.activeCardId);
          if (card) {
            activeCardSlug = card.slug;
          }
        }

        return {
          userId: p.userId,
          userName: user?.name ?? "Unknown",
          userImage: user?.image,
          activeCardSlug,
        };
      })
    );

    return results;
  },
});

/**
 * Clean up stale presence records older than 5 minutes.
 */
export const cleanupStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 5 * 60_000;

    const stale = await ctx.db
      .query("boardPresence")
      .collect();

    for (const record of stale) {
      if (record.lastSeen < cutoff) {
        await ctx.db.delete(record._id);
      }
    }
  },
});
