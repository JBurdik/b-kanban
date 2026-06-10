"use node";

import { v } from "convex/values";
import { internalAction, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { createHmac } from "crypto";
import { requireAuth } from "./lib/rbac";

/**
 * Public entry point: authenticate the caller, verify board membership, then
 * schedule the internal test action.  The frontend calls this via
 * useAction(api.webhookActions.test).
 */
export const test = mutation({
  args: { webhookId: v.id("webhooks") },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    // verifyWebhookAccess throws if the webhook is missing or the user is not
    // a board member, so it doubles as the existence check.
    await ctx.runQuery(internal.webhooks.verifyWebhookAccess, {
      webhookId: args.webhookId,
      userId,
    });

    await ctx.scheduler.runAfter(0, internal.webhookActions.testAction, {
      webhookId: args.webhookId,
    });
  },
});

/**
 * Internal action: send a test payload to the webhook URL.
 */
export const testAction = internalAction({
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
