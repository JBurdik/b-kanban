import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/rbac";

type BoardRole = "owner" | "admin" | "member";
const roleHierarchy: BoardRole[] = ["member", "admin", "owner"];

/**
 * List all secrets for a board (returns encrypted values)
 * All board members can view the list
 */
export const list = query({
  args: {
    boardId: v.id("boards"),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    // Check board access
    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", userId)
      )
      .first();

    if (!member) {
      return [];
    }

    const secrets = await ctx.db
      .query("secrets")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    // Return secrets with creator and group info
    return Promise.all(
      secrets.map(async (secret) => {
        const creator = await ctx.db.get(secret.createdById);
        const group = secret.groupId ? await ctx.db.get(secret.groupId) : null;
        return {
          _id: secret._id,
          name: secret.name,
          encryptedValue: secret.encryptedValue,
          iv: secret.iv,
          salt: secret.salt,
          visibility: secret.visibility,
          description: secret.description,
          groupId: secret.groupId,
          group: group ? { _id: group._id, name: group.name, color: group.color } : null,
          createdAt: secret.createdAt,
          updatedAt: secret.updatedAt,
          createdBy: creator
            ? { name: creator.name, email: creator.email }
            : null,
        };
      })
    );
  },
});

/**
 * Get a single secret by ID
 */
export const get = query({
  args: {
    secretId: v.id("secrets"),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const secret = await ctx.db.get(args.secretId);
    if (!secret) {
      throw new Error("Secret not found");
    }

    // Check board access
    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", secret.boardId).eq("userId", userId)
      )
      .first();

    if (!member) {
      throw new Error("Access denied");
    }

    const creator = await ctx.db.get(secret.createdById);
    return {
      ...secret,
      createdBy: creator
        ? { name: creator.name, email: creator.email }
        : null,
    };
  },
});

/**
 * Create a new secret (admin/owner only)
 * Values are already encrypted client-side
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.string(),
    encryptedValue: v.string(),
    iv: v.string(),
    salt: v.string(),
    visibility: v.union(v.literal("public"), v.literal("hidden")),
    description: v.optional(v.string()),
    groupId: v.optional(v.id("secretGroups")),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    // Check board access (admin or owner)
    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", userId)
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
      .query("secrets")
      .withIndex("by_board_name", (q) =>
        q.eq("boardId", args.boardId).eq("name", args.name)
      )
      .first();

    if (existing) {
      throw new Error(`Secret "${args.name}" already exists in this board`);
    }

    const now = Date.now();
    return ctx.db.insert("secrets", {
      boardId: args.boardId,
      name: args.name,
      encryptedValue: args.encryptedValue,
      iv: args.iv,
      salt: args.salt,
      visibility: args.visibility,
      description: args.description,
      groupId: args.groupId,
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a secret (admin/owner only)
 */
export const update = mutation({
  args: {
    secretId: v.id("secrets"),
    name: v.optional(v.string()),
    encryptedValue: v.optional(v.string()),
    iv: v.optional(v.string()),
    salt: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("public"), v.literal("hidden"))),
    description: v.optional(v.string()),
    groupId: v.optional(v.union(v.id("secretGroups"), v.null())),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const secret = await ctx.db.get(args.secretId);
    if (!secret) {
      throw new Error("Secret not found");
    }

    // Check board access (admin or owner)
    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", secret.boardId).eq("userId", userId)
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
    if (args.name && args.name !== secret.name) {
      const existing = await ctx.db
        .query("secrets")
        .withIndex("by_board_name", (q) =>
          q.eq("boardId", secret.boardId).eq("name", args.name!)
        )
        .first();

      if (existing) {
        throw new Error(`Secret "${args.name}" already exists in this board`);
      }
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.encryptedValue !== undefined)
      updates.encryptedValue = args.encryptedValue;
    if (args.iv !== undefined) updates.iv = args.iv;
    if (args.salt !== undefined) updates.salt = args.salt;
    if (args.visibility !== undefined) updates.visibility = args.visibility;
    if (args.description !== undefined) updates.description = args.description;
    if (args.groupId !== undefined) updates.groupId = args.groupId === null ? undefined : args.groupId;

    await ctx.db.patch(args.secretId, updates);
    return args.secretId;
  },
});

/**
 * Delete a secret (admin/owner only)
 */
export const remove = mutation({
  args: {
    secretId: v.id("secrets"),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const secret = await ctx.db.get(args.secretId);
    if (!secret) {
      throw new Error("Secret not found");
    }

    // Check board access (admin or owner)
    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", secret.boardId).eq("userId", userId)
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

    await ctx.db.delete(args.secretId);
    return { success: true };
  },
});
