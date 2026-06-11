import { useConvexAuth, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

/**
 * Current user via Convex Auth. Replaces the old better-auth useSession-based hook.
 *
 * `sessionToken` is kept (always undefined) only so existing callsites that still
 * pass it keep compiling during the migration sweep — the backend ignores it and
 * authenticates via the JWT (getAuthUserId). It will be removed in a follow-up.
 */
export function useConvexUser() {
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");

  const user = viewer
    ? {
        id: viewer.id,
        name: viewer.name,
        email: viewer.email,
        image: viewer.image ?? undefined,
        createdAt: viewer.createdAt,
      }
    : null;

  // `session` shim: truthy when authenticated, exposes `.user` like before.
  const session = isAuthenticated && user ? { user } : null;

  return {
    userEmail: user?.email,
    sessionToken: undefined as string | undefined,
    user,
    isLoading: authLoading || (isAuthenticated && viewer === undefined),
    session,
  };
}
