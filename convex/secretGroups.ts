import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth, requireBoardAccess } from "./lib/rbac";

/**
 * List all secret groups for a board
 */
export const list = query({
  args: {
    boardId: v.id("boards"),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    await requireBoardAccess(ctx, userId, args.boardId, "member");

    const groups = await ctx.db
      .query("secretGroups")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    return groups;
  },
});

/**
 * Create a new secret group (admin/owner only)
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    await requireBoardAccess(ctx, userId, args.boardId, "admin");

    // Check for duplicate name within the board
    const existing = await ctx.db
      .query("secretGroups")
      .withIndex("by_board_name", (q) =>
        q.eq("boardId", args.boardId).eq("name", args.name)
      )
      .first();

    if (existing) {
      throw new Error(`Group "${args.name}" already exists in this board`);
    }

    return ctx.db.insert("secretGroups", {
      boardId: args.boardId,
      name: args.name,
      color: args.color,
      createdAt: Date.now(),
    });
  },
});

/**
 * Update a secret group (admin/owner only)
 */
export const update = mutation({
  args: {
    groupId: v.id("secretGroups"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    await requireBoardAccess(ctx, userId, group.boardId, "admin");

    // If name is changing, check for duplicates
    if (args.name && args.name !== group.name) {
      const existing = await ctx.db
        .query("secretGroups")
        .withIndex("by_board_name", (q) =>
          q.eq("boardId", group.boardId).eq("name", args.name!)
        )
        .first();

      if (existing) {
        throw new Error(`Group "${args.name}" already exists in this board`);
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.groupId, updates);
    }
    return args.groupId;
  },
});

/**
 * Delete a secret group (admin/owner only)
 * Secrets in this group will have their groupId set to null
 */
export const remove = mutation({
  args: {
    groupId: v.id("secretGroups"),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    await requireBoardAccess(ctx, userId, group.boardId, "admin");

    // Remove groupId from all secrets in this group
    const secretsInGroup = await ctx.db
      .query("secrets")
      .withIndex("by_group", (q) => q.eq("groupId", args.groupId))
      .collect();

    for (const secret of secretsInGroup) {
      await ctx.db.patch(secret._id, { groupId: undefined });
    }

    await ctx.db.delete(args.groupId);
    return { success: true };
  },
});
