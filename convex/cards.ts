import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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

    return { ...card, assignee, attachments: attachmentsWithUrls };
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
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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

    const now = Date.now();

    const cardId = await ctx.db.insert("cards", {
      columnId: args.columnId,
      slug,
      title: args.title,
      content: args.content,
      position,
      priority: args.priority ?? "medium",
      assigneeId: args.assigneeId,
      dueDate: args.dueDate,
      createdAt: now,
      updatedAt: now,
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
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    assigneeId: v.optional(v.id("users")),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.columnId !== undefined) updates.columnId = args.columnId;
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.position !== undefined) updates.position = args.position;
    if (args.priority !== undefined) updates.priority = args.priority;
    if (args.assigneeId !== undefined) updates.assigneeId = args.assigneeId;
    if (args.dueDate !== undefined) updates.dueDate = args.dueDate;

    await ctx.db.patch(args.cardId, updates);

    return args.cardId;
  },
});

/**
 * Delete a card
 */
export const remove = mutation({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");

    // Delete attachments
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    for (const att of attachments) {
      await ctx.storage.delete(att.storageId);
      await ctx.db.delete(att._id);
    }

    await ctx.db.delete(args.cardId);

    return { success: true };
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
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
    if (args.items.length === 0) return { success: true };

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
