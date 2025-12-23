import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * List comments for a card
 */
export const list = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    // Sort by creation time (oldest first)
    comments.sort((a, b) => a.createdAt - b.createdAt);

    // Get author info for each comment
    const commentsWithAuthors = await Promise.all(
      comments.map(async (comment) => {
        const author = await ctx.db.get(comment.authorId);
        return {
          ...comment,
          author: author
            ? {
                id: author._id,
                name: author.name,
                email: author.email,
                image: author.image,
              }
            : null,
        };
      })
    );

    return commentsWithAuthors;
  },
});

/**
 * Create a new comment
 */
export const create = mutation({
  args: {
    cardId: v.id("cards"),
    content: v.string(),
    authorEmail: v.string(),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    // Look up author by email
    const author = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.authorEmail))
      .first();

    if (!author) {
      throw new Error("Author not found");
    }

    const now = Date.now();

    const commentId = await ctx.db.insert("comments", {
      cardId: args.cardId,
      authorId: author._id,
      content: args.content,
      mentionedUserIds: args.mentionedUserIds,
      createdAt: now,
      updatedAt: now,
    });

    // Get card for notification message
    const card = await ctx.db.get(args.cardId);
    if (!card) return commentId;

    // Notify mentioned users
    const mentionedUserIds = args.mentionedUserIds || [];
    for (const userId of mentionedUserIds) {
      await ctx.scheduler.runAfter(0, internal.notifications.create, {
        userId,
        type: "mentioned",
        cardId: args.cardId,
        fromUserId: author._id,
        message: `${author.name} mentioned you in "${card.title}"`,
      });
    }

    // Notify card assignee (if not author and not already mentioned)
    if (
      card.assigneeId &&
      card.assigneeId !== author._id &&
      !mentionedUserIds.includes(card.assigneeId)
    ) {
      await ctx.scheduler.runAfter(0, internal.notifications.create, {
        userId: card.assigneeId,
        type: "commented",
        cardId: args.cardId,
        fromUserId: author._id,
        message: `${author.name} commented on "${card.title}"`,
      });
    }

    return commentId;
  },
});

/**
 * Update a comment
 */
export const update = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    await ctx.db.patch(args.commentId, {
      content: args.content,
      updatedAt: Date.now(),
    });

    return args.commentId;
  },
});

/**
 * Delete a comment
 */
export const remove = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    await ctx.db.delete(args.commentId);

    return { success: true };
  },
});
