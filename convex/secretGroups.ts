import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

type BoardRole = "owner" | "admin" | "member";
const roleHierarchy: BoardRole[] = ["member", "admin", "owner"];

/**
 * List all secret groups for a board
 */
export const list = query({
  args: {
    boardId: v.id("boards"),
    userEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userEmail) {
      return [];
    }

    // Look up user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail!))
      .first();

    if (!user) {
      return [];
    }

    // Check board access
    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();

    if (!member) {
      return [];
    }

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
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Check board access (admin or owner)
    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();

    if (!member) {
      throw new Error("Access denied");
    }

    const userRoleIndex = roleHierarchy.indexOf(member.role);
    const minRoleIndex = roleHierarchy.indexOf("admin");
    if (userRoleIndex < minRoleIndex) {
      throw new Error("Access denied - admin role required");
    }

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
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Check board access (admin or owner)
    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", group.boardId).eq("userId", user._id)
      )
      .first();

    if (!member) {
      throw new Error("Access denied");
    }

    const userRoleIndex = roleHierarchy.indexOf(member.role);
    const minRoleIndex = roleHierarchy.indexOf("admin");
    if (userRoleIndex < minRoleIndex) {
      throw new Error("Access denied - admin role required");
    }

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
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    // Check board access (admin or owner)
    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", group.boardId).eq("userId", user._id)
      )
      .first();

    if (!member) {
      throw new Error("Access denied");
    }

    const userRoleIndex = roleHierarchy.indexOf(member.role);
    const minRoleIndex = roleHierarchy.indexOf("admin");
    if (userRoleIndex < minRoleIndex) {
      throw new Error("Access denied - admin role required");
    }

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
