import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuth, getOptionalAuth, requireBoardAccess } from "./lib/rbac";

// Helper to get board ID from card
async function getBoardIdFromCard(ctx: QueryCtx | MutationCtx, cardId: Id<"cards">) {
  const card = await ctx.db.get(cardId);
  if (!card) return null;

  const column = await ctx.db.get(card.columnId);
  return column?.boardId || null;
}

/**
 * List documents linked to a card
 */
export const listByCard = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
    const authUser = await getOptionalAuth(ctx);
    if (!authUser) return [];
    const userId = authUser._id as unknown as Id<"users">;

    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    await requireBoardAccess(ctx, userId, boardId, "member");

    const links = await ctx.db
      .query("documentLinks")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    const documents = await Promise.all(
      links.map(async (link) => {
        const doc = await ctx.db.get(link.documentId);
        if (!doc) return null;
        return {
          _id: doc._id,
          title: doc.title,
          updatedAt: doc.updatedAt,
          linkId: link._id,
        };
      })
    );

    return documents.filter(Boolean);
  },
});

/**
 * List cards linked to a document
 */
export const listByDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const authUser = await getOptionalAuth(ctx);
    if (!authUser) return [];
    const userId = authUser._id as unknown as Id<"users">;

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");

    await requireBoardAccess(ctx, userId, document.boardId, "member");

    const links = await ctx.db
      .query("documentLinks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const cards = await Promise.all(
      links.map(async (link) => {
        const card = await ctx.db.get(link.cardId);
        if (!card) return null;

        const column = await ctx.db.get(card.columnId);
        return {
          _id: card._id,
          slug: card.slug,
          title: card.title,
          columnName: column?.name || "Unknown",
          linkId: link._id,
        };
      })
    );

    return cards.filter(Boolean);
  },
});

/**
 * Link a document to a card
 */
export const link = mutation({
  args: {
    cardId: v.id("cards"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    // Verify the card exists and user has access
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    await requireBoardAccess(ctx, userId, boardId, "member");

    // Verify the document exists and belongs to the same board
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");
    if (document.boardId !== boardId) {
      throw new Error("Document must belong to the same board as the card");
    }

    // Check if link already exists
    const existingLinks = await ctx.db
      .query("documentLinks")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    const alreadyLinked = existingLinks.some(
      (link) => link.documentId === args.documentId
    );

    if (alreadyLinked) {
      return { success: true, alreadyLinked: true };
    }

    // Create the link
    await ctx.db.insert("documentLinks", {
      cardId: args.cardId,
      documentId: args.documentId,
      createdById: userId,
      createdAt: Date.now(),
    });

    return { success: true, alreadyLinked: false };
  },
});

/**
 * Unlink a document from a card
 */
export const unlink = mutation({
  args: {
    cardId: v.id("cards"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const authUser = await requireAuth(ctx);
    const userId = authUser._id as unknown as Id<"users">;

    // Verify user has access to the card's board
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    await requireBoardAccess(ctx, userId, boardId, "member");

    // Find and delete the link
    const links = await ctx.db
      .query("documentLinks")
      .withIndex("by_card", (q) => q.eq("cardId", args.cardId))
      .collect();

    const linkToDelete = links.find(
      (link) => link.documentId === args.documentId
    );

    if (linkToDelete) {
      await ctx.db.delete(linkToDelete._id);
    }

    return { success: true };
  },
});
