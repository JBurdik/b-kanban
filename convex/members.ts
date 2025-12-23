import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Get board members
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
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
    userId: v.optional(v.id("users")), // Current user adding the member
  },
  handler: async (ctx, args) => {
    // Find user by email - create if doesn't exist
    let userToAdd = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!userToAdd) {
      // Auto-create user from email (they can claim the account later)
      const userId = await ctx.db.insert("users", {
        email: args.email,
        name: args.email.split("@")[0], // Default name from email
        emailVerified: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      userToAdd = await ctx.db.get(userId);
    }

    if (!userToAdd) {
      throw new Error("Failed to create user");
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
    const memberToUpdate = await ctx.db.get(args.memberId);
    if (!memberToUpdate) throw new Error("Member not found");

    // Cannot modify owner
    if (memberToUpdate.role === "owner") {
      throw new Error("Cannot modify owner role");
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
    const memberToRemove = await ctx.db.get(args.memberId);
    if (!memberToRemove) throw new Error("Member not found");

    // Cannot remove owner
    if (memberToRemove.role === "owner") {
      throw new Error("Cannot remove board owner");
    }

    await ctx.db.delete(args.memberId);

    return { success: true };
  },
});

/**
 * Search board members by name/email (for @mentions)
 */
export const search = query({
  args: {
    boardId: v.id("boards"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("boardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    // Get user details and filter by query
    const searchQuery = args.query.toLowerCase();
    const results = await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        if (!user) return null;

        // Match by name or email
        const matchesName = user.name.toLowerCase().includes(searchQuery);
        const matchesEmail = user.email.toLowerCase().includes(searchQuery);

        if (!matchesName && !matchesEmail) return null;

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      })
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  },
});

/**
 * Leave board (self-remove)
 */
export const leave = mutation({
  args: {
    boardId: v.id("boards"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", args.boardId).eq("userId", args.userId)
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
