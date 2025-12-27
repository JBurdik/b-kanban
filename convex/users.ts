import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Get user by email (returns userId for frontend to use)
 */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
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
 * Get current user by ID
 */
export const me = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return null;
    }

    const user = await ctx.db.get(args.userId);
    if (!user) return null;

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
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.image !== undefined) updates.image = args.image;

    await ctx.db.patch(args.userId, updates);

    return { success: true };
  },
});

/**
 * Generate upload URL for avatar image
 */
export const generateAvatarUploadUrl = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) throw new Error("User not found");

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save avatar after upload
 */
export const saveAvatar = mutation({
  args: {
    userEmail: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) throw new Error("User not found");

    // Delete old avatar if exists
    if (user.image) {
      try {
        // Try to parse as storage ID and delete
        const oldStorageId = user.image as unknown;
        if (typeof oldStorageId === "string" && oldStorageId.startsWith("kg")) {
          await ctx.storage.delete(oldStorageId as typeof args.storageId);
        }
      } catch {
        // Ignore errors - old image might be external URL
      }
    }

    // Get the URL for the uploaded file
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Failed to get avatar URL");

    await ctx.db.patch(user._id, {
      image: url,
      updatedAt: Date.now(),
    });

    return { success: true, url };
  },
});

/**
 * Remove custom avatar (revert to generated)
 */
export const removeAvatar = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) throw new Error("User not found");

    // Delete from storage if exists
    if (user.image) {
      try {
        const storageId = user.image as unknown;
        if (typeof storageId === "string" && storageId.startsWith("kg")) {
          await ctx.storage.delete(
            storageId as Parameters<typeof ctx.storage.delete>[0],
          );
        }
      } catch {
        // Ignore errors
      }
    }

    await ctx.db.patch(user._id, {
      image: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Delete user account
 */
export const deleteAccount = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get all board memberships
    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
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
      .withIndex("by_assignee", (q) => q.eq("assigneeId", args.userId))
      .collect();

    for (const card of assignedCards) {
      await ctx.db.patch(card._id, { assigneeId: undefined });
    }

    // Delete the user
    await ctx.db.delete(args.userId);

    return { success: true };
  },
});
