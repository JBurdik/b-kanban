import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

// Helper to get user by email
async function getUserByEmail(ctx: Ctx, email: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

// Helper to check board membership
async function hasBoardAccess(
  ctx: Ctx,
  boardId: Id<"boards">,
  userId: Id<"users">,
) {
  const membership = await ctx.db
    .query("boardMembers")
    .withIndex("by_board_and_user", (q) =>
      q.eq("boardId", boardId).eq("userId", userId),
    )
    .first();
  return !!membership;
}

/**
 * List all HTML docs for a board (most recent first).
 */
export const list = query({
  args: { boardId: v.id("boards"), userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return [];

    const hasAccess = await hasBoardAccess(ctx, args.boardId, user._id);
    if (!hasAccess) return [];

    const docs = await ctx.db
      .query("htmlDocs")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    docs.sort((a, b) => b.updatedAt - a.updatedAt);

    return await Promise.all(
      docs.map(async (doc) => {
        const creator = await ctx.db.get(doc.createdById);
        return {
          ...doc,
          creator: creator
            ? {
                id: creator._id,
                name: creator.name,
                email: creator.email,
                image: creator.image,
              }
            : null,
        };
      }),
    );
  },
});

/**
 * Get a single HTML doc with a (time-limited) URL to its content, suitable for
 * rendering directly in a sandboxed iframe via the `src` attribute.
 */
export const get = query({
  args: { docId: v.id("htmlDocs"), userEmail: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.docId);
    if (!doc) return null;

    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) return null;

    const hasAccess = await hasBoardAccess(ctx, doc.boardId, user._id);
    if (!hasAccess) return null;

    const creator = await ctx.db.get(doc.createdById);
    const url = await ctx.storage.getUrl(doc.storageId);

    return {
      ...doc,
      url,
      creator: creator
        ? {
            id: creator._id,
            name: creator.name,
            email: creator.email,
            image: creator.image,
          }
        : null,
    };
  },
});

/**
 * Generate an upload URL for the UI file-upload flow.
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
 * Save metadata after a file has been uploaded to storage (UI flow).
 */
export const create = mutation({
  args: {
    boardId: v.id("boards"),
    title: v.string(),
    fileName: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");

    const hasAccess = await hasBoardAccess(ctx, args.boardId, user._id);
    if (!hasAccess) {
      // Clean up the orphaned blob before bailing.
      await ctx.storage.delete(args.storageId);
      throw new Error("Access denied");
    }

    const now = Date.now();
    return await ctx.db.insert("htmlDocs", {
      boardId: args.boardId,
      title: args.title,
      fileName: args.fileName,
      storageId: args.storageId,
      fileSize: args.fileSize,
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Replace the stored content of an existing HTML doc (deletes the old blob).
 */
export const replaceContent = mutation({
  args: {
    docId: v.id("htmlDocs"),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    title: v.optional(v.string()),
    fileName: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.docId);
    if (!doc) throw new Error("Document not found");

    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");

    const hasAccess = await hasBoardAccess(ctx, doc.boardId, user._id);
    if (!hasAccess) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Access denied");
    }

    await ctx.storage.delete(doc.storageId);

    const updates: Record<string, unknown> = {
      storageId: args.storageId,
      fileSize: args.fileSize,
      updatedAt: Date.now(),
    };
    if (args.title !== undefined) updates.title = args.title;
    if (args.fileName !== undefined) updates.fileName = args.fileName;

    await ctx.db.patch(args.docId, updates);
    return args.docId;
  },
});

/**
 * Rename an HTML doc (title only).
 */
export const rename = mutation({
  args: {
    docId: v.id("htmlDocs"),
    title: v.string(),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.docId);
    if (!doc) throw new Error("Document not found");

    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");

    const hasAccess = await hasBoardAccess(ctx, doc.boardId, user._id);
    if (!hasAccess) throw new Error("Access denied");

    await ctx.db.patch(args.docId, {
      title: args.title,
      updatedAt: Date.now(),
    });
    return args.docId;
  },
});

/**
 * Delete an HTML doc and its stored blob.
 */
export const remove = mutation({
  args: { docId: v.id("htmlDocs"), userEmail: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.docId);
    if (!doc) throw new Error("Document not found");

    const user = await getUserByEmail(ctx, args.userEmail);
    if (!user) throw new Error("User not found");

    const hasAccess = await hasBoardAccess(ctx, doc.boardId, user._id);
    if (!hasAccess) throw new Error("Access denied");

    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete(args.docId);
    return { success: true };
  },
});

/**
 * Create (or overwrite) an HTML doc from a raw HTML string. Stores the string
 * as a blob in file storage, then records metadata. Used by the MCP server
 * (which passes HTML directly) and any client that has the HTML in-memory.
 *
 * If `docId` is provided, the existing doc's content is replaced instead.
 */
export const createFromHtml = action({
  args: {
    boardId: v.id("boards"),
    title: v.string(),
    fileName: v.optional(v.string()),
    html: v.string(),
    docId: v.optional(v.id("htmlDocs")),
    userEmail: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"htmlDocs">> => {
    const blob = new Blob([args.html], { type: "text/html" });
    const storageId = await ctx.storage.store(blob);

    const fileName =
      args.fileName ??
      `${args.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.html`;

    if (args.docId) {
      return await ctx.runMutation(api.htmlDocs.replaceContent, {
        docId: args.docId,
        storageId,
        fileSize: blob.size,
        title: args.title,
        fileName,
        userEmail: args.userEmail,
      });
    }

    return await ctx.runMutation(api.htmlDocs.create, {
      boardId: args.boardId,
      title: args.title,
      fileName,
      storageId,
      fileSize: blob.size,
      userEmail: args.userEmail,
    });
  },
});

/**
 * Read the raw HTML content of a doc (text). Used by the MCP `get_html_doc`
 * tool so an agent can read documentation it (or someone else) uploaded.
 */
export const getContent = action({
  args: { docId: v.id("htmlDocs"), userEmail: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ title: string; fileName: string; html: string } | null> => {
    const doc = await ctx.runQuery(api.htmlDocs.get, {
      docId: args.docId,
      userEmail: args.userEmail,
    });
    if (!doc) return null;

    const blob = await ctx.storage.get(doc.storageId);
    if (!blob) return null;
    const html = await blob.text();

    return { title: doc.title, fileName: doc.fileName, html };
  },
});
