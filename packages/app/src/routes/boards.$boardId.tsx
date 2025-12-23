import { useState } from "react";
import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { useConvexUser } from "@/hooks/useConvexUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { BoardMembers } from "@/components/BoardMembers";

export const Route = createFileRoute("/boards/$boardId")({
  component: BoardPage,
});

function BoardPage() {
  const { boardId } = Route.useParams();
  const { userEmail, isLoading: userLoading, session } = useConvexUser();
  const [showMembers, setShowMembers] = useState(false);

  // Real-time subscription to board data
  const board = useQuery(api.boards.get, {
    boardId: boardId as Id<"boards">,
    userEmail,
  });

  // Mutation for updating board name
  const updateBoard = useMutation(api.boards.update);

  const isLoading = board === undefined;

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-dark-muted mb-4">Board not found</p>
        <Link to="/boards" className="btn-primary">
          Back to boards
        </Link>
      </div>
    );
  }

  const isOwner = board.userRole === "owner";

  // Transform members data for the component
  const membersForModal =
    board.members?.map((m) => ({
      id: m.id,
      role: m.role,
      userId: m.userId,
      userName: m.user?.name || "Unknown",
      userEmail: m.user?.email || "",
    })) || [];

  const handleUpdateName = async (name: string) => {
    await updateBoard({
      boardId: boardId as Id<"boards">,
      name,
    });
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Board header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
        <div className="flex items-center gap-4">
          <Link to="/boards" className="text-dark-muted hover:text-dark-text">
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
          {isOwner ? (
            <input
              type="text"
              defaultValue={board.name}
              onBlur={(e) => {
                if (e.target.value !== board.name) {
                  handleUpdateName(e.target.value);
                }
              }}
              className="bg-transparent border-none text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 -mx-2"
            />
          ) : (
            <h1 className="text-lg font-semibold">{board.name}</h1>
          )}
          {board.userRole && board.userRole !== "owner" && (
            <span className="text-xs px-2 py-1 bg-dark-surface text-dark-muted rounded">
              {board.userRole === "admin" ? "Admin" : "Member"}
            </span>
          )}
        </div>

        {/* Members button */}
        <button
          onClick={() => setShowMembers(true)}
          className="flex items-center gap-2 text-dark-muted hover:text-dark-text transition-colors"
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <span className="text-sm">{board.members?.length || 0} members</span>
        </button>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard board={board} userEmail={userEmail} />
      </div>

      {/* Members modal */}
      {showMembers && (
        <BoardMembers
          boardId={boardId as Id<"boards">}
          members={membersForModal}
          userRole={board.userRole}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>
  );
}
