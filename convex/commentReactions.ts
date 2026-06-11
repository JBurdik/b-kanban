import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/rbac";

/**
 * Toggle a reaction on a comment (add or remove)
 */
export const toggle = mutation({
  args: {
    commentId: v.id("comments"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    // Verify comment exists
    const comment = await ctx.db.get(args.commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Check if user already reacted with this emoji
    const existing = await ctx.db
      .query("commentReactions")
      .withIndex("by_comment_and_user", (q) =>
        q.eq("commentId", args.commentId).eq("userId", userId)
      )
      .collect();

    const matchingReaction = existing.find((r) => r.emoji === args.emoji);

    if (matchingReaction) {
      await ctx.db.delete(matchingReaction._id);
      return { action: "removed" as const };
    }

    await ctx.db.insert("commentReactions", {
      commentId: args.commentId,
      userId: userId,
      emoji: args.emoji,
      createdAt: Date.now(),
    });

    return { action: "added" as const };
  },
});

/**
 * List all reactions for a comment, enriched with user info
 */
export const listByComment = query({
  args: {
    commentId: v.id("comments"),
  },
  handler: async (ctx, args) => {
    const reactions = await ctx.db
      .query("commentReactions")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .collect();

    const enriched = await Promise.all(
      reactions.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return {
          ...r,
          userName: user?.name ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});
