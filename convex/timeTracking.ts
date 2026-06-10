import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ============================================
// Helper Functions
// ============================================

function getStartOfDay(timestamp?: number): number {
  const d = timestamp ? new Date(timestamp) : new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ============================================
// Queries
// ============================================

/**
 * Get the user's currently active timer (if any)
 */
export const getActiveTimer = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return null;

    const timer = await ctx.db
      .query("activeTimers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!timer) return null;

    // Get card info if linked
    let card = null;
    if (timer.cardId) {
      const cardDoc = await ctx.db.get(timer.cardId);
      if (cardDoc) {
        card = { _id: cardDoc._id, slug: cardDoc.slug, title: cardDoc.title };
      }
    }

    // Get board info if linked
    let board = null;
    if (timer.boardId) {
      const boardDoc = await ctx.db.get(timer.boardId);
      if (boardDoc) {
        board = { _id: boardDoc._id, name: boardDoc.name };
      }
    }

    return { ...timer, card, board };
  },
});

/**
 * Get today's time entries for the current user
 */
export const getTodayEntries = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return { entries: [], totalMs: 0 };

    const todayStart = getStartOfDay();

    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", todayStart)
      )
      .collect();

    // Enrich with card/board info
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        let card = null;
        let board = null;

        if (entry.cardId) {
          const cardDoc = await ctx.db.get(entry.cardId);
          if (cardDoc) {
            card = { _id: cardDoc._id, slug: cardDoc.slug, title: cardDoc.title };
          }
        }

        if (entry.boardId) {
          const boardDoc = await ctx.db.get(entry.boardId);
          if (boardDoc) {
            board = { _id: boardDoc._id, name: boardDoc.name };
          }
        }

        return { ...entry, card, board };
      })
    );

    const totalMs = entries.reduce((sum, e) => sum + e.durationMs, 0);

    return { entries: enrichedEntries, totalMs };
  },
});

/**
 * Get time entries for a date range
 */
export const getEntriesByDateRange = query({
  args: {
    userEmail: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    boardId: v.optional(v.id("boards")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return [];

    let entries;
    if (args.boardId) {
      entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_user_board", (q) =>
          q.eq("userId", user._id).eq("boardId", args.boardId)
        )
        .collect();
      // Filter by date range
      entries = entries.filter(
        (e) => e.date >= args.startDate && e.date <= args.endDate
      );
    } else {
      entries = await ctx.db
        .query("timeEntries")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      // Filter by date range
      entries = entries.filter(
        (e) => e.date >= args.startDate && e.date <= args.endDate
      );
    }

    // Enrich with card/board info
    const enrichedEntries = await Promise.all(
      entries.map(async (entry) => {
        let card = null;
        let board = null;

        if (entry.cardId) {
          const cardDoc = await ctx.db.get(entry.cardId);
          if (cardDoc) {
            card = { _id: cardDoc._id, slug: cardDoc.slug, title: cardDoc.title };
          }
        }

        if (entry.boardId) {
          const boardDoc = await ctx.db.get(entry.boardId);
          if (boardDoc) {
            board = { _id: boardDoc._id, name: boardDoc.name };
          }
        }

        return { ...entry, card, board };
      })
    );

    return enrichedEntries.sort((a, b) => b.date - a.date);
  },
});

/**
 * Get monthly summary grouped by board
 */
export const getMonthlySummary = query({
  args: {
    userEmail: v.string(),
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) return { totalMs: 0, byBoard: [], entries: [] };

    // Calculate month start and end
    const startDate = new Date(args.year, args.month - 1, 1).getTime();
    const endDate = new Date(args.year, args.month, 0, 23, 59, 59, 999).getTime();

    const entries = await ctx.db
      .query("timeEntries")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter by date range
    const monthEntries = entries.filter(
      (e) => e.date >= startDate && e.date <= endDate
    );

    // Group by board
    const boardTotals: Record<string, { boardId: string | null; name: string; totalMs: number }> = {};

    for (const entry of monthEntries) {
      const key = entry.boardId ?? "standalone";

      if (!boardTotals[key]) {
        let name = "Standalone";
        if (entry.boardId) {
          const board = await ctx.db.get(entry.boardId);
          name = board?.name ?? "Unknown Board";
        }
        boardTotals[key] = { boardId: entry.boardId ?? null, name, totalMs: 0 };
      }

      boardTotals[key].totalMs += entry.durationMs;
    }

    const totalMs = monthEntries.reduce((sum, e) => sum + e.durationMs, 0);

    return {
      totalMs,
      byBoard: Object.values(boardTotals).sort((a, b) => b.totalMs - a.totalMs),
      entryCount: monthEntries.length,
    };
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Start a new timer
 */
export const startTimer = mutation({
  args: {
    userEmail: v.string(),
    description: v.string(),
    cardId: v.optional(v.id("cards")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) throw new Error("User not found");

    // Check for existing timer and stop it
    const existingTimer = await ctx.db
      .query("activeTimers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingTimer) {
      // Auto-stop existing timer and create entry
      const durationMs = Date.now() - existingTimer.startedAt;

      await ctx.db.insert("timeEntries", {
        userId: user._id,
        cardId: existingTimer.cardId,
        boardId: existingTimer.boardId,
        description: existingTimer.description,
        durationMs,
        date: getStartOfDay(existingTimer.startedAt),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.delete(existingTimer._id);
    }

    // Get boardId from card if provided
    let boardId = undefined;
    if (args.cardId) {
      const card = await ctx.db.get(args.cardId);
      if (card) {
        const column = await ctx.db.get(card.columnId);
        if (column) {
          boardId = column.boardId;
        }
      }
    }

    // Create new timer
    const timerId = await ctx.db.insert("activeTimers", {
      userId: user._id,
      cardId: args.cardId,
      boardId,
      description: args.description || "Working...",
      startedAt: Date.now(),
      createdAt: Date.now(),
    });

    return timerId;
  },
});

/**
 * Stop the active timer and create a time entry
 */
export const stopTimer = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) throw new Error("User not found");

    const timer = await ctx.db
      .query("activeTimers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!timer) throw new Error("No active timer");

    const durationMs = Date.now() - timer.startedAt;

    // Create time entry
    const entryId = await ctx.db.insert("timeEntries", {
      userId: user._id,
      cardId: timer.cardId,
      boardId: timer.boardId,
      description: timer.description,
      durationMs,
      date: getStartOfDay(timer.startedAt),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Delete timer
    await ctx.db.delete(timer._id);

    return entryId;
  },
});

/**
 * Discard the active timer without saving
 */
export const discardTimer = mutation({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) throw new Error("User not found");

    const timer = await ctx.db
      .query("activeTimers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!timer) throw new Error("No active timer");

    await ctx.db.delete(timer._id);

    return { success: true };
  },
});

/**
 * Update the active timer's description or linked card
 */
export const updateTimer = mutation({
  args: {
    userEmail: v.string(),
    description: v.optional(v.string()),
    cardId: v.optional(v.id("cards")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) throw new Error("User not found");

    const timer = await ctx.db
      .query("activeTimers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!timer) throw new Error("No active timer");

    const updates: Record<string, unknown> = {};

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.cardId !== undefined) {
      updates.cardId = args.cardId;
      // Update boardId from card
      if (args.cardId) {
        const card = await ctx.db.get(args.cardId);
        if (card) {
          const column = await ctx.db.get(card.columnId);
          if (column) {
            updates.boardId = column.boardId;
          }
        }
      } else {
        updates.boardId = undefined;
      }
    }

    await ctx.db.patch(timer._id, updates);

    return timer._id;
  },
});

/**
 * Add a manual time entry
 */
export const addManualEntry = mutation({
  args: {
    userEmail: v.string(),
    description: v.string(),
    hours: v.number(),
    minutes: v.number(),
    date: v.optional(v.number()),
    cardId: v.optional(v.id("cards")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.userEmail))
      .first();

    if (!user) throw new Error("User not found");

    // Convert hours + minutes to milliseconds
    const durationMs = (args.hours * 60 + args.minutes) * 60 * 1000;

    if (durationMs <= 0) throw new Error("Duration must be positive");

    // Get boardId from card if provided
    let boardId = undefined;
    if (args.cardId) {
      const card = await ctx.db.get(args.cardId);
      if (card) {
        const column = await ctx.db.get(card.columnId);
        if (column) {
          boardId = column.boardId;
        }
      }
    }

    // Use provided date or today
    const date = getStartOfDay(args.date);

    const entryId = await ctx.db.insert("timeEntries", {
      userId: user._id,
      cardId: args.cardId,
      boardId,
      description: args.description,
      durationMs,
      date,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return entryId;
  },
});

/**
 * Update an existing time entry
 */
export const updateEntry = mutation({
  args: {
    entryId: v.id("timeEntries"),
    description: v.optional(v.string()),
    hours: v.optional(v.number()),
    minutes: v.optional(v.number()),
    cardId: v.optional(v.id("cards")),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Entry not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.description !== undefined) {
      updates.description = args.description;
    }

    if (args.hours !== undefined || args.minutes !== undefined) {
      // Get current hours/minutes if not provided
      const currentHours = Math.floor(entry.durationMs / (60 * 60 * 1000));
      const currentMinutes = Math.floor(
        (entry.durationMs % (60 * 60 * 1000)) / (60 * 1000)
      );

      const hours = args.hours ?? currentHours;
      const minutes = args.minutes ?? currentMinutes;
      const durationMs = (hours * 60 + minutes) * 60 * 1000;

      if (durationMs <= 0) throw new Error("Duration must be positive");

      updates.durationMs = durationMs;
    }

    if (args.cardId !== undefined) {
      updates.cardId = args.cardId || undefined;
      // Update boardId from card
      if (args.cardId) {
        const card = await ctx.db.get(args.cardId);
        if (card) {
          const column = await ctx.db.get(card.columnId);
          if (column) {
            updates.boardId = column.boardId;
          }
        }
      } else {
        updates.boardId = undefined;
      }
    }

    await ctx.db.patch(args.entryId, updates);

    return args.entryId;
  },
});

/**
 * Delete a time entry
 */
export const deleteEntry = mutation({
  args: { entryId: v.id("timeEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Entry not found");

    await ctx.db.delete(args.entryId);

    return { success: true };
  },
});
