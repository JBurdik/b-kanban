import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Helper to get user by email
async function getUserByEmail(ctx: QueryCtx | MutationCtx, email: string) {
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  return user;
}

// Helper to get board ID from card
async function getBoardIdFromCard(ctx: QueryCtx | MutationCtx, cardId: Id<"cards">) {
  const card = await ctx.db.get(cardId);
  if (!card) return null;

  const column = await ctx.db.get(card.columnId);
  return column?.boardId || null;
}

// Helper to check board membership
async function hasBoardAccess(
  ctx: QueryCtx | MutationCtx,
  boardId: Id<"boards">,
  userId: Id<"users">
) {
  const membership = await ctx.db
    .query("boardMembers")
    .withIndex("by_board_and_user", (q) =>
      q.eq("boardId", boardId).eq("userId", userId)
    )
    .first();
  return !!membership;
}

/**
 * List documents linked to a card
 */
export const listByCard = query({
  args: { cardId: v.id("cards") },
  handler: async (ctx, args) => {
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
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");

    // Verify the card exists and user has access
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    const hasAccess = await hasBoardAccess(ctx, boardId, user._id);
    if (!hasAccess) throw new Error("Access denied");

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
      createdById: user._id,
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
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");

    // Verify user has access to the card's board
    const boardId = await getBoardIdFromCard(ctx, args.cardId);
    if (!boardId) throw new Error("Card not found");

    const hasAccess = await hasBoardAccess(ctx, boardId, user._id);
    if (!hasAccess) throw new Error("Access denied");

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
