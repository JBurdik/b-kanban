import { useSession } from "@/lib/auth-client";
import { useConvexAuth } from "convex/react";
import { useSessionToken } from "./useSessionToken";

/**
 * Hook to get the current user info from session
 * Uses useConvexAuth to check if auth is ready
 */
export function useConvexUser() {
  const { data: session, isPending: sessionLoading } = useSession();
  const { isLoading: authLoading } = useConvexAuth();
  const sessionToken = useSessionToken();

  const user = session?.user;

  return {
    // Pass email to queries that need to look up user
    userEmail: user?.email,
    // Secret session token to authenticate Convex queries/mutations server-side.
    sessionToken,
    user: user ? {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    } : null,
    isLoading: sessionLoading || authLoading,
    session,
  };
}
