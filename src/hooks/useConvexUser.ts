import { useSession } from "@/lib/auth-client";
import { useConvexAuth } from "convex/react";

/**
 * Hook to get the current user info from session
 * Uses useConvexAuth to check if auth is ready
 */
export function useConvexUser() {
  const { data: session, isPending: sessionLoading } = useSession();
  const { isLoading: authLoading } = useConvexAuth();

  // The user ID from session needs to be looked up via the users table
  // For now, we'll use email as the identifier and let queries handle the lookup
  const user = session?.user;

  return {
    // Pass email to queries that need to look up user
    userEmail: user?.email,
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
