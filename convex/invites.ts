import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, requireBoardAccess } from "./lib/rbac";

/**
 * Generate a random 32-character alphanumeric token
 */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create a new invite link for a board
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    role: v.union(v.literal("admin"), v.literal("member")),
    expiresAt: v.optional(v.number()),
    maxUses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId, "admin");

    const token = generateToken();

    const id = await ctx.db.insert("boardInvites", {
      boardId: args.boardId,
      token,
      role: args.role,
      createdById: user._id,
      expiresAt: args.expiresAt,
      maxUses: args.maxUses,
      useCount: 0,
      isActive: true,
      createdAt: Date.now(),
    });

    return { id, token };
  },
});

/**
 * List active invites for a board
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const invites = await ctx.db
      .query("boardInvites")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    return invites.filter((invite) => invite.isActive);
  },
});

/**
 * Revoke an invite link
 */
export const revoke = mutation({
  args: { inviteId: v.id("boardInvites") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) throw new Error("Invite not found");

    await requireBoardAccess(ctx, user._id, invite.boardId, "admin");

    await ctx.db.patch(args.inviteId, { isActive: false });
    return { success: true };
  },
});

/**
 * Get invite details by token (public-facing, for the accept page)
 */
export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("boardInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite || !invite.isActive) return null;

    // Check expiry
    if (invite.expiresAt && Date.now() > invite.expiresAt) return null;

    // Check max uses
    if (invite.maxUses && invite.useCount >= invite.maxUses) return null;

    const board = await ctx.db.get(invite.boardId);
    const creator = await ctx.db.get(invite.createdById);

    return {
      boardName: board?.name ?? "Unknown Board",
      role: invite.role,
      creatorName: creator?.name ?? "Unknown",
      boardId: invite.boardId,
    };
  },
});

/**
 * Accept an invite link and join the board
 */
export const accept = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const invite = await ctx.db
      .query("boardInvites")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invite || !invite.isActive) {
      throw new Error("Invalid or expired invite");
    }

    if (invite.expiresAt && Date.now() > invite.expiresAt) {
      throw new Error("Invite has expired");
    }

    if (invite.maxUses && invite.useCount >= invite.maxUses) {
      throw new Error("Invite has reached maximum uses");
    }

    // Check if already a member
    const existingMember = await ctx.db
      .query("boardMembers")
      .withIndex("by_board_and_user", (q) =>
        q.eq("boardId", invite.boardId).eq("userId", user._id)
      )
      .first();

    if (existingMember) {
      return { boardId: invite.boardId, alreadyMember: true };
    }

    // Add as member
    await ctx.db.insert("boardMembers", {
      boardId: invite.boardId,
      userId: user._id,
      role: invite.role,
      createdAt: Date.now(),
    });

    // Increment use count
    await ctx.db.patch(invite._id, { useCount: invite.useCount + 1 });

    // Dispatch webhook
    await ctx.scheduler.runAfter(0, internal.webhooks.dispatch, {
      boardId: invite.boardId,
      event: "member.joined",
      data: { userId: user._id, role: invite.role, viaInvite: true },
    });

    return { boardId: invite.boardId, alreadyMember: false };
  },
});
