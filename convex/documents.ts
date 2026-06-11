import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOptionalAuth, requireAuth } from "./lib/rbac";

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
 * List all documents for a board
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) return [];

    const hasAccess = await hasBoardAccess(ctx, args.boardId, user._id);
    if (!hasAccess) return [];

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    // Sort by updatedAt descending (most recent first)
    documents.sort((a, b) => b.updatedAt - a.updatedAt);

    // Get creator info for each document
    const documentsWithCreator = await Promise.all(
      documents.map(async (doc) => {
        const creator = await ctx.db.get(doc.createdById);
        return {
          ...doc,
          creator: creator
            ? {
                id: creator._id,
                name: creator.name ?? "",
                email: creator.email ?? "",
                image: creator.image,
              }
            : null,
        };
      })
    );

    return documentsWithCreator;
  },
});

/**
 * Get a single document with linked cards
 */
export const get = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) return null;

    const user = await getOptionalAuth(ctx);
    if (!user) return null;

    const hasAccess = await hasBoardAccess(ctx, document.boardId, user._id);
    if (!hasAccess) return null;

    // Get creator info
    const creator = await ctx.db.get(document.createdById);

    // Get linked cards
    const links = await ctx.db
      .query("documentLinks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const linkedCards = await Promise.all(
      links.map(async (link) => {
        const card = await ctx.db.get(link.cardId);
        if (!card) return null;

        const column = await ctx.db.get(card.columnId);
        return {
          id: card._id,
          slug: card.slug,
          title: card.title,
          columnName: column?.name || "Unknown",
        };
      })
    );

    return {
      ...document,
      creator: creator
        ? {
            id: creator._id,
            name: creator.name ?? "",
            email: creator.email ?? "",
            image: creator.image,
          }
        : null,
      linkedCards: linkedCards.filter(Boolean),
    };
  },
});

/**
 * Create a new document
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    title: v.string(),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const hasAccess = await hasBoardAccess(ctx, args.boardId, user._id);
    if (!hasAccess) throw new Error("Access denied");

    const now = Date.now();

    const documentId = await ctx.db.insert("documents", {
      boardId: args.boardId,
      title: args.title,
      content: args.content,
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });

    return documentId;
  },
});

/**
 * Update a document
 */
export const update = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");

    const user = await requireAuth(ctx);

    const hasAccess = await hasBoardAccess(ctx, document.boardId, user._id);
    if (!hasAccess) throw new Error("Access denied");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;

    await ctx.db.patch(args.documentId, updates);

    return args.documentId;
  },
});

/**
 * Delete a document and its links
 */
export const remove = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");

    const user = await requireAuth(ctx);

    const hasAccess = await hasBoardAccess(ctx, document.boardId, user._id);
    if (!hasAccess) throw new Error("Access denied");

    // Delete all links to this document
    const links = await ctx.db
      .query("documentLinks")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    for (const link of links) {
      await ctx.db.delete(link._id);
    }

    // Delete the document
    await ctx.db.delete(args.documentId);

    return { success: true };
  },
});

/**
 * Search documents by title (for linking UI)
 */
export const search = query({
  args: {
    boardId: v.id("boards"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) return [];

    const hasAccess = await hasBoardAccess(ctx, args.boardId, user._id);
    if (!hasAccess) return [];

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    // Filter by title (case-insensitive)
    const searchLower = args.query.toLowerCase();
    const filtered = documents.filter((doc) =>
      doc.title.toLowerCase().includes(searchLower)
    );

    // Sort by updatedAt descending and limit results
    filtered.sort((a, b) => b.updatedAt - a.updatedAt);
    const limited = filtered.slice(0, 10);

    return limited.map((doc) => ({
      _id: doc._id,
      title: doc.title,
      updatedAt: doc.updatedAt,
    }));
  },
});
