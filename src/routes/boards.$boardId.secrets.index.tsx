import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useSession } from "@/lib/auth-client";
import { SecretsList } from "@/components/secrets";
import { NotificationBell } from "@/components/NotificationBell";
import { UserDropdown } from "@/components/UserDropdown";

export const Route = createFileRoute("/boards/$boardId/secrets/")({
  component: SecretsPage,
});

function SecretsPage() {
  const { boardId } = Route.useParams();
  const { userEmail, isLoading: userLoading, session } = useConvexUser();
  const { data: authSession } = useSession();

  const board = useQuery(api.boards.get, {
    boardId: boardId as Id<"boards">,
  });

  const currentUser = useQuery(api.users.me);

  const userName = currentUser?.name ?? authSession?.user?.name;
  const userImage = currentUser?.image ?? authSession?.user?.image;
  const userId = currentUser?.id ?? authSession?.user?.id;

  const isLoading = board === undefined || userLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <p className="text-dark-muted mb-4">Board not found</p>
        <Link to="/boards" className="btn-primary">
          Back to boards
        </Link>
      </div>
    );
  }

  // Check if user can manage secrets (admin or owner)
  const canManage = board.userRole === "admin" || board.userRole === "owner";

  return (
    <div className="h-screen flex flex-col -mt-topbar">
      {/* Top bar */}
      <div className="h-topbar pt-safe flex items-center justify-between px-4 border-b border-dark-border bg-dark-bg sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            to="/boards/$boardId"
            params={{ boardId }}
            className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-hover transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{board.name}</h1>
            <span className="text-dark-muted">/</span>
            <span className="text-lg text-dark-muted">Secrets</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <UserDropdown
            userName={userName}
            userEmail={userEmail}
            userImage={userImage ?? undefined}
            userId={userId}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          <SecretsList
            boardId={boardId as Id<"boards">}
            canManage={canManage}
          />
        </div>
      </div>
    </div>
  );
}
