import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, getBoardIdFromCard, checkBoardAccess } from "./lib/rbac";
import { marked } from "marked";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const EMAIL_MENTION_RE = /@([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/**
 * Convert MCP-supplied markdown into the HTML the frontend renders, resolving
 * `@email` tokens into TipTap mention spans (and returning the mentioned user
 * ids so notifications fire). Mention spans are injected as raw inline HTML
 * BEFORE markdown conversion — `marked` passes inline HTML through untouched,
 * which also stops its GFM autolinker from turning the email into a mailto link.
 */
async function renderMcpComment(
  ctx: MutationCtx,
  cardId: Id<"cards">,
  rawMarkdown: string,
): Promise<{ html: string; mentionedUserIds: Id<"users">[] }> {
  const card = await ctx.db.get(cardId);
  let md = rawMarkdown;
  const mentionedUserIds: Id<"users">[] = [];

  if (card) {
    const column = await ctx.db.get(card.columnId);
    if (column) {
      // Resolve candidate emails against board members only.
      const emails = new Set(
        Array.from(rawMarkdown.matchAll(EMAIL_MENTION_RE), (m) => m[1].toLowerCase()),
      );
      if (emails.size > 0) {
        const members = await ctx.db
          .query("boardMembers")
          .withIndex("by_board", (q) => q.eq("boardId", column.boardId))
          .collect();
        for (const member of members) {
          const user = await ctx.db.get(member.userId);
          const email = user?.email?.toLowerCase();
          if (!user || !email || !emails.has(email)) continue;
          const label = user.name ?? user.email ?? "user";
          const span = `<span data-type="mention" data-id="${user._id}" data-label="${escapeHtmlAttr(label)}">@${escapeHtmlAttr(label)}</span>`;
          md = md.replace(new RegExp(`@${escapeRegExp(user.email!)}`, "g"), span);
          if (!mentionedUserIds.includes(user._id)) mentionedUserIds.push(user._id);
        }
      }
    }
  }

  let html: string;
  try {
    html = marked.parse(md, { async: false }) as string;
  } catch {
    html = md;
  }
  return { html, mentionedUserIds };
}

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
                name: author.name ?? "",
                email: author.email ?? "",
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
    mentionedUserIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const author = await requireAuth(ctx);

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
 * Update a comment
 */
export const update = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    if (comment.authorId !== user._id) {
      const boardId = await getBoardIdFromCard(ctx, comment.cardId);
      const { hasAccess } = boardId
        ? await checkBoardAccess(ctx, user._id, boardId, "admin")
        : { hasAccess: false };
      if (!hasAccess) throw new Error("Access denied");
    }

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
    const user = await requireAuth(ctx);

    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    if (comment.authorId !== user._id) {
      const boardId = await getBoardIdFromCard(ctx, comment.cardId);
      const { hasAccess } = boardId
        ? await checkBoardAccess(ctx, user._id, boardId, "admin")
        : { hasAccess: false };
      if (!hasAccess) throw new Error("Access denied");
    }

    await ctx.db.delete(args.commentId);

    return { success: true };
  },
});

/**
 * Internal: create comment by author email (used by MCP)
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
      .withIndex("email", (q) => q.eq("email", args.authorEmail))
      .first();

    if (!author) throw new Error("Author not found");

    const now = Date.now();

    // MCP supplies markdown; convert to the HTML the UI renders and resolve
    // `@email` tokens into mention spans + notifiable user ids.
    const { html, mentionedUserIds: resolvedMentions } = await renderMcpComment(
      ctx,
      args.cardId,
      args.content,
    );
    const mentionedUserIdsArg = Array.from(
      new Set([...(args.mentionedUserIds ?? []), ...resolvedMentions]),
    );

    const commentId = await ctx.db.insert("comments", {
      cardId: args.cardId,
      authorId: author._id,
      content: html,
      mentionedUserIds: mentionedUserIdsArg.length > 0 ? mentionedUserIdsArg : undefined,
      createdAt: now,
      updatedAt: now,
    });

    const card = await ctx.db.get(args.cardId);
    if (!card) return commentId;

    const column = await ctx.db.get(card.columnId);
    if (column) {
      await ctx.scheduler.runAfter(0, internal.webhookActions.dispatch, {
        boardId: column.boardId,
        event: "comment.created",
        data: { commentId, cardId: args.cardId, cardTitle: card.title, authorName: author.name },
      });
    }

    const mentionedUserIds = mentionedUserIdsArg;
    for (const userId of mentionedUserIds) {
      await ctx.scheduler.runAfter(0, internal.notifications.create, {
        userId,
        type: "mentioned",
        cardId: args.cardId,
        fromUserId: author._id,
        message: `${author.name} mentioned you in "${card.title}"`,
      });
    }

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
 * Internal: List comments for a card by cardId (used by MCP after Bearer auth)
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
                name: author.name ?? "",
                email: author.email ?? "",
                image: author.image,
              }
            : null,
        };
      })
    );

    return commentsWithAuthors;
  },
});
