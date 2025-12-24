import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Generate slug prefix from board name
 */
function generateSlugPrefix(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 4).toUpperCase();
  }
  return words
    .map((w) => w[0])
    .join("")
    .substring(0, 4)
    .toUpperCase();
}

/**
 * Get all boards for a user (by email)
 */
export const list = query({
  args: { userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userEmail) {
      return [];
    }

    // Look up user by email
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail!))
      .first();

    if (!user) {
      return [];
    }

    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const boardIds = memberships.map((m) => m.boardId);

    const boards = await Promise.all(
      boardIds.map(async (boardId) => {
        const board = await ctx.db.get(boardId);
        if (!board) return null;

        const columns = await ctx.db
          .query("columns")
          .withIndex("by_board", (q) => q.eq("boardId", boardId))
          .collect();

        const membership = memberships.find((m) => m.boardId === boardId);

        return {
          ...board,
          columnCount: columns.length,
          userRole: membership?.role,
        };
      }),
    );

    return boards.filter(Boolean);
  },
});

/**
 * Get single board with all data
 */
export const get = query({
  args: { boardId: v.id("boards"), userEmail: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const board = await ctx.db.get(args.boardId);
    if (!board) throw new Error("Board not found");

    // Look up user by email to get role
    let currentUserId: Id<"users"> | undefined;
    if (args.userEmail) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.userEmail!))
        .first();
      currentUserId = user?._id;
    }

    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    columns.sort((a, b) => a.position - b.position);

    const columnsWithCards = await Promise.all(
      columns.map(async (column) => {
        const cards = await ctx.db
          .query("cards")
          .withIndex("by_column", (q) => q.eq("columnId", column._id))
          .collect();

        cards.sort((a, b) => a.position - b.position);

        const cardsWithAssignee = await Promise.all(
          cards.map(async (card) => {
            let assignee = null;
            if (card.assigneeId) {
              const assigneeUser = await ctx.db.get(card.assigneeId);
              if (assigneeUser) {
                assignee = {
                  id: assigneeUser._id,
                  name: assigneeUser.name,
                  email: assigneeUser.email,
                  image: assigneeUser.image,
                };
              }
            }
            return { ...card, assignee };
          }),
        );

        return { ...column, cards: cardsWithAssignee };
      }),
    );

    const memberships = await ctx.db
      .query("boardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        return {
          id: m._id,
          role: m.role,
          userId: m.userId,
          user: memberUser
            ? {
                id: memberUser._id,
                name: memberUser.name,
                email: memberUser.email,
                image: memberUser.image,
              }
            : null,
        };
      }),
    );

    const userRole = currentUserId
      ? memberships.find((m) => m.userId === currentUserId)?.role
      : undefined;

    return {
      ...board,
      columns: columnsWithCards,
      members,
      userRole,
    };
  },
});

/**
 * Create a new board
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("[boards:create] Looking up user with email:", args.userEmail);

    // Look up user by email - create if doesn't exist (sync from better-auth)
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) {
      // User doesn't exist in our users table yet - create from session info
      // This syncs the user from better-auth to our users table
      console.log(
        "[boards:create] User not in DB, creating from email:",
        args.userEmail,
      );
      const userId = await ctx.db.insert("users", {
        email: args.userEmail,
        name: args.userEmail.split("@")[0], // Default name from email
        emailVerified: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      user = await ctx.db.get(userId);
      console.log("[boards:create] Created user:", user);
    }

    if (!user) {
      throw new Error("Failed to create user");
    }

    const now = Date.now();
    const slugPrefix = generateSlugPrefix(args.name);

    const boardId = await ctx.db.insert("boards", {
      name: args.name,
      description: args.description,
      slugPrefix,
      cardCounter: 0,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    const defaultColumns = ["To Do", "In Progress", "Done"];
    for (let i = 0; i < defaultColumns.length; i++) {
      await ctx.db.insert("columns", {
        boardId,
        name: defaultColumns[i],
        position: i,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("boardMembers", {
      boardId,
      userId: user._id,
      role: "owner",
      createdAt: now,
    });

    return boardId;
  },
});

/**
 * Update board
 */
export const update = mutation({
  args: {
    boardId: v.id("boards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.boardId, updates);

    return args.boardId;
  },
});

/**
 * Delete board
 */
export const remove = mutation({
  args: { boardId: v.id("boards") },
  handler: async (ctx, args) => {
    const columns = await ctx.db
      .query("columns")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    for (const column of columns) {
      const cards = await ctx.db
        .query("cards")
        .withIndex("by_column", (q) => q.eq("columnId", column._id))
        .collect();

      for (const card of cards) {
        const attachments = await ctx.db
          .query("attachments")
          .withIndex("by_card", (q) => q.eq("cardId", card._id))
          .collect();

        for (const att of attachments) {
          await ctx.storage.delete(att.storageId);
          await ctx.db.delete(att._id);
        }

        await ctx.db.delete(card._id);
      }

      await ctx.db.delete(column._id);
    }

    const members = await ctx.db
      .query("boardMembers")
      .withIndex("by_board", (q) => q.eq("boardId", args.boardId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    await ctx.db.delete(args.boardId);

    return { success: true };
  },
});
