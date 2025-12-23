import { v } from "convex/values";
import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

/**
 * Get user by email
 */
async function getUserByEmail(ctx: Ctx, email: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

/**
 * Get board ID from card ID
 */
async function getBoardIdFromCard(
  ctx: Ctx,
  cardId: Id<"cards">
): Promise<Id<"boards"> | null> {
  const card = await ctx.db.get(cardId);
  if (!card) return null;
  const column = await ctx.db.get(card.columnId);
  return column?.boardId || null;
}

/**
 * Check if user has access to board
 */
async function checkBoardAccess(
  ctx: Ctx,
  userId: Id<"users">,
  boardId: Id<"boards">
): Promise<boolean> {
  const member = await ctx.db
    .query("boardMembers")
    .withIndex("by_board_and_user", (q) =>
      q.eq("boardId", boardId).eq("userId", userId)
    )
    .first();
  return !!member;
}

/**
 * Get attachments for a card
 */
export const list = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    // Generate URLs for each attachment
    const withUrls = await Promise.all(
      attachments.map(async (att) => ({
        ...att,
        url: await ctx.storage.getUrl(att.storageId),
      }))
    );

    return withUrls;
  },
});

/**
 * Generate upload URL for file upload
 */
export const generateUploadUrl = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save attachment after upload
 */
export const saveAttachment = mutation({
  args: {
    cardId: v.id("cards"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("Unauthorized");

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    const hasAccess = await checkBoardAccess(ctx, user._id, boardId);
    if (!hasAccess) throw new Error("Access denied");

    const attachmentId = await ctx.db.insert("attachments", {
      cardId: args.cardId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      uploadedById: user._id,
      createdAt: Date.now(),
    });

    const attachment = await ctx.db.get(attachmentId);
    const url = await ctx.storage.getUrl(args.storageId);

    return { ...attachment, url };
  },
});

/**
 * Delete an attachment
 */
export const remove = mutation({
  args: { attachmentId: v.id("attachments"), userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("Unauthorized");

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    const boardId = await getBoardIdFromCard(ctx, attachment.cardId);
    if (!boardId) throw new Error("Card not found");

    const hasAccess = await checkBoardAccess(ctx, user._id, boardId);
    if (!hasAccess) throw new Error("Access denied");

    // Delete from storage
    await ctx.storage.delete(attachment.storageId);

    // Delete from database
    await ctx.db.delete(args.attachmentId);

    return { success: true };
  },
});
