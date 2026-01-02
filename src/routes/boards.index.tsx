import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { useConvexUser } from "@/hooks/useConvexUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import type { Priority } from "@/lib/types";
import { TimeTrackerWidget } from "@/components/timetracking";

export const Route = createFileRoute("/boards/")({
  component: BoardsPage,
});

function BoardsPage() {
  const { userEmail, isLoading: userLoading, session } = useConvexUser();
  const [showCreate, setShowCreate] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");

  // Real-time subscription to boards (skip if not authenticated)
  const boards = useQuery(api.boards.list, userEmail ? { userEmail } : "skip");

  // Get user's tasks across all boards for dashboard
  const myTasksData = useQuery(
    api.cards.getMyTasks,
    userEmail ? { userEmail, limit: 5 } : "skip"
  );

  // Mutations
  const createBoard = useMutation(api.boards.create);
  const deleteBoard = useMutation(api.boards.remove);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] lg:h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newBoardName.trim() && userEmail) {
      await createBoard({ name: newBoardName.trim(), userEmail });
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
        <h1 className="text-2xl font-bold">Dashboard</h1>
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

      {/* Dashboard Section */}
      {myTasksData && (
        <div className="mb-8">
          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <p className="text-dark-muted text-sm">Total Tasks</p>
                  <p className="text-2xl font-bold">{myTasksData.stats.total}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-dark-muted text-sm">My Tasks</p>
                  <p className="text-2xl font-bold">{myTasksData.stats.myTasks}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-dark-muted text-sm">Unassigned</p>
                  <p className="text-2xl font-bold">{myTasksData.stats.unassigned}</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <p className="text-dark-muted text-sm">High Priority</p>
                  <p className="text-2xl font-bold">{myTasksData.stats.highPriority}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Time Tracker Widget */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Time Today</h3>
              <Link to="/time" className="text-xs text-accent hover:text-accent/80">
                View all
              </Link>
            </div>
            <TimeTrackerWidget userEmail={userEmail!} />
          </div>

          {/* Recent Tasks */}
          {myTasksData.tasks.length > 0 && (
            <div className="card">
              <h3 className="font-semibold mb-4">My Recent Tasks</h3>
              <div className="space-y-3">
                {myTasksData.tasks.map((task) => (
                  <Link
                    key={task._id}
                    to="/boards/$boardId"
                    params={{ boardId: task.boardId }}
                    className="flex items-center justify-between p-3 rounded-lg bg-dark-bg hover:bg-dark-hover transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-dark-muted shrink-0">
                        {task.slug}
                      </span>
                      <span className="truncate group-hover:text-accent transition-colors">
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-dark-muted hidden sm:block">
                        {task.columnName}
                      </span>
                      <PriorityBadge priority={task.priority as Priority} />
                      {task.dueDate && (
                        <span className={`text-xs ${
                          task.dueDate < Date.now() ? 'text-red-400' : 'text-dark-muted'
                        }`}>
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Boards Section Header */}
      <h2 className="text-lg font-semibold mb-4">Your Boards</h2>

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
          {boards.filter((b): b is NonNullable<typeof b> => b !== null).map((board) => (
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
