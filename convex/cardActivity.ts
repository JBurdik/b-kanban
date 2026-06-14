import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/rbac";

/**
 * List a card's activity / history, newest first, enriched with user info.
 */
export const list = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, { cardId }) => {
    await requireAuth(ctx);

    const events = await ctx.db
      .query("cardActivity")
      .withIndex("by_card", (q) => q.eq("cardId", cardId))
      .collect();

    events.sort((a, b) => b.createdAt - a.createdAt);

    return Promise.all(
      events.map(async (e) => {
        const user = await ctx.db.get(e.userId);
        return {
          _id: e._id,
          action: e.action,
          field: e.field,
          oldValue: e.oldValue,
          newValue: e.newValue,
          createdAt: e.createdAt,
          user: user
            ? { name: user.name ?? null, email: user.email ?? null, image: user.image ?? null }
            : null,
        };
      }),
    );
  },
});
