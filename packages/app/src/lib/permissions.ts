import type { BoardRole } from "./types";

// ============================================================================
// Permission Helpers
// ============================================================================

/**
 * Check if a user can edit cards (members, admins, and owners)
 */
export function canEdit(role?: BoardRole): boolean {
  return role === "member" || role === "admin" || role === "owner";
}

/**
 * Check if a user can manage columns (admins and owners only)
 */
export function canManageColumns(role?: BoardRole): boolean {
  return role === "admin" || role === "owner";
}

/**
 * Check if a user can manage board members (admins and owners only)
 */
export function canManageMembers(role?: BoardRole): boolean {
  return role === "admin" || role === "owner";
}

/**
 * Check if a user is the board owner
 */
export function isOwner(role?: BoardRole): boolean {
  return role === "owner";
}

/**
 * Check if a user is an admin
 */
export function isAdmin(role?: BoardRole): boolean {
  return role === "admin";
}

/**
 * Check if a user is at least an admin (admin or owner)
 */
export function isAtLeastAdmin(role?: BoardRole): boolean {
  return role === "admin" || role === "owner";
}

/**
 * Check if a user has any role on the board
 */
export function hasAccess(role?: BoardRole): boolean {
  return role === "member" || role === "admin" || role === "owner";
}

// ============================================================================
// Role Comparison Helpers
// ============================================================================

const ROLE_HIERARCHY: Record<BoardRole, number> = {
  member: 1,
  admin: 2,
  owner: 3,
};

/**
 * Compare two roles and return true if roleA has higher or equal privileges than roleB
 */
export function hasHigherOrEqualRole(roleA?: BoardRole, roleB?: BoardRole): boolean {
  if (!roleA) return false;
  if (!roleB) return true;
  return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Get the highest role from an array of roles
 */
export function getHighestRole(roles: BoardRole[]): BoardRole | undefined {
  if (roles.length === 0) return undefined;
  return roles.reduce((highest, current) =>
    ROLE_HIERARCHY[current] > ROLE_HIERARCHY[highest] ? current : highest
  );
}
