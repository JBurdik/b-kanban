import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireAuth, requireBoardAccess, getBoardIdFromCard } from "./lib/rbac";

/**
 * List comments for a card (authenticated — verifies board access)
 */
export const list = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    await requireBoardAccess(ctx, userId, boardId, "member");

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
 * List comments for a card — internal variant for MCP (no auth check, MCP already verified)
 */
export const listByCardId = internalQuery({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    comments.sort((a, b) => a.createdAt - b.createdAt);

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
 * Create a new comment (authenticated — author derived from session)
 */
export const create = mutation({
  args: {
    cardId: v.id("cards"),
    content: v.string(),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    await requireBoardAccess(ctx, userId, boardId, "member");

    const author = await ctx.db.get(userId);
    if (!author) throw new Error("Author not found");

    const now = Date.now();

    const commentId = await ctx.db.insert("comments", {
      cardId: args.cardId,
      authorId: userId,
      content: args.content,
      mentionedUserIds: args.mentionedUserIds,
      createdAt: now,
      updatedAt: now,
    });

    // Get card for notification message and webhook
    const card = await ctx.db.get(args.cardId);
    if (!card) return commentId;

    // Dispatch webhook
    const column = await ctx.db.get(card.columnId);
    if (column) {
      await ctx.scheduler.runAfter(0, internal.webhookActions.dispatch, {
        boardId: column.boardId,
        event: "comment.created",
        data: { commentId, cardId: args.cardId, cardTitle: card.title, authorName: author.name },
      });
    }

    // Notify mentioned users
    const mentionedUserIds = args.mentionedUserIds || [];
    for (const mentionedUserId of mentionedUserIds) {
      await ctx.scheduler.runAfter(0, internal.notifications.create, {
        userId: mentionedUserId,
        type: "mentioned",
        cardId: args.cardId,
        fromUserId: userId,
        message: `${author.name} mentioned you in "${card.title}"`,
      });
    }

    // Notify card assignee (if not author and not already mentioned)
    if (
      card.assigneeId &&
      card.assigneeId !== userId &&
      !mentionedUserIds.includes(card.assigneeId)
    ) {
      await ctx.scheduler.runAfter(0, internal.notifications.create, {
        userId: card.assigneeId,
        type: "commented",
        cardId: args.cardId,
        fromUserId: userId,
        message: `${author.name} commented on "${card.title}"`,
      });
    }

    return commentId;
  },
});

/**
 * Create a comment by email — internal variant for MCP
 */
export const createByEmail = internalMutation({
  args: {
    cardId: v.id("cards"),
    content: v.string(),
    authorEmail: v.string(),
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const author = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.authorEmail))
      .first();

    if (!author) throw new Error("Author not found");

    const now = Date.now();

    const commentId = await ctx.db.insert("comments", {
      cardId: args.cardId,
      authorId: author._id,
      content: args.content,
      mentionedUserIds: args.mentionedUserIds,
      createdAt: now,
      updatedAt: now,
    });

    // Get card for notification message and webhook
    const card = await ctx.db.get(args.cardId);
    if (!card) return commentId;

    // Dispatch webhook
    const column = await ctx.db.get(card.columnId);
    if (column) {
      await ctx.scheduler.runAfter(0, internal.webhookActions.dispatch, {
        boardId: column.boardId,
        event: "comment.created",
        data: { commentId, cardId: args.cardId, cardTitle: card.title, authorName: author.name },
      });
    }

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
 * Update a comment (authenticated — only the comment author may edit)
 */
export const update = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    if (comment.authorId !== userId) {
      throw new Error("Access denied: you can only edit your own comments");
    }

    await ctx.db.patch(args.commentId, {
      content: args.content,
      updatedAt: Date.now(),
    });

    return args.commentId;
  },
});

/**
 * Delete a comment (authenticated — author can delete their own; admins/owners can delete any)
 */
export const remove = mutation({
  args: { commentId: v.id("comments") },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    // Allow deletion if user is the author
    if (comment.authorId === userId) {
      await ctx.db.delete(args.commentId);
      return { success: true };
    }

    // Otherwise require admin or owner role on the card's board
    const boardId = await getBoardIdFromCard(ctx, comment.cardId);
    if (!boardId) throw new Error("Card not found");

    const { role } = await requireBoardAccess(ctx, userId, boardId, "admin");
    void role; // access verified

    await ctx.db.delete(args.commentId);
    return { success: true };
  },
});
