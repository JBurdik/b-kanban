import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getOptionalAuth } from "./lib/rbac";

/**
 * Send a heartbeat to indicate the user is still viewing the board.
 */
export const heartbeat = mutation({
  args: {
    boardId: v.id("boards"),
    activeCardId: v.optional(v.id("cards")),
  },
  handler: async (ctx, args) => {
    const authUser = await getOptionalAuth(ctx);
    if (!authUser) return;
    const userId = authUser._id as unknown as Id<"users">;
    const now = Date.now();

    const existing = await ctx.db
      .query("boardPresence")
      .withIndex("by_user_and_board", (q) =>
        q.eq("userId", userId).eq("boardId", args.boardId)
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
        userId,
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
    const authUser = await getOptionalAuth(ctx);
    if (!authUser) return;
    const userId = authUser._id as unknown as Id<"users">;

    const existing = await ctx.db
      .query("boardPresence")
      .withIndex("by_user_and_board", (q) =>
        q.eq("userId", userId).eq("boardId", args.boardId)
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
          activeCardId: p.activeCardId,
        };
      })
    );

    return results;
  },
});

/**
 * Update this user's cursor position on a board.
 * High-frequency mutation — no user joins, coords-only.
 */
export const updateCursor = mutation({
  args: {
    boardId: v.id("boards"),
    x: v.number(),
    y: v.number(),
    cardId: v.optional(v.id("cards")),
    columnId: v.optional(v.id("columns")),
    canvasId: v.optional(v.id("canvases")),
  },
  handler: async (ctx, args) => {
    const authUser = await getOptionalAuth(ctx);
    if (!authUser) return;
    const userId = authUser._id as unknown as Id<"users">;
    const now = Date.now();

    const existing = await ctx.db
      .query("boardCursors")
      .withIndex("by_user_and_board", (q) =>
        q.eq("userId", userId).eq("boardId", args.boardId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        x: args.x,
        y: args.y,
        lastSeen: now,
        cardId: args.cardId,
        columnId: args.columnId,
        canvasId: args.canvasId,
      });
    } else {
      await ctx.db.insert("boardCursors", {
        boardId: args.boardId,
        userId,
        x: args.x,
        y: args.y,
        lastSeen: now,
        cardId: args.cardId,
        columnId: args.columnId,
        canvasId: args.canvasId,
      });
    }
  },
});

/**
 * List live cursors on a board (seen within last 8 seconds).
 * Returns coords + userId only — no user joins (client maps from onlineUsers).
 */
export const listCursors = query({
  args: {
    boardId: v.id("boards"),
    cardId: v.optional(v.id("cards")),
    canvasId: v.optional(v.id("canvases")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = now - 8_000;

    const cursors = await ctx.db
      .query("boardCursors")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const matches = args.canvasId
      ? (c: (typeof cursors)[number]) => c.canvasId === args.canvasId
      : // Board/card view: exclude canvas cursors so their scene coords don't
        // get rendered as board coords.
        (c: (typeof cursors)[number]) => c.canvasId === undefined && c.cardId === args.cardId;

    return cursors
      .filter((c) => c.lastSeen >= cutoff && matches(c))
      .map((c) => ({ userId: c.userId, x: c.x, y: c.y, columnId: c.columnId }));
  },
});

/**
 * Clean up stale presence and cursor records older than 5 minutes.
 */
export const cleanupStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 5 * 60_000;

    const stalePresence = await ctx.db.query("boardPresence").collect();
    for (const record of stalePresence) {
      if (record.lastSeen < cutoff) {
        await ctx.db.delete(record._id);
      }
    }

    const staleCursors = await ctx.db.query("boardCursors").collect();
    for (const record of staleCursors) {
      if (record.lastSeen < cutoff) {
        await ctx.db.delete(record._id);
      }
    }
  },
});
