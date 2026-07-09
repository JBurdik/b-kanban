import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOptionalAuth, requireAuth, requireBoardAccess } from "./lib/rbac";

const EMPTY_SCENE = "[]";
const EMPTY_APP_STATE = "{}";

/**
 * Load a canvas and assert the caller may touch it. Throws on both missing and
 * inaccessible, so callers can't distinguish the two.
 */
async function requireCanvas(
  ctx: MutationCtx,
  canvasId: Id<"canvases">,
  userId: Id<"users">
) {
  const canvas = await ctx.db.get(canvasId);
  if (!canvas) throw new Error("Canvas not found");
  await requireBoardAccess(ctx, userId, canvas.boardId);
  return canvas;
}

/**
 * List canvases for a board, most recently edited first.
 */
export const list = query({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) return [];

    // Membership is board-wide; one check covers every row.
    const { hasAccess } = await checkAccess(ctx, user._id, args.boardId);
    if (!hasAccess) return [];

    const canvases = await ctx.db
      .query("canvases")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    canvases.sort((a, b) => b.updatedAt - a.updatedAt);

    return canvases.map((canvas) => ({
      _id: canvas._id,
      name: canvas.name,
      createdById: canvas.createdById,
      createdAt: canvas.createdAt,
      updatedAt: canvas.updatedAt,
    }));
  },
});

// Thin wrapper so `list` can soft-fail (return []) instead of throwing.
async function checkAccess(
  ctx: QueryCtx,
  userId: Id<"users">,
  boardId: Id<"boards">
) {
  const member = await ctx.db
    .query("boardMembers")
    .withIndex("by_board_and_user", (q) =>
      q.eq("boardId", boardId).eq("userId", userId)
    )
    .first();
  return { hasAccess: !!member };
}

/**
 * Get one canvas plus signed URLs for every image it references.
 */
export const get = query({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) return null;

    const user = await getOptionalAuth(ctx);
    if (!user) return null;

    const { hasAccess } = await checkAccess(ctx, user._id, canvas.boardId);
    if (!hasAccess) return null;

    const fileRows = await ctx.db
      .query("canvasFiles")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    const files = await Promise.all(
      fileRows.map(async (row) => ({
        fileId: row.fileId,
        mimeType: row.mimeType,
        url: await ctx.storage.getUrl(row.storageId),
      }))
    );

    return {
      _id: canvas._id,
      boardId: canvas.boardId,
      name: canvas.name,
      elements: canvas.elements,
      appState: canvas.appState,
      updatedAt: canvas.updatedAt,
      files: files.filter((f) => f.url !== null),
    };
  },
});

export const create = mutation({
  args: { boardId: v.id("boards"), name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireBoardAccess(ctx, user._id, args.boardId);

    const now = Date.now();
    return await ctx.db.insert("canvases", {
      boardId: args.boardId,
      name: args.name,
      elements: EMPTY_SCENE,
      appState: EMPTY_APP_STATE,
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: { canvasId: v.id("canvases"), name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireCanvas(ctx, args.canvasId, user._id);

    await ctx.db.patch(args.canvasId, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Overwrite the whole scene. Last write wins; concurrent editors clobber each
 * other. See the design doc — acceptable for v1.
 */
export const save = mutation({
  args: {
    canvasId: v.id("canvases"),
    elements: v.string(),
    appState: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireCanvas(ctx, args.canvasId, user._id);

    const updatedAt = Date.now();
    await ctx.db.patch(args.canvasId, {
      elements: args.elements,
      appState: args.appState,
      updatedAt,
    });

    // The client echoes this back to tell its own write apart from a peer's.
    return updatedAt;
  },
});

export const remove = mutation({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireCanvas(ctx, args.canvasId, user._id);

    const fileRows = await ctx.db
      .query("canvasFiles")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    for (const row of fileRows) {
      await ctx.storage.delete(row.storageId);
      await ctx.db.delete(row._id);
    }

    // Otherwise cards keep pointing at a canvas that no longer exists.
    const links = await ctx.db
      .query("canvasLinks")
      .withIndex("by_canvas", (q) => q.eq("canvasId", args.canvasId))
      .collect();

    for (const link of links) {
      await ctx.db.delete(link._id);
    }

    await ctx.db.delete(args.canvasId);
    return { success: true };
  },
});

/**
 * Search canvases by name within a board (for the card-linking picker).
 */
export const search = query({
  args: { boardId: v.id("boards"), query: v.string() },
  handler: async (ctx, args) => {
    const user = await getOptionalAuth(ctx);
    if (!user) return [];

    const { hasAccess } = await checkAccess(ctx, user._id, args.boardId);
    if (!hasAccess) return [];

    const canvases = await ctx.db
      .query("canvases")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const needle = args.query.toLowerCase();
    return canvases
      .filter((canvas) => canvas.name.toLowerCase().includes(needle))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10)
      .map((canvas) => ({ _id: canvas._id, name: canvas.name, updatedAt: canvas.updatedAt }));
  },
});

/**
 * Internal: Create a canvas attributed to a user by email (used by MCP after Bearer auth)
 */
export const createByEmail = internalMutation({
  args: { boardId: v.id("boards"), name: v.string(), userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) throw new Error("User not found");

    const now = Date.now();
    return await ctx.db.insert("canvases", {
      boardId: args.boardId,
      name: args.name,
      elements: EMPTY_SCENE,
      appState: EMPTY_APP_STATE,
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Internal: Overwrite a canvas scene, attributed to a user by email (used by MCP after Bearer auth)
 */
export const saveByEmail = internalMutation({
  args: {
    canvasId: v.id("canvases"),
    elements: v.string(),
    appState: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.userEmail))
      .first();
    if (!user) throw new Error("User not found");

    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");

    const updatedAt = Date.now();
    await ctx.db.patch(args.canvasId, {
      elements: args.elements,
      appState: args.appState ?? canvas.appState,
      updatedAt,
    });

    return updatedAt;
  },
});

/**
 * Internal: Get a canvas by id (used by MCP after Bearer auth)
 */
export const getByEmail = internalQuery({
  args: { canvasId: v.id("canvases") },
  handler: async (ctx, args) => {
    const canvas = await ctx.db.get(args.canvasId);
    if (!canvas) throw new Error("Canvas not found");
    return {
      _id: canvas._id,
      boardId: canvas.boardId,
      name: canvas.name,
      elements: canvas.elements,
      updatedAt: canvas.updatedAt,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Register an uploaded image against a canvas. Idempotent: a retry that races a
 * previous success drops its own blob rather than orphaning the first one.
 */
export const addFile = mutation({
  args: {
    canvasId: v.id("canvases"),
    fileId: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    await requireCanvas(ctx, args.canvasId, user._id);

    const existing = await ctx.db
      .query("canvasFiles")
      .withIndex("by_canvas_file", (q) =>
        q.eq("canvasId", args.canvasId).eq("fileId", args.fileId)
      )
      .first();

    if (existing) {
      await ctx.storage.delete(args.storageId);
      return existing._id;
    }

    return await ctx.db.insert("canvasFiles", {
      canvasId: args.canvasId,
      fileId: args.fileId,
      storageId: args.storageId,
      mimeType: args.mimeType,
    });
  },
});
