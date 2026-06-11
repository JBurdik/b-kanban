import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getOptionalAuth, requireAuth } from "./lib/rbac";

/**
 * List notifications for a user
 */
export const list = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    type: v.optional(
      v.union(
        v.literal("assigned"),
        v.literal("mentioned"),
        v.literal("commented"),
        v.literal("card_updated"),
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) return [];

    // Query notifications
    let notifications;
    if (args.type) {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user_type", (q) =>
          q.eq("userId", user._id).eq("type", args.type!)
        )
        .order("desc")
        .collect();
    } else {
      notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect();
    }

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
            ? { id: card._id, slug: card.slug, title: card.title }
            : null,
          fromUser: fromUser
            ? { id: fromUser._id, name: fromUser.name ?? "", image: fromUser.image }
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
  args: {},
  handler: async (ctx, _args) => {
    const user = await getOptionalAuth(ctx);
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
    const user = await requireAuth(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) throw new Error("Access denied");

    await ctx.db.patch(args.notificationId, { read: true });

    return { success: true };
  },
});

/**
 * Mark all notifications as read for a user
 */
export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx, _args) => {
    const user = await requireAuth(ctx);

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

    // Check for recent notification to dedup/coalesce (within last minute)
    const recentNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(10);

    // For card_updated, autosave fires multiple updateCard mutations as the
    // user edits, each producing a different diff message. Coalesce them into a
    // single notification (same card + sender) instead of stacking duplicates.
    if (args.type === "card_updated") {
      const recent = recentNotifications.find(
        (n) =>
          n.type === "card_updated" &&
          n.cardId === args.cardId &&
          n.fromUserId === args.fromUserId &&
          Date.now() - n.createdAt < 60000,
      );
      if (recent) {
        await ctx.db.patch(recent._id, {
          message: args.message,
          read: false,
          createdAt: Date.now(),
        });
        return recent._id;
      }
    }

    const duplicate = recentNotifications.find(
      (n) =>
        n.type === args.type &&
        n.cardId === args.cardId &&
        n.fromUserId === args.fromUserId &&
        n.message === args.message &&
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

    // Notify card watchers
    const watchers = await ctx.db
      .query("cardWatchers")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    for (const watcher of watchers) {
      // Skip the actor and the already-notified user
      if (watcher.userId === args.fromUserId) continue;
      if (watcher.userId === args.userId) continue;

      // Dedup check: look at recent notifications for this watcher
      const recentWatcherNotifs = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", watcher.userId))
        .order("desc")
        .take(10);

      // Coalesce rapid card_updated edits into a single watcher notification
      if (args.type === "card_updated") {
        const recent = recentWatcherNotifs.find(
          (n) =>
            n.type === "card_updated" &&
            n.cardId === args.cardId &&
            n.fromUserId === args.fromUserId &&
            Date.now() - n.createdAt < 60000,
        );
        if (recent) {
          await ctx.db.patch(recent._id, {
            message: args.message,
            read: false,
            createdAt: Date.now(),
          });
          continue;
        }
      }

      const watcherDuplicate = recentWatcherNotifs.find(
        (n) =>
          n.type === args.type &&
          n.cardId === args.cardId &&
          n.fromUserId === args.fromUserId &&
          n.message === args.message &&
          Date.now() - n.createdAt < 60000,
      );

      if (watcherDuplicate) continue;

      await ctx.db.insert("notifications", {
        userId: watcher.userId,
        type: args.type,
        cardId: args.cardId,
        boardId,
        fromUserId: args.fromUserId,
        read: false,
        message: args.message,
        createdAt: Date.now(),
      });
    }

    return notificationId;
  },
});

/**
 * Delete a notification
 */
export const remove = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== user._id) throw new Error("Access denied");

    await ctx.db.delete(args.notificationId);

    return { success: true };
  },
});
