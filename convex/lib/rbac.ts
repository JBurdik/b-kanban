import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

export type BoardRole = "owner" | "admin" | "member";

const roleHierarchy: BoardRole[] = ["member", "admin", "owner"];

// ---------------------------------------------------------------------------
// Auth on self-hosted Convex.
//
// getUserIdentity()/JWT auth does NOT work on this self-hosted backend: the
// better-auth token endpoint loads adapter.js (~57 MiB) which OOMs the V8
// isolate ("TooMuchMemoryCarryOver"), so no JWT is ever minted. Querying the
// betterAuth component directly loads the same adapter.js and OOMs too.
//
// So per-request auth must avoid the component entirely. The client passes its
// betterAuth session token (an unforgeable secret) as the `sessionToken` arg;
// we resolve it via the `authSessions` mirror table (a plain indexed lookup,
// no adapter.js). The mirror is populated once per login by
// authMirror.bootstrap, which is the only place that touches the component.
// The session token replaces the old forgeable `userEmail` param.
// ---------------------------------------------------------------------------

// Resolve a betterAuth session token → email via the lightweight mirror.
async function emailFromSessionToken(
  ctx: QueryCtx | MutationCtx,
  sessionToken?: string,
): Promise<string | null> {
  if (!sessionToken) return null;
  const mirror = await ctx.db
    .query("authSessions")
    .withIndex("by_token", (q) => q.eq("token", sessionToken))
    .first();
  if (!mirror) return null;
  if (mirror.expiresAt < Date.now()) return null;
  return mirror.email;
}

// For QUERIES: resolve the caller's app user, or null when unauthenticated /
// not bootstrapped yet (caller returns [] / null / 0).
export async function getOptionalAuth(
  ctx: QueryCtx | MutationCtx,
  sessionToken?: string,
): Promise<Doc<"users"> | null> {
  const email = await emailFromSessionToken(ctx, sessionToken);
  if (!email) return null;
  return ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

// For MUTATIONS: require a valid session. The app-user row is provisioned by
// authMirror.bootstrap, but provision here too as a safety net.
export async function requireAuth(
  ctx: MutationCtx,
  sessionToken?: string,
): Promise<Doc<"users">> {
  const email = await emailFromSessionToken(ctx, sessionToken);
  if (!email) throw new Error("Unauthorized");

  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  if (existing) return existing;

  const now = Date.now();
  const id = await ctx.db.insert("users", {
    email,
    name: email.split("@")[0],
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  return (await ctx.db.get(id))!;
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
