import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth } from "./lib/rbac";

/**
 * Get current user
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
    };
  },
});

/**
 * Get user by ID
 */
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
    };
  },
});

/**
 * Search users by email (for adding members)
 */
export const searchByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Search for users whose email contains the search term
    const allUsers = await ctx.db.query("users").collect();

    const matchingUsers = allUsers
      .filter((u) => u.email.toLowerCase().includes(args.email.toLowerCase()))
      .slice(0, 10)
      .map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        image: u.image,
      }));

    return matchingUsers;
  },
});

/**
 * Update current user profile
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.image !== undefined) updates.image = args.image;

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

/**
 * Delete current user account
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    // Get all board memberships
    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const membership of memberships) {
      // If user is owner, delete the board entirely
      if (membership.role === "owner") {
        const board = await ctx.db.get(membership.boardId);
        if (board) {
          // Delete all columns
          const columns = await ctx.db
            .query("columns")
            .withIndex("by_board", (q) => q.eq("boardId", membership.boardId))
            .collect();

          for (const column of columns) {
            // Delete cards in column
            const cards = await ctx.db
              .query("cards")
              .withIndex("by_column", (q) => q.eq("columnId", column._id))
              .collect();

            for (const card of cards) {
              // Delete attachments
              const attachments = await ctx.db
                .query("attachments")
                .withIndex("by_card", (q) => q.eq("cardId", card._id))
                .collect();

              for (const att of attachments) {
                await ctx.storage.delete(att.storageId);
                await ctx.db.delete(att._id);
              }

              await ctx.db.delete(card._id);
            }

            await ctx.db.delete(column._id);
          }

          // Delete all board members
          const boardMembers = await ctx.db
            .query("boardMembers")
            .withIndex("by_board", (q) => q.eq("boardId", membership.boardId))
            .collect();

          for (const member of boardMembers) {
            await ctx.db.delete(member._id);
          }

          // Delete the board
          await ctx.db.delete(membership.boardId);
        }
      } else {
        // Just remove membership
        await ctx.db.delete(membership._id);
      }
    }

    // Unassign user from any cards they're assigned to
    const assignedCards = await ctx.db
      .query("cards")
      .withIndex("by_assignee", (q) => q.eq("assigneeId", user._id))
      .collect();

    for (const card of assignedCards) {
      await ctx.db.patch(card._id, { assigneeId: undefined });
    }

    // Delete the user
    await ctx.db.delete(user._id);

    return { success: true };
  },
});
