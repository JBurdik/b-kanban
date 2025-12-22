import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
  args: {},
  handler: async (ctx) => {
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
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db.get(args.cardId);
    if (!card) throw new Error("Card not found");

    const attachmentId = await ctx.db.insert("attachments", {
      cardId: args.cardId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      uploadedById: args.userId,
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
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) throw new Error("Attachment not found");

    // Delete from storage
    await ctx.storage.delete(attachment.storageId);

    // Delete from database
    await ctx.db.delete(args.attachmentId);

    return { success: true };
  },
});
