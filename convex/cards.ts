import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireAuth, requireBoardAccess, getBoardIdFromCard, getBoardIdFromColumn, getOptionalAuth } from "./lib/rbac";

/** Strip HTML tags + collapse whitespace to plain text */
function htmlToText(html?: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max = 60): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Word-level diff of two descriptions → short human summary */
function describeContentDiff(oldHtml?: string, newHtml?: string): string {
  const oldWords = htmlToText(oldHtml).split(" ").filter(Boolean);
  const newWords = htmlToText(newHtml).split(" ").filter(Boolean);

  const oldSet = new Set(oldWords);
  const newSet = new Set(newWords);
  const added = newWords.filter((w) => !oldSet.has(w));
  const removed = oldWords.filter((w) => !newSet.has(w));

  const parts: string[] = [];
  if (added.length) parts.push(`+${truncate(added.join(" "))}`);
  if (removed.length) parts.push(`−${truncate(removed.join(" "))}`);

  if (!parts.length) return "description edited";
  return `description: ${parts.join(" / ")}`;
}

/**
 * Get a single card by ID
 */
export const get = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");

    // Get assignee info
    let assignee = null;
    if (card.assigneeId) {
      const assigneeUser = await ctx.db.get(card.assigneeId);
      if (assigneeUser) {
        assignee = {
          id: assigneeUser._id,
          name: assigneeUser.name,
          email: assigneeUser.email,
          image: assigneeUser.image,
        };
      }
    }

    // Get attachments
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (att) => ({
        ...att,
        url: await ctx.storage.getUrl(att.storageId),
      }))
    );

    // Get reporter info
    let reporter = null;
    if (card.reporterId) {
      const reporterUser = await ctx.db.get(card.reporterId);
      if (reporterUser) {
        reporter = {
          id: reporterUser._id,
          name: reporterUser.name,
          email: reporterUser.email,
          image: reporterUser.image,
        };
      }
    }

    return { ...card, assignee, reporter, attachments: attachmentsWithUrls };
  },
});

/**
 * Get a card by its slug and board ID
 */
export const getBySlug = query({
  args: {
    slug: v.string(),
    boardId: v.id("boards"),
  },
  handler: async (ctx, args) => {
    // Find card by slug
    const card = await ctx.db
      .query("cards")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!card) return null;

    // Verify the card belongs to a column in this board
    const column = await ctx.db.get(card.columnId);
    if (!column || column.boardId !== args.boardId) return null;

    // Get assignee info
    let assignee = null;
    if (card.assigneeId) {
      const assigneeUser = await ctx.db.get(card.assigneeId);
      if (assigneeUser) {
        assignee = {
          id: assigneeUser._id,
          name: assigneeUser.name,
          email: assigneeUser.email,
          image: assigneeUser.image,
        };
      }
    }

    // Get attachments
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_card", (q) => q.eq("cardId", card._id))
      .collect();

    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (att) => ({
        ...att,
        url: await ctx.storage.getUrl(att.storageId),
      }))
    );

    // Get column info for status
    const columnInfo = {
      id: column._id,
      name: column.name,
    };

    // Get reporter info
    let reporter = null;
    if (card.reporterId) {
      const reporterUser = await ctx.db.get(card.reporterId);
      if (reporterUser) {
        reporter = {
          id: reporterUser._id,
          name: reporterUser.name,
          email: reporterUser.email,
          image: reporterUser.image,
        };
      }
    }

    return {
      ...card,
      assignee,
      reporter,
      attachments: attachmentsWithUrls,
      column: columnInfo,
    };
  },
});

/**
 * Create a new card
 */
export const create = mutation({
  args: {
    columnId: v.id("columns"),
    title: v.string(),
    content: v.optional(v.string()),
    position: v.optional(v.number()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    type: v.optional(v.union(v.literal("task"), v.literal("bug"))),
    assigneeId: v.optional(v.id("users")),
    versionId: v.optional(v.id("versions")),
    dueDate: v.optional(v.number()),
    effort: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.sessionToken);

    const column = await ctx.db.get(args.columnId);
    if (!column) throw new Error("Column not found");

    const boardId = column.boardId;

    // Get board and increment counter
    const board = await ctx.db.get(boardId);
    if (!board) throw new Error("Board not found");

    const newCounter = (board.cardCounter || 0) + 1;
    const slug = `${board.slugPrefix}-${newCounter}`;

    // Update board counter
    await ctx.db.patch(boardId, { cardCounter: newCounter });

    // Get max position if not provided
    let position = args.position;
    if (position === undefined) {
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_column", (q) => q.eq("columnId", args.columnId))
        .collect();
      position = cards.length;
    }

    // Set reporter from authenticated user
    const reporterId: Id<"users"> = user._id;

    const now = Date.now();

    const cardId = await ctx.db.insert("cards", {
      columnId: args.columnId,
      slug,
      title: args.title,
      content: args.content,
      position,
      priority: args.priority ?? "medium",
      type: args.type ?? "task",
      assigneeId: args.assigneeId,
      versionId: args.versionId,
      dueDate: args.dueDate,
      effort: args.effort,
      reporterId,
      createdAt: now,
      updatedAt: now,
    });

    // Dispatch webhook
    await ctx.scheduler.runAfter(0, internal.webhookActions.dispatch, {
      boardId,
      event: "card.created",
      data: { cardId, slug, title: args.title, columnId: args.columnId },
    });

    return cardId;
  },
});

/**
 * Update a card
 */
export const update = mutation({
  args: {
    cardId: v.id("cards"),
    columnId: v.optional(v.id("columns")),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    position: v.optional(v.number()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.null())),
    type: v.optional(v.union(v.literal("task"), v.literal("bug"), v.null())),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    reporterId: v.optional(v.union(v.id("users"), v.null())),
    versionId: v.optional(v.union(v.id("versions"), v.null())),
    dueDate: v.optional(v.number()),
    effort: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx, args.sessionToken);

    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");

    const oldAssigneeId = card.assigneeId;

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.columnId !== undefined) updates.columnId = args.columnId;
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.position !== undefined) updates.position = args.position;
    // Handle priority: null means clear, undefined means don't change
    if (args.priority === null) {
      updates.priority = undefined;
    } else if (args.priority !== undefined) {
      updates.priority = args.priority;
    }
    // Handle type: null means clear, undefined means don't change
    if (args.type === null) {
      updates.type = undefined;
    } else if (args.type !== undefined) {
      updates.type = args.type;
    }
    // Handle assignee: null means unassign, undefined means don't change
    if (args.assigneeId === null) {
      updates.assigneeId = undefined;
    } else if (args.assigneeId !== undefined) {
      updates.assigneeId = args.assigneeId;
    }
    // Handle reporter: null means clear, undefined means don't change
    if (args.reporterId === null) {
      updates.reporterId = undefined;
    } else if (args.reporterId !== undefined) {
      updates.reporterId = args.reporterId;
    }
    // Handle version: null means clear, undefined means don't change
    if (args.versionId === null) {
      updates.versionId = undefined;
    } else if (args.versionId !== undefined) {
      updates.versionId = args.versionId;
    }
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
    if (args.effort !== undefined) updates.effort = args.effort;

    await ctx.db.patch(args.cardId, updates);

    // Dispatch webhook
    const column = await ctx.db.get(card.columnId);
    if (column) {
      await ctx.scheduler.runAfter(0, internal.webhookActions.dispatch, {
        boardId: column.boardId,
        event: "card.updated",
        data: { cardId: args.cardId, title: card.title, updates: Object.keys(updates) },
      });
    }

    // Trigger notifications
    {
      // Notification for new assignment
      if (args.assigneeId && args.assigneeId !== oldAssigneeId) {
        await ctx.scheduler.runAfter(0, internal.notifications.create, {
          userId: args.assigneeId,
          type: "assigned",
          cardId: args.cardId,
          fromUserId: currentUser._id,
          message: `You were assigned to "${card.title}"`,
        });
      }

      // Notification for card update to assignee (if different from updater)
      if (card.assigneeId && card.assigneeId !== currentUser._id) {
          // Build a human-readable list of what actually changed
          const changes: string[] = [];

          if (args.title !== undefined && args.title !== card.title) {
            changes.push(`renamed to "${args.title}"`);
          }
          if (args.columnId !== undefined && args.columnId !== card.columnId) {
            const newColumn = await ctx.db.get(args.columnId);
            changes.push(`moved to ${newColumn ? newColumn.name : "another column"}`);
          }
          if (args.priority !== undefined) {
            const oldP = card.priority ?? "none";
            const newP = args.priority ?? "none";
            if (oldP !== newP) changes.push(`priority ${oldP} → ${newP}`);
          }
          if (args.type !== undefined) {
            const oldT = card.type ?? "none";
            const newT = args.type ?? "none";
            if (oldT !== newT) changes.push(`type ${oldT} → ${newT}`);
          }
          if (args.dueDate !== undefined && args.dueDate !== card.dueDate) {
            changes.push(
              args.dueDate
                ? `due date set to ${new Date(args.dueDate).toLocaleDateString()}`
                : "due date cleared",
            );
          }
          if (args.effort !== undefined && args.effort !== card.effort) {
            changes.push(`effort ${card.effort ?? "none"} → ${args.effort ?? "none"}`);
          }
          if (args.content !== undefined && args.content !== card.content) {
            const diff = describeContentDiff(card.content, args.content);
            changes.push(diff);
          }

          if (changes.length > 0) {
            const summary = changes.join(", ");
            const message = `"${card.title}": ${summary.charAt(0).toUpperCase()}${summary.slice(1)}`;
            await ctx.scheduler.runAfter(0, internal.notifications.create, {
              userId: card.assigneeId,
              type: "card_updated",
              cardId: args.cardId,
              fromUserId: currentUser._id,
              message,
            });
          }
        }
      }

    return args.cardId;
  },
});

/**
 * Archive a card (soft delete)
 */
export const remove = mutation({
  args: { cardId: v.id("cards"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.sessionToken);
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, user._id, boardId, "member");

    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");

    await ctx.db.patch(args.cardId, {
      isArchived: true,
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Dispatch webhook
    const column = await ctx.db.get(card.columnId);
    if (column) {
      await ctx.scheduler.runAfter(0, internal.webhookActions.dispatch, {
        boardId: column.boardId,
        event: "card.archived",
        data: { cardId: args.cardId, title: card.title },
      });
    }

    return { success: true };
  },
});

/**
 * Restore an archived card
 */
export const restore = mutation({
  args: { cardId: v.id("cards"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.sessionToken);
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, user._id, boardId, "member");

    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");
    if (!card.isArchived) throw new Error("Card is not archived");

    // Get max position in the original column to place card at the end
    const cardsInColumn = await ctx.db
      .query("cards")
      .withIndex("by_column", (q) => q.eq("columnId", card.columnId))
      .filter((q) => q.neq(q.field("isArchived"), true))
      .collect();

    const maxPosition = cardsInColumn.length > 0
      ? Math.max(...cardsInColumn.map(c => c.position)) + 1
      : 0;

    await ctx.db.patch(args.cardId, {
      isArchived: false,
      archivedAt: undefined,
      position: maxPosition,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Permanently delete an archived card
 */
export const permanentDelete = mutation({
  args: { cardId: v.id("cards"), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.sessionToken);
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, user._id, boardId, "member");

    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");
    if (!card.isArchived) throw new Error("Only archived cards can be permanently deleted");

    // Delete attachments
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    for (const att of attachments) {
      await ctx.storage.delete(att.storageId);
      await ctx.db.delete(att._id);
    }

    // Delete card watchers
    const cardWatchers = await ctx.db
      .query("cardWatchers")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    for (const watcher of cardWatchers) {
      await ctx.db.delete(watcher._id);
    }

    // Delete comments and their reactions
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    for (const comment of comments) {
      // Delete comment reactions
      const reactions = await ctx.db
        .query("commentReactions")
        .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
        .collect();

      for (const reaction of reactions) {
        await ctx.db.delete(reaction._id);
      }

      await ctx.db.delete(comment._id);
    }

    // Delete notifications related to this card
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    for (const notification of notifications) {
      await ctx.db.delete(notification._id);
    }

    // Delete document links
    const docLinks = await ctx.db
      .query("documentLinks")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    for (const link of docLinks) {
      await ctx.db.delete(link._id);
    }

    // Delete time entries linked to this card
    const timeEntries = await ctx.db
      .query("timeEntries")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    for (const entry of timeEntries) {
      await ctx.db.delete(entry._id);
    }

    await ctx.db.delete(args.cardId);

    return { success: true };
  },
});

/**
 * List all archived cards for a board
 */
export const listArchived = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    // Get all columns for this board
    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const columnIds = columns.map(c => c._id);
    const columnMap = new Map(columns.map(c => [c._id, c.name]));

    // Get all archived cards from these columns
    const archivedCards = [];
    for (const columnId of columnIds) {
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_column", (q) => q.eq("columnId", columnId))
        .filter((q) => q.eq(q.field("isArchived"), true))
        .collect();

      for (const card of cards) {
        // Get assignee info
        let assignee = null;
        if (card.assigneeId) {
          const assigneeUser = await ctx.db.get(card.assigneeId);
          if (assigneeUser) {
            assignee = {
              id: assigneeUser._id,
              name: assigneeUser.name,
              email: assigneeUser.email,
              image: assigneeUser.image,
            };
          }
        }

        // Get reporter info
        let reporter = null;
        if (card.reporterId) {
          const reporterUser = await ctx.db.get(card.reporterId);
          if (reporterUser) {
            reporter = {
              id: reporterUser._id,
              name: reporterUser.name,
              email: reporterUser.email,
              image: reporterUser.image,
            };
          }
        }

        archivedCards.push({
          ...card,
          assignee,
          reporter,
          columnName: columnMap.get(card.columnId) || "Unknown",
        });
      }
    }

    // Sort by archivedAt descending (most recently archived first)
    archivedCards.sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));

    return archivedCards;
  },
});

/**
 * Move card to different column
 */
export const move = mutation({
  args: {
    cardId: v.id("cards"),
    columnId: v.id("columns"),
    position: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx, args.sessionToken);
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, user._id, boardId, "member");

    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");

    await ctx.db.patch(args.cardId, {
      columnId: args.columnId,
      position: args.position,
      updatedAt: Date.now(),
    });

    return args.cardId;
  },
});

/**
 * Reorder cards (bulk update positions)
 */
export const reorder = mutation({
  args: {
    items: v.array(
      v.object({
        id: v.id("cards"),
        columnId: v.id("columns"),
        position: v.number(),
      })
    ),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.items.length === 0) return { success: true };

    const user = await requireAuth(ctx, args.sessionToken);
    const boardId = await getBoardIdFromColumn(ctx, args.items[0].columnId);
    if (!boardId) throw new Error("Column not found");
    await requireBoardAccess(ctx, user._id, boardId, "member");

    for (const item of args.items) {
      await ctx.db.patch(item.id, {
        columnId: item.columnId,
        position: item.position,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Get user's tasks across all boards
 */
export const getMyTasks = query({
  args: {
    limit: v.optional(v.number()),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx, args.sessionToken);
    if (!user) return { tasks: [], stats: { total: 0, myTasks: 0, unassigned: 0, highPriority: 0 } };

    // Get user's board memberships
    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const boardIds = memberships.map((m) => m.boardId);

    // Get all columns from user's boards
    const allColumns = [];
    for (const boardId of boardIds) {
      const columns = await ctx.db
        .query("columns")
        .withIndex("by_board", (q) => q.eq("boardId", boardId))
        .collect();
      allColumns.push(...columns);
    }

    // Get all cards from those columns
    const allCards = [];
    for (const column of allColumns) {
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_column", (q) => q.eq("columnId", column._id))
        .collect();
      allCards.push(...cards.map((c) => ({ ...c, column })));
    }

    // Calculate stats
    const myTasks = allCards.filter((c) => c.assigneeId === user._id);
    const unassigned = allCards.filter((c) => !c.assigneeId);
    const highPriority = allCards.filter((c) => c.priority === "high");

    // Get recent tasks assigned to user (sorted by updated)
    const recentTasks = myTasks
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, args.limit || 5);

    // Enhance with board info
    const tasksWithInfo = await Promise.all(
      recentTasks.map(async (card) => {
        const board = await ctx.db.get(card.column.boardId);
        return {
          _id: card._id,
          slug: card.slug,
          title: card.title,
          priority: card.priority,
          dueDate: card.dueDate,
          updatedAt: card.updatedAt,
          columnName: card.column.name,
          boardId: card.column.boardId,
          boardName: board?.name || "Unknown",
        };
      })
    );

    return {
      tasks: tasksWithInfo,
      stats: {
        total: allCards.length,
        myTasks: myTasks.length,
        unassigned: unassigned.length,
        highPriority: highPriority.length,
      },
    };
  },
});

/**
 * Bulk update priority for multiple cards
 */
export const bulkUpdatePriority = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.cardIds.length === 0) return { success: true };

    const authUser = await requireAuth(ctx, args.sessionToken);
    const userId = authUser._id as unknown as Id<"users">;
    const boardId = await getBoardIdFromCard(ctx, args.cardIds[0]);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, userId, boardId, "member");

    const now = Date.now();
    for (const cardId of args.cardIds) {
      await ctx.db.patch(cardId, { priority: args.priority, updatedAt: now });
    }

    return { success: true };
  },
});

/**
 * Bulk archive multiple cards
 */
export const bulkArchive = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.cardIds.length === 0) return { success: true };

    const authUser = await requireAuth(ctx, args.sessionToken);
    const userId = authUser._id as unknown as Id<"users">;
    const boardId = await getBoardIdFromCard(ctx, args.cardIds[0]);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, userId, boardId, "member");

    const now = Date.now();
    for (const cardId of args.cardIds) {
      await ctx.db.patch(cardId, {
        isArchived: true,
        archivedAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

/**
 * Bulk permanently delete multiple cards and all related data
 */
export const bulkDelete = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.cardIds.length === 0) return { success: true };

    const authUser = await requireAuth(ctx, args.sessionToken);
    const userId = authUser._id as unknown as Id<"users">;
    const boardId = await getBoardIdFromCard(ctx, args.cardIds[0]);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, userId, boardId, "member");

    for (const cardId of args.cardIds) {
      // Delete attachments with storage cleanup
      const attachments = await ctx.db
        .query("attachments")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .collect();
      for (const att of attachments) {
        await ctx.storage.delete(att.storageId);
        await ctx.db.delete(att._id);
      }

      // Delete card watchers
      const cardWatchers = await ctx.db
        .query("cardWatchers")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .collect();
      for (const watcher of cardWatchers) {
        await ctx.db.delete(watcher._id);
      }

      // Delete comments and their reactions
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .collect();
      for (const comment of comments) {
        const reactions = await ctx.db
          .query("commentReactions")
          .withIndex("by_comment", (q) => q.eq("commentId", comment._id))
          .collect();
        for (const reaction of reactions) {
          await ctx.db.delete(reaction._id);
        }
        await ctx.db.delete(comment._id);
      }

      // Delete notifications
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .collect();
      for (const notification of notifications) {
        await ctx.db.delete(notification._id);
      }

      // Delete document links
      const docLinks = await ctx.db
        .query("documentLinks")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .collect();
      for (const link of docLinks) {
        await ctx.db.delete(link._id);
      }

      // Delete time entries
      const timeEntries = await ctx.db
        .query("timeEntries")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .collect();
      for (const entry of timeEntries) {
        await ctx.db.delete(entry._id);
      }

      // Delete card labels
      const cardLabels = await ctx.db
        .query("cardLabels")
        .withIndex("by_card", (q) => q.eq("cardId", cardId))
        .collect();
      for (const cl of cardLabels) {
        await ctx.db.delete(cl._id);
      }

      // Delete the card itself
      await ctx.db.delete(cardId);
    }

    return { success: true };
  },
});

/**
 * Bulk set version for multiple cards
 */
export const bulkSetVersion = mutation({
  args: {
    cardIds: v.array(v.id("cards")),
    versionId: v.optional(v.id("versions")),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.cardIds.length === 0) return { success: true };

    const authUser = await requireAuth(ctx, args.sessionToken);
    const userId = authUser._id as unknown as Id<"users">;
    const boardId = await getBoardIdFromCard(ctx, args.cardIds[0]);
    if (!boardId) throw new Error("Card not found");
    await requireBoardAccess(ctx, userId, boardId, "member");

    const now = Date.now();
    for (const cardId of args.cardIds) {
      await ctx.db.patch(cardId, { versionId: args.versionId, updatedAt: now });
    }

    return { success: true };
  },
});

/**
 * Internal: Get a card by slug (and optional boardId) for MCP — no auth check needed,
 * MCP layer has already verified the Bearer token.
 */
export const getBySlugForMcp = internalQuery({
  args: {
    slug: v.string(),
    boardId: v.optional(v.id("boards")),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db
      .query("cards")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!card) return null;

    // If boardId provided, verify card belongs to a column in that board
    if (args.boardId) {
      const column = await ctx.db.get(card.columnId);
      if (!column || column.boardId !== args.boardId) return null;
    }

    let assignee = null;
    if (card.assigneeId) {
      const assigneeUser = await ctx.db.get(card.assigneeId);
      if (assigneeUser) {
        assignee = {
          id: assigneeUser._id,
          name: assigneeUser.name,
          email: assigneeUser.email,
          image: assigneeUser.image,
        };
      }
    }

    let reporter = null;
    if (card.reporterId) {
      const reporterUser = await ctx.db.get(card.reporterId);
      if (reporterUser) {
        reporter = {
          id: reporterUser._id,
          name: reporterUser.name,
          email: reporterUser.email,
          image: reporterUser.image,
        };
      }
    }

    const column = await ctx.db.get(card.columnId);
    const columnInfo = column ? { id: column._id, name: column.name } : null;

    return { ...card, assignee, reporter, column: columnInfo };
  },
});

/**
 * Internal: Get tasks assigned to a user identified by email (used by MCP after Bearer auth)
 */
export const getMyTasksByEmail = internalQuery({
  args: {
    userEmail: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) return { tasks: [], stats: { total: 0, myTasks: 0, unassigned: 0, highPriority: 0 } };

    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const boardIds = memberships.map((m) => m.boardId);

    const allColumns = [];
    for (const boardId of boardIds) {
      const columns = await ctx.db
        .query("columns")
        .withIndex("by_board", (q) => q.eq("boardId", boardId))
        .collect();
      allColumns.push(...columns);
    }

    const allCards = [];
    for (const column of allColumns) {
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_column", (q) => q.eq("columnId", column._id))
        .collect();
      allCards.push(...cards.map((c) => ({ ...c, column })));
    }

    const myTasks = allCards.filter((c) => c.assigneeId === user._id);
    const unassigned = allCards.filter((c) => !c.assigneeId);
    const highPriority = allCards.filter((c) => c.priority === "high");

    const recentTasks = myTasks
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, args.limit || 5);

    const tasksWithInfo = await Promise.all(
      recentTasks.map(async (card) => {
        const board = await ctx.db.get(card.column.boardId);
        return {
          _id: card._id,
          slug: card.slug,
          title: card.title,
          priority: card.priority,
          dueDate: card.dueDate,
          updatedAt: card.updatedAt,
          columnName: card.column.name,
          boardId: card.column.boardId,
          boardName: board?.name || "Unknown",
        };
      })
    );

    return {
      tasks: tasksWithInfo,
      stats: {
        total: allCards.length,
        myTasks: myTasks.length,
        unassigned: unassigned.length,
        highPriority: highPriority.length,
      },
    };
  },
});

/**
 * Internal: Create a card attributed to a user by email (used by MCP after Bearer auth)
 */
export const createByEmail = internalMutation({
  args: {
    columnId: v.id("columns"),
    title: v.string(),
    content: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    type: v.optional(v.union(v.literal("task"), v.literal("bug"))),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
    effort: v.optional(v.number()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) throw new Error("User not found");

    const column = await ctx.db.get(args.columnId);
    if (!column) throw new Error("Column not found");

    const boardId = column.boardId;
    const board = await ctx.db.get(boardId);
    if (!board) throw new Error("Board not found");

    const newCounter = (board.cardCounter || 0) + 1;
    const slug = `${board.slugPrefix}-${newCounter}`;
    await ctx.db.patch(boardId, { cardCounter: newCounter });

    const cards = await ctx.db
      .query("cards")
      .withIndex("by_column", (q) => q.eq("columnId", args.columnId))
      .collect();
    const position = cards.length;

    const now = Date.now();
    const cardId = await ctx.db.insert("cards", {
      columnId: args.columnId,
      slug,
      title: args.title,
      content: args.content,
      position,
      priority: args.priority ?? "medium",
      type: args.type ?? "task",
      assigneeId: args.assigneeId,
      dueDate: args.dueDate,
      effort: args.effort,
      reporterId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.webhookActions.dispatch, {
      boardId,
      event: "card.created",
      data: { cardId, slug, title: args.title, columnId: args.columnId },
    });

    return cardId;
  },
});

/**
 * Internal: Update a card with attribution to a user by email (used by MCP after Bearer auth)
 */
export const updateByEmail = internalMutation({
  args: {
    cardId: v.id("cards"),
    columnId: v.optional(v.id("columns")),
    position: v.optional(v.number()),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.null())),
    type: v.optional(v.union(v.literal("task"), v.literal("bug"), v.null())),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    reporterId: v.optional(v.union(v.id("users"), v.null())),
    versionId: v.optional(v.union(v.id("versions"), v.null())),
    dueDate: v.optional(v.number()),
    effort: v.optional(v.number()),
    currentUserEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.currentUserEmail))
      .first();
    if (!currentUser) throw new Error("User not found");

    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");

    const oldAssigneeId = card.assigneeId;

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.columnId !== undefined) updates.columnId = args.columnId;
    if (args.position !== undefined) updates.position = args.position;
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.priority === null) {
      updates.priority = undefined;
    } else if (args.priority !== undefined) {
      updates.priority = args.priority;
    }
    if (args.type === null) {
      updates.type = undefined;
    } else if (args.type !== undefined) {
      updates.type = args.type;
    }
    if (args.assigneeId === null) {
      updates.assigneeId = undefined;
    } else if (args.assigneeId !== undefined) {
      updates.assigneeId = args.assigneeId;
    }
    if (args.reporterId === null) {
      updates.reporterId = undefined;
    } else if (args.reporterId !== undefined) {
      updates.reporterId = args.reporterId;
    }
    if (args.versionId === null) {
      updates.versionId = undefined;
    } else if (args.versionId !== undefined) {
      updates.versionId = args.versionId;
    }
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;
    if (args.effort !== undefined) updates.effort = args.effort;

    await ctx.db.patch(args.cardId, updates);

    const column = await ctx.db.get(card.columnId);
    if (column) {
      await ctx.scheduler.runAfter(0, internal.webhookActions.dispatch, {
        boardId: column.boardId,
        event: "card.updated",
        data: { cardId: args.cardId, title: card.title, updates: Object.keys(updates) },
      });
    }

    // Notify on new assignment
    if (args.assigneeId && args.assigneeId !== oldAssigneeId) {
      await ctx.scheduler.runAfter(0, internal.notifications.create, {
        userId: args.assigneeId,
        type: "assigned",
        cardId: args.cardId,
        fromUserId: currentUser._id,
        message: `You were assigned to "${card.title}"`,
      });
    }

    return args.cardId;
  },
});
