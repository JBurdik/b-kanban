import { useConvexUser } from "./useConvexUser";

interface UseRequireAuthReturn {
  /** User's email address */
  userEmail: string | undefined;
  /** User object with id, name, email, image */
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  } | null;
  /** Whether auth is still loading */
  isLoading: boolean;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Raw session object */
  session: unknown;
}

/**
 * Hook that provides authentication state for protected routes.
 * Wraps useConvexUser with additional isAuthenticated flag.
 *
 * @example
 * ```tsx
 * function ProtectedPage() {
 *   const { isLoading, isAuthenticated, user } = useRequireAuth();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isAuthenticated) return <Navigate to="/login" />;
 *
 *   return <div>Welcome, {user?.name}!</div>;
 * }
 * ```
 */
export function useRequireAuth(): UseRequireAuthReturn {
  const { userEmail, isLoading, session, user } = useConvexUser();

  return {
    userEmail,
    user,
    session,
    isLoading,
    isAuthenticated: !!session && !!userEmail,
  };
}
