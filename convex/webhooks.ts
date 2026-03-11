"use node";

import { v } from "convex/values";
import { query, mutation, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, requireBoardAccess } from "./lib/rbac";
import { createHmac } from "crypto";

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
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId, "admin");

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
      createdById: user._id,
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
    const user = await requireAuth(ctx);
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");

    await requireBoardAccess(ctx, user._id, webhook.boardId, "admin");

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
    const user = await requireAuth(ctx);
    const webhook = await ctx.db.get(args.webhookId);
    if (!webhook) throw new Error("Webhook not found");

    await requireBoardAccess(ctx, user._id, webhook.boardId, "admin");

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
 * Test a webhook by sending a test payload
 */
export const test = action({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const webhook = await ctx.runQuery(internal.webhooks.getInternal, {
      webhookId: args.webhookId,
    });

    if (!webhook) throw new Error("Webhook not found");

    const board = await ctx.runQuery(internal.webhooks.getBoardName, {
      boardId: webhook.boardId,
    });

    const timestamp = Date.now();
    let body: string;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (webhook.type === "slack") {
      body = JSON.stringify({
        blocks: [
          { type: "header", text: { type: "plain_text", text: "webhook.test" } },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Test webhook from board *${board?.name ?? "Unknown"}*. Your webhook is working!`,
            },
          },
        ],
      });
    } else if (webhook.type === "discord") {
      body = JSON.stringify({
        embeds: [
          {
            title: "webhook.test",
            description: `Test webhook from board ${board?.name ?? "Unknown"}. Your webhook is working!`,
            color: 5814783,
            timestamp: new Date(timestamp).toISOString(),
          },
        ],
      });
    } else {
      body = JSON.stringify({
        event: "webhook.test",
        timestamp,
        board: board ? { id: board.id, name: board.name } : null,
        data: { message: "This is a test webhook event." },
      });

      if (webhook.secret) {
        const signature = createHmac("sha256", webhook.secret)
          .update(body)
          .digest("hex");
        headers["X-Webhook-Signature"] = signature;
      }
    }

    let status: number;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      status = response.status;
    } catch {
      status = 0;
    }

    await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
      webhookId: args.webhookId,
      lastTriggeredAt: timestamp,
      lastStatus: status,
    });

    return { status };
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

/**
 * Dispatch webhook events for a board
 */
export const dispatch = internalAction({
  args: {
    boardId: v.id("boards"),
    event: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const webhooks = await ctx.runQuery(internal.webhooks.listByBoard, {
      boardId: args.boardId,
    });

    const board = await ctx.runQuery(internal.webhooks.getBoardName, {
      boardId: args.boardId,
    });

    const matchingWebhooks = webhooks.filter(
      (w: { isActive: boolean; events: string[] }) => w.isActive && w.events.includes(args.event)
    );

    for (const webhook of matchingWebhooks) {
      const timestamp = Date.now();
      let body: string;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (webhook.type === "slack") {
        body = JSON.stringify({
          blocks: [
            { type: "header", text: { type: "plain_text", text: args.event } },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Event *${args.event}* on board *${board?.name ?? "Unknown"}*\n\`\`\`${JSON.stringify(args.data, null, 2)}\`\`\``,
              },
            },
          ],
        });
      } else if (webhook.type === "discord") {
        body = JSON.stringify({
          embeds: [
            {
              title: args.event,
              description: `Event on board ${board?.name ?? "Unknown"}\n\`\`\`json\n${JSON.stringify(args.data, null, 2)}\n\`\`\``,
              color: 5814783,
              timestamp: new Date(timestamp).toISOString(),
            },
          ],
        });
      } else {
        body = JSON.stringify({
          event: args.event,
          timestamp,
          board: board ? { id: board.id, name: board.name } : null,
          data: args.data,
        });

        if (webhook.secret) {
          const signature = createHmac("sha256", webhook.secret)
            .update(body)
            .digest("hex");
          headers["X-Webhook-Signature"] = signature;
        }
      }

      let status: number;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        status = response.status;
      } catch {
        status = 0;
      }

      await ctx.runMutation(internal.webhooks.updateWebhookStatus, {
        webhookId: webhook._id,
        lastTriggeredAt: timestamp,
        lastStatus: status,
      });
    }
  },
});
