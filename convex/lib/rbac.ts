import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { authComponent } from "../auth";

export type BoardRole = "owner" | "admin" | "member";

// Role hierarchy for permission checks
const roleHierarchy: BoardRole[] = ["member", "admin", "owner"];

/**
 * Get current authenticated user from context or throw
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Get current user or null (for optional auth)
 */
export async function getOptionalAuth(ctx: QueryCtx | MutationCtx) {
  try {
    return await authComponent.getAuthUser(ctx);
  } catch {
    return null;
  }
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
