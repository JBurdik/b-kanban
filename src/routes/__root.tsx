import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { NotificationToast } from "@/components/NotificationToast";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { AssistantRoot } from "@/components/assistant/AssistantRoot";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isLoading, isAuthenticated } = useConvexAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  // Authenticated: Use sidebar layout
  if (isAuthenticated) {
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
