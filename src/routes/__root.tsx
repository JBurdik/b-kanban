import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useSession } from "@/lib/auth-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { NotificationToast } from "@/components/NotificationToast";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { AssistantRoot } from "@/components/assistant/AssistantRoot";
import { useBootstrapSession } from "@/hooks/useBootstrapSession";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { data: session, isPending } = useSession();
  // Populate the server-side session mirror so Convex auth can resolve us.
  useBootstrapSession();

  // Show loading state
  if (isPending) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  // Authenticated: Use sidebar layout
  if (session) {
    return (
      <AssistantProvider>
        <AppLayout>
          <Outlet />
          <NotificationToast userEmail={session.user.email} />
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
