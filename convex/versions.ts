import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { requireBoardAccess, checkBoardAccess, requireAuth, getOptionalAuth } from "./lib/rbac";

/**
 * List all versions for a board
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) return [];

    const { hasAccess } = await checkBoardAccess(ctx, user._id, args.boardId, "member");
    if (!hasAccess) return [];

    return await ctx.db
      .query("versions")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
  },
});

/**
 * Internal: list a board's versions by user email (used by the MCP server
 * after Bearer auth). Returns name/color/isActive for each version.
 */
export const listByEmail = internalQuery({
  args: { boardId: v.id("boards"), userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) return [];

    const { hasAccess } = await checkBoardAccess(ctx, user._id, args.boardId, "member");
    if (!hasAccess) return [];

    return await ctx.db
      .query("versions")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
  },
});

/**
 * Create a new version (admin/owner only)
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requireBoardAccess(ctx, user._id, args.boardId, "admin");

    return await ctx.db.insert("versions", {
      boardId: args.boardId,
      name: args.name,
      color: args.color,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update a version (admin/owner only)
 */
export const update = mutation({
  args: {
    versionId: v.id("versions"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    await requireBoardAccess(ctx, user._id, version.boardId, "admin");

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.versionId, updates);
    return args.versionId;
  },
});

/**
 * Remove a version and clear it from all cards (admin/owner only)
 */
export const remove = mutation({
  args: { versionId: v.id("versions") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    await requireBoardAccess(ctx, user._id, version.boardId, "admin");

    // Clear versionId from all cards that reference this version
    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board", (q) => q.eq("boardId", version.boardId))
      .collect();

    for (const column of columns) {
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_column", (q) => q.eq("columnId", column._id))
        .collect();

      for (const card of cards) {
        if (card.versionId === args.versionId) {
          await ctx.db.patch(card._id, { versionId: undefined });
        }
      }
    }

    await ctx.db.delete(args.versionId);
    return { success: true };
  },
});
