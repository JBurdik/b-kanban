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

function RootLayout() {
  const { data: session, isPending } = useSession();
  const { isLoading: convexAuthLoading, isAuthenticated: convexAuthenticated } = useConvexAuth();

  const spinner = (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );

  // Wait for better-auth to resolve
  if (isPending) return spinner;

  // Authenticated: wait for Convex auth token to propagate before rendering
  // queries so they don't fire without a valid token
  if (session) {
    if (convexAuthLoading || !convexAuthenticated) return spinner;
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
