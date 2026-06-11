import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

export type BoardRole = "owner" | "admin" | "member";

const roleHierarchy: BoardRole[] = ["member", "admin", "owner"];

// ---------------------------------------------------------------------------
// Auth via Convex Auth.
//
// getAuthUserId(ctx) reads the validated JWT identity natively — no better-auth
// adapter.js, no isolate OOM. The `sessionToken` second arg is a legacy holdover
// from the session-token mirror approach and is IGNORED (kept so existing
// callsites keep compiling; a follow-up sweep removes it everywhere).
// ---------------------------------------------------------------------------

// For QUERIES: resolve the caller's user, or null when unauthenticated.
export async function getOptionalAuth(
  ctx: QueryCtx | MutationCtx,
  _sessionToken?: string,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return ctx.db.get(userId);
}

// For MUTATIONS (and queries): require a valid session or throw.
export async function requireAuth(
  ctx: QueryCtx | MutationCtx,
  _sessionToken?: string,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * Check if user has access to a board with minimum role
 */
export async function checkBoardAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  boardId: Id<"boards">,
  minRole: BoardRole = "member"
): Promise<{ hasAccess: boolean; role?: BoardRole }> {
  const member = await ctx.db
    .query("boardMembers")
    .withIndex("by_board_and_user", (q) =>
      q.eq("boardId", boardId).eq("userId", userId)
    )
    .first();

  if (!member) {
    return { hasAccess: false };
  }

  const userRoleIndex = roleHierarchy.indexOf(member.role);
  const minRoleIndex = roleHierarchy.indexOf(minRole);

  return {
    hasAccess: userRoleIndex >= minRoleIndex,
    role: member.role,
  };
}

/**
 * Require board access or throw
 */
export async function requireBoardAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  boardId: Id<"boards">,
  minRole: BoardRole = "member"
): Promise<{ role: BoardRole }> {
  const { hasAccess, role } = await checkBoardAccess(ctx, userId, boardId, minRole);
  if (!hasAccess) {
    throw new Error("Access denied");
  }
  return { role: role! };
}

/**
 * Get board ID from column ID
 */
export async function getBoardIdFromColumn(
  ctx: QueryCtx | MutationCtx,
  columnId: Id<"columns">
): Promise<Id<"boards"> | null> {
  const column = await ctx.db.get(columnId);
  return column?.boardId || null;
}

/**
 * Get board ID from card ID
 */
export async function getBoardIdFromCard(
  ctx: QueryCtx | MutationCtx,
  cardId: Id<"cards">
): Promise<Id<"boards"> | null> {
  const card = await ctx.db.get(cardId);
  if (!card) return null;

  const column = await ctx.db.get(card.columnId);
  return column?.boardId || null;
}

/**
 * Check if role can manage columns (admin or owner)
 */
export function canManageColumns(role: BoardRole): boolean {
  return role === "admin" || role === "owner";
}

/**
 * Check if role can manage members (admin or owner)
 */
export function canManageMembers(role: BoardRole): boolean {
  return role === "admin" || role === "owner";
}

/**
 * Check if role is owner
 */
export function isOwner(role: BoardRole): boolean {
  return role === "owner";
}
