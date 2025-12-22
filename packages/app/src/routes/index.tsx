import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/boards" />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] px-4">
      <h1 className="text-4xl font-bold mb-4">Welcome to B-Kanban</h1>
      <p className="text-dark-muted text-lg mb-8 text-center max-w-md">
        A simple, minimalistic project planner with kanban boards.
      </p>
      <div className="flex gap-4">
        <a href="/login" className="btn-primary">
          Get Started
        </a>
      </div>
    </div>
  );
}
