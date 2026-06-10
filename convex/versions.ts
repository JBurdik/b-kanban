import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuth, requireBoardAccess, checkBoardAccess } from "./lib/rbac";

/**
 * List all versions for a board
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const { hasAccess } = await checkBoardAccess(ctx, userId, args.boardId, "member");
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
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    await requireBoardAccess(ctx, userId, args.boardId, "admin");

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
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    await requireBoardAccess(ctx, userId, version.boardId, "admin");

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
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const version = await ctx.db.get(args.versionId);
    if (!version) throw new Error("Version not found");

    await requireBoardAccess(ctx, userId, version.boardId, "admin");

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
