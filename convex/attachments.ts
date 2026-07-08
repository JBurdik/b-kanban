import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { requireAuth, getBoardIdFromCard, checkBoardAccess } from "./lib/rbac";

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
      })),
    );

    return withUrls;
  },
});

/**
 * Generate upload URL for file upload
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx, _args) => {
    await requireAuth(ctx);
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
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    const { hasAccess } = await checkBoardAccess(ctx, user._id, boardId);
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
  args: { attachmentId: v.id("attachments") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    const boardId = await getBoardIdFromCard(ctx, attachment.cardId);
    if (!boardId) throw new Error("Card not found");
    const { hasAccess } = await checkBoardAccess(ctx, user._id, boardId, "member");
    if (!hasAccess) throw new Error("Access denied");

    // Delete from storage
    await ctx.storage.delete(attachment.storageId);

    // Delete from database
    await ctx.db.delete(args.attachmentId);

    return { success: true };
  },
});

/**
 * Get URL for an uploaded image (used for inline editor images)
 * This is simpler than saveAttachment - just returns the URL without storing metadata
 */
export const getImageUrl = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Image not found");

    return { url };
  },
});

/**
 * Internal: List attachments for a card, for a user identified by email (used by MCP after Bearer auth)
 */
export const listByEmail = internalQuery({
  args: { cardId: v.id("cards"), userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) throw new Error("User not found");

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");
    const access = await checkBoardAccess(ctx, user._id, boardId, "member");
    if (!access.hasAccess) throw new Error("Card not found");

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    return await Promise.all(
      attachments.map(async (att) => ({
        fileName: att.fileName,
        fileSize: att.fileSize,
        url: await ctx.storage.getUrl(att.storageId),
      })),
    );
  },
});
