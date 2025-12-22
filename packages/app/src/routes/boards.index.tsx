import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export const Route = createFileRoute("/boards/")({
  component: BoardsPage,
});

function BoardsPage() {
  const { data: session, isPending: sessionLoading } = useSession();
  const [showCreate, setShowCreate] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  // Real-time subscription to boards
  const boards = useQuery(api.boards.list);

  // Mutations
  const createBoard = useMutation(api.boards.create);
  const deleteBoard = useMutation(api.boards.remove);

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBoardName.trim()) {
      await createBoard({ name: newBoardName.trim() });
      setShowCreate(false);
      setNewBoardName("");
    }
  };

  const handleDelete = async (boardId: Id<"boards">) => {
    if (confirm("Delete this board?")) {
      await deleteBoard({ boardId });
    }
  };

  const isLoading = boards === undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Boards</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          + New Board
        </button>
      </div>

      {showCreate && (
        <div className="card mb-6">
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Board name"
              className="input flex-1"
              autoFocus
            />
            <button type="submit" className="btn-primary">
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewBoardName("");
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-dark-border rounded w-3/4 mb-2" />
              <div className="h-4 bg-dark-border rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-dark-muted mb-4">
            No boards yet. Create your first board to get started!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <Link
              key={board._id}
              to="/boards/$boardId"
              params={{ boardId: board._id }}
              className="card hover:border-accent/50 transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold group-hover:text-accent transition-colors">
                    {board.name}
                  </h2>
                  {board.description && (
                    <p className="text-dark-muted text-sm mt-1">
                      {board.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(board._id);
                  }}
                  className="text-dark-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
              <p className="text-dark-muted text-xs mt-3">
                {board.columnCount || 0} columns
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
