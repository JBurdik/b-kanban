import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { checkBoardAccess, requireBoardAccess, getOptionalAuth, requireAuth } from "./lib/rbac";

/**
 * List saved filter views for the current user on a board
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) return [];

    const { hasAccess } = await checkBoardAccess(ctx, user._id, args.boardId, "member");
    if (!hasAccess) return [];

    return await ctx.db
      .query("savedFilters")
      .withIndex("by_user_and_board", (q) =>
        q.eq("userId", user._id).eq("boardId", args.boardId)
      )
      .collect();
  },
});

/**
 * Save the current filter combo as a named view
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.string(),
    filterConfig: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId, "member");

    return await ctx.db.insert("savedFilters", {
      userId: user._id,
      boardId: args.boardId,
      name: args.name,
      filterConfig: args.filterConfig,
      createdAt: Date.now(),
    });
  },
});

/**
 * Delete a saved filter view (owner of the view only)
 */
export const remove = mutation({
  args: { savedFilterId: v.id("savedFilters") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const saved = await ctx.db.get(args.savedFilterId);
    if (!saved) throw new Error("Saved filter not found");
    if (saved.userId !== user._id) throw new Error("Not authorized to delete this view");

    await ctx.db.delete(args.savedFilterId);
    return { success: true };
  },
});
