import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth, requireBoardAccess } from "./lib/rbac";
import { internal } from "./_generated/api";

/**
 * Create a new webhook
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.string(),
    url: v.string(),
    type: v.union(v.literal("generic"), v.literal("slack"), v.literal("discord")),
    events: v.array(v.string()),
    secret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;
    await requireBoardAccess(ctx, userId, args.boardId, "admin");

    if (!args.url.startsWith("https://")) {
      throw new Error("Webhook URL must start with https://");
    }

    const now = Date.now();

    const id = await ctx.db.insert("webhooks", {
      boardId: args.boardId,
      name: args.name,
      url: args.url,
      type: args.type,
      events: args.events,
      secret: args.secret,
      isActive: true,
      createdById: userId,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * List webhooks for a board (strips secret field)
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const webhooks = await ctx.db
      .query("webhooks")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    return webhooks.map(({ secret, ...rest }) => rest);
  },
});

/**
 * Update a webhook
 */
export const update = mutation({
  args: {
    webhookId: v.id("webhooks"),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    type: v.optional(v.union(v.literal("generic"), v.literal("slack"), v.literal("discord"))),
    events: v.optional(v.array(v.string())),
    secret: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");

    await requireBoardAccess(ctx, userId, webhook.boardId, "admin");

    if (args.url !== undefined && !args.url.startsWith("https://")) {
      throw new Error("Webhook URL must start with https://");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.url !== undefined) updates.url = args.url;
    if (args.type !== undefined) updates.type = args.type;
    if (args.events !== undefined) updates.events = args.events;
    if (args.secret !== undefined) updates.secret = args.secret;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.webhookId, updates);

    return args.webhookId;
  },
});

/**
 * Remove a webhook
 */
export const remove = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");

    await requireBoardAccess(ctx, userId, webhook.boardId, "admin");

    await ctx.db.delete(args.webhookId);

    return { success: true };
  },
});

/**
 * Get a webhook by ID (internal, includes secret)
 */
export const getInternal = internalQuery({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.webhookId);
  },
});

/**
 * List webhooks for a board (internal, includes secret)
 */
export const listByBoard = internalQuery({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhooks")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();
  },
});

/**
 * Get board name (internal helper)
 */
export const getBoardName = internalQuery({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const board = await ctx.db.get(args.boardId);
    return board ? { id: board._id, name: board.name } : null;
  },
});

/**
 * Internal query: verify the caller is authenticated and is a member of the
 * webhook's board. Returns the webhook on success, throws otherwise.
 */
export const verifyWebhookAccess = internalQuery({
  args: {
    webhookId: v.id("webhooks"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");

    const member = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", webhook.boardId).eq("userId", args.userId)
      )
      .first();

    if (!member) throw new Error("Access denied");

    return webhook;
  },
});

/**
 * Internal mutation to update webhook status after dispatch
 */
export const updateWebhookStatus = internalMutation({
  args: {
    webhookId: v.id("webhooks"),
    lastTriggeredAt: v.number(),
    lastStatus: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.webhookId, {
      lastTriggeredAt: args.lastTriggeredAt,
      lastStatus: args.lastStatus,
    });
  },
});

export const test = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    await ctx.runQuery(internal.webhooks.verifyWebhookAccess, {
      webhookId: args.webhookId,
      userId,
    });

    await ctx.scheduler.runAfter(0, internal.webhookActions.testAction, {
      webhookId: args.webhookId,
    });
  },
});
