import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireBoardAccess } from "./lib/rbac";

/**
 * Get board members
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId, "member");

    const members = await ctx.db
      .query("boardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    // Get user details for each member
    const membersWithUsers = await Promise.all(
      members.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return {
          id: m._id,
          role: m.role,
          userId: m.userId,
          boardId: m.boardId,
          createdAt: m.createdAt,
          user: memberUser
            ? {
                id: memberUser._id,
                name: memberUser.name,
                email: memberUser.email,
                image: memberUser.image,
              }
            : null,
        };
      })
    );

    return membersWithUsers;
  },
});

/**
 * Add member to board by email
 */
export const add = mutation({
  args: {
    boardId: v.id("boards"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const { role: currentUserRole } = await requireBoardAccess(ctx, user._id, args.boardId, "admin");

    // Only owner can add admins
    if (args.role === "admin" && currentUserRole !== "owner") {
      throw new Error("Only owner can add admins");
    }

    // Find user by email
    const userToAdd = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!userToAdd) {
      throw new Error("User not found with that email");
    }

    // Check if already a member
    const existingMember = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", userToAdd._id)
      )
      .first();

    if (existingMember) {
      throw new Error("User is already a member of this board");
    }

    const memberId = await ctx.db.insert("boardMembers", {
      boardId: args.boardId,
      userId: userToAdd._id,
      role: args.role,
      createdAt: Date.now(),
    });

    return memberId;
  },
});

/**
 * Update member role
 */
export const updateRole = mutation({
  args: {
    memberId: v.id("boardMembers"),
    role: v.union(v.literal("admin"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const memberToUpdate = await ctx.db.get(args.memberId);
    if (!memberToUpdate) throw new Error("Member not found");

    const { role: currentUserRole } = await requireBoardAccess(
      ctx,
      user._id,
      memberToUpdate.boardId,
      "admin"
    );

    // Cannot modify owner
    if (memberToUpdate.role === "owner") {
      throw new Error("Cannot modify owner role");
    }

    // Admin cannot modify other admins
    if (currentUserRole === "admin" && memberToUpdate.role === "admin") {
      throw new Error("Admins cannot modify other admins");
    }

    // Only owner can promote to admin
    if (args.role === "admin" && currentUserRole !== "owner") {
      throw new Error("Only owner can promote to admin");
    }

    await ctx.db.patch(args.memberId, { role: args.role });

    return { success: true };
  },
});

/**
 * Remove member from board
 */
export const remove = mutation({
  args: { memberId: v.id("boardMembers") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const memberToRemove = await ctx.db.get(args.memberId);
    if (!memberToRemove) throw new Error("Member not found");

    const { role: currentUserRole } = await requireBoardAccess(
      ctx,
      user._id,
      memberToRemove.boardId,
      "admin"
    );

    // Cannot remove owner
    if (memberToRemove.role === "owner") {
      throw new Error("Cannot remove board owner");
    }

    // Admin cannot remove other admins
    if (currentUserRole === "admin" && memberToRemove.role === "admin") {
      throw new Error("Admins cannot remove other admins");
    }

    // Check if member is removing themselves
    if (memberToRemove.userId === user._id) {
      // Allow members to leave the board
      await ctx.db.delete(args.memberId);
      return { success: true };
    }

    await ctx.db.delete(args.memberId);

    return { success: true };
  },
});

/**
 * Leave board (self-remove)
 */
export const leave = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const membership = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id)
      )
      .first();

    if (!membership) {
      throw new Error("Not a member of this board");
    }

    // Owner cannot leave (must delete board or transfer ownership)
    if (membership.role === "owner") {
      throw new Error("Owner cannot leave board. Delete the board or transfer ownership first.");
    }

    await ctx.db.delete(membership._id);

    return { success: true };
  },
});
