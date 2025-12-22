import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
      createdAt: now,
      updatedAt: now,
    });

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
