import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession } from "@/lib/auth-client";
import { Logo } from "@/components/ui/Logo";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <LoadingSpinner fullScreen />;
  }

  if (session) {
    return <Navigate to="/boards" />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] px-4">
      <Logo size="xl" className="mb-6" />
      <p className="text-dark-muted text-lg mb-8 text-center max-w-md">
        A modern, minimalistic kanban board for productive teams.
      </p>
      <div className="flex gap-4">
        <a href="/login" className="btn-primary">
          Get Started
        </a>
      </div>
    </div>
  );
}
