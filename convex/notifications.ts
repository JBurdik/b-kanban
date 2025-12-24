import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

/**
 * List notifications for a user
 */
export const list = query({
  args: {
    userEmail: v.string(),
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return [];

    // Query notifications
    let notificationsQuery = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc");

    const notifications = await notificationsQuery.collect();

    // Filter by read status if needed
    const filtered = args.unreadOnly
      ? notifications.filter((n) => !n.read)
      : notifications;

    // Apply limit
    const limited = args.limit ? filtered.slice(0, args.limit) : filtered;

    // Enrich with card and user info
    const enriched = await Promise.all(
      limited.map(async (notification) => {
        const card = await ctx.db.get(notification.cardId);
        const fromUser = await ctx.db.get(notification.fromUserId);

        return {
          ...notification,
          card: card
            ? {
                id: card._id,
                slug: card.slug,
                title: card.title,
              }
            : null,
          fromUser: fromUser
            ? {
                id: fromUser._id,
                name: fromUser.name,
                image: fromUser.image,
              }
            : null,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Get unread notification count
 */
export const unreadCount = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("read", false),
      )
      .collect();

    return unread.length;
  },
});

/**
 * Mark a notification as read
 */
export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");

    await ctx.db.patch(args.notificationId, { read: true });

    return { success: true };
  },
});

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) throw new Error("User not found");

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", user._id).eq("read", false),
      )
      .collect();

    for (const notification of unread) {
      await ctx.db.patch(notification._id, { read: true });
    }

    return { success: true, count: unread.length };
  },
});

/**
 * Internal mutation to create a notification
 * Called by other mutations when events occur
 */
export const create = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("assigned"),
      v.literal("mentioned"),
      v.literal("commented"),
      v.literal("card_updated"),
    ),
    cardId: v.id("cards"),
    fromUserId: v.id("users"),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Don't notify user about their own actions
    if (args.userId === args.fromUserId) return null;

    // Get the card to find the board
    const card = await ctx.db.get(args.cardId);
    if (!card) return null;

    const column = await ctx.db.get(card.columnId);
    if (!column) return null;

    const boardId = column.boardId;

    // Check for duplicate recent notification (within last minute)
    const recentNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    const duplicate = recentNotifications.find(
      (n) =>
        n.type === args.type &&
        n.cardId === args.cardId &&
        n.fromUserId === args.fromUserId &&
        Date.now() - n.createdAt < 60000, // Within last minute
    );

    if (duplicate) return null;

    const notificationId = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      cardId: args.cardId,
      boardId,
      fromUserId: args.fromUserId,
      read: false,
      message: args.message,
      createdAt: Date.now(),
    });

    return notificationId;
  },
});

/**
 * Delete a notification
 */
export const remove = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");

    await ctx.db.delete(args.notificationId);

    return { success: true };
  },
});
