import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { useSession } from "@/lib/auth-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { NotificationToast } from "@/components/NotificationToast";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { AssistantRoot } from "@/components/assistant/AssistantRoot";

export const Route = createRootRoute({
  component: RootLayout,
});

// Module-level latch: survives re-renders and brief unmounts.
// Once Convex authenticates, don't re-block on temporary disconnects.
let convexEverAuthenticated = false;

function RootLayout() {
  const { data: session, isPending } = useSession();
  const { isLoading: convexAuthLoading, isAuthenticated: convexAuthenticated } = useConvexAuth();
  if (convexAuthenticated) convexEverAuthenticated = true;

  const spinner = (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );

  // Wait for better-auth to resolve
  if (isPending) return spinner;

  // Authenticated: wait for initial Convex auth token — but don't re-block
  // after brief disconnects once we've already been authenticated.
  if (session) {
    if (!convexEverAuthenticated && (convexAuthLoading || !convexAuthenticated)) return spinner;
    return (
      <AssistantProvider>
        <AppLayout>
          <Outlet />
          <NotificationToast />
        </AppLayout>
        <AssistantRoot />
      </AssistantProvider>
    );
  }

  // Not authenticated: Simple layout for login/register
  return (
    <div className="min-h-screen bg-dark-bg">
      <Outlet />
    </div>
  );
}
