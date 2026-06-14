import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Append a single entry to a card's activity / history log.
 * Best-effort: callers fire this alongside the actual db.patch.
 */
export async function recordActivity(
  ctx: MutationCtx,
  entry: {
    cardId: Id<"cards">;
    userId: Id<"users">;
    action: string;
    field?: string;
    oldValue?: string | null;
    newValue?: string | null;
  },
) {
  await ctx.db.insert("cardActivity", {
    cardId: entry.cardId,
    userId: entry.userId,
    action: entry.action,
    field: entry.field,
    oldValue: entry.oldValue ?? undefined,
    newValue: entry.newValue ?? undefined,
    createdAt: Date.now(),
  });
}

type CardUpdateArgs = {
  title?: string;
  columnId?: Id<"columns">;
  priority?: "low" | "medium" | "high" | null;
  type?: "task" | "bug" | null;
  assigneeId?: Id<"users"> | null;
  reporterId?: Id<"users"> | null;
  versionId?: Id<"versions"> | null;
  dueDate?: number;
  effort?: number;
  content?: string;
};

/**
 * Diff an incoming card update against the stored card and append one
 * history entry per changed field. Shared by the public `update` mutation
 * and the MCP `updateByEmail` mutation.
 */
export async function logCardUpdate(
  ctx: MutationCtx,
  opts: { cardId: Id<"cards">; userId: Id<"users">; card: Doc<"cards">; args: CardUpdateArgs },
) {
  const { cardId, userId, card, args } = opts;
  const log = (field: string, oldValue?: string | null, newValue?: string | null) =>
    recordActivity(ctx, { cardId, userId, action: "field", field, oldValue, newValue });
  const userLabel = async (id?: Id<"users"> | null) => {
    if (!id) return null;
    const u = await ctx.db.get(id);
    return u?.name ?? u?.email ?? null;
  };

  if (args.title !== undefined && args.title !== card.title) {
    await log("title", card.title, args.title);
  }
  if (args.columnId !== undefined && args.columnId !== card.columnId) {
    const [oldCol, newCol] = await Promise.all([ctx.db.get(card.columnId), ctx.db.get(args.columnId)]);
    await recordActivity(ctx, {
      cardId,
      userId,
      action: "moved",
      field: "column",
      oldValue: oldCol?.name ?? null,
      newValue: newCol?.name ?? null,
    });
  }
  if (args.priority !== undefined && (args.priority ?? null) !== (card.priority ?? null)) {
    await log("priority", card.priority ?? "none", args.priority ?? "none");
  }
  if (args.type !== undefined && (args.type ?? null) !== (card.type ?? null)) {
    await log("type", card.type ?? "none", args.type ?? "none");
  }
  if (args.assigneeId !== undefined && (args.assigneeId ?? null) !== (card.assigneeId ?? null)) {
    await log(
      "assignee",
      (await userLabel(card.assigneeId)) ?? "unassigned",
      (await userLabel(args.assigneeId)) ?? "unassigned",
    );
  }
  if (args.reporterId !== undefined && (args.reporterId ?? null) !== (card.reporterId ?? null)) {
    await log("reporter", (await userLabel(card.reporterId)) ?? "none", (await userLabel(args.reporterId)) ?? "none");
  }
  if (args.versionId !== undefined && (args.versionId ?? null) !== (card.versionId ?? null)) {
    const [oldV, newV] = await Promise.all([
      card.versionId ? ctx.db.get(card.versionId) : Promise.resolve(null),
      args.versionId ? ctx.db.get(args.versionId) : Promise.resolve(null),
    ]);
    await log("version", oldV?.name ?? "none", newV?.name ?? "none");
  }
  if (args.dueDate !== undefined && args.dueDate !== card.dueDate) {
    await log(
      "dueDate",
      card.dueDate ? new Date(card.dueDate).toLocaleDateString() : "none",
      args.dueDate ? new Date(args.dueDate).toLocaleDateString() : "none",
    );
  }
  if (args.effort !== undefined && args.effort !== card.effort) {
    await log("effort", String(card.effort ?? "none"), String(args.effort ?? "none"));
  }
  if (args.content !== undefined && args.content !== card.content) {
    await log("description", null, null);
  }
}
