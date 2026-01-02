import { useState, useMemo, useCallback } from "react";
import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { useConvexUser } from "@/hooks/useConvexUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { Card } from "@/lib/types";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TableView } from "@/components/kanban/TableView";
import { BoardMembers } from "@/components/BoardMembers";
import { FilterBar, type FilterOption } from "@/components/kanban/FilterBar";
import { CardSlidePanel } from "@/components/kanban/CardSlidePanel";

type ViewMode = "board" | "table";

export const Route = createFileRoute("/boards/$boardId/")({
  component: BoardPage,
});

function BoardPage() {
  const { boardId } = Route.useParams();
  const { userEmail, isLoading: userLoading, session } = useConvexUser();
  const [showMembers, setShowMembers] = useState(false);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [editMode, setEditMode] = useState(false);

  // Real-time subscription to board data
  const board = useQuery(api.boards.get, {
    boardId: boardId as Id<"boards">,
    userEmail,
  });

  // Get current user for filtering
  const currentUser = useQuery(
    api.users.getByEmail,
    userEmail ? { email: userEmail } : "skip"
  );

  // Mutation for updating board name
  const updateBoard = useMutation(api.boards.update);

  const isLoading = board === undefined;

  // Calculate task counts for filter bar
  const taskCounts = useMemo(() => {
    if (!board?.columns) return { all: 0, myTasks: 0, unassigned: 0 };

    let all = 0;
    let myTasks = 0;
    let unassigned = 0;

    board.columns.forEach((column) => {
      column.cards.forEach((card) => {
        all++;
        if (card.assignee?.id === currentUser?.id) {
          myTasks++;
        }
        if (!card.assignee) {
          unassigned++;
        }
      });
    });

    return { all, myTasks, unassigned };
  }, [board?.columns, currentUser?.id]);

  // Card click handlers - must be before early returns
  const handleCardClick = useCallback((card: Card) => {
    setSelectedCard(card);
    setEditMode(false);
  }, []);

  const handleCardDoubleClick = useCallback((card: Card) => {
    setSelectedCard(card);
    setEditMode(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedCard(null);
    setEditMode(false);
  }, []);

  // Find the full card data with column info for the slide panel
  const selectedCardWithColumn = useMemo(() => {
    if (!selectedCard || !board?.columns) return null;

    for (const column of board.columns) {
      const card = column.cards.find((c) => c._id === selectedCard._id);
      if (card) {
        return {
          ...card,
          column: {
            id: column._id,
            name: column.name,
          },
        };
      }
    }
    return null;
  }, [selectedCard, board?.columns]);

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen lg:h-screen">
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
    <div className="h-[calc(100vh-3.5rem)] lg:h-screen flex flex-col">
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

        <div className="flex items-center gap-4">
          {/* View toggle */}
          <div className="flex items-center bg-dark-bg rounded-lg p-1 border border-dark-border">
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === "board"
                  ? "bg-accent text-white shadow-sm"
                  : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
              }`}
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
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-accent text-white shadow-sm"
                  : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
              }`}
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
                  d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          {/* Filter bar */}
          <FilterBar
            currentFilter={filter}
            onFilterChange={setFilter}
            taskCounts={taskCounts}
          />

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
      </div>

      {/* Board content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "board" ? (
          <KanbanBoard
            board={board}
            filter={filter}
            currentUserId={currentUser?.id}
            onCardClick={handleCardClick}
            onCardDoubleClick={handleCardDoubleClick}
          />
        ) : (
          <TableView
            board={board}
            filter={filter}
            currentUserId={currentUser?.id}
            onCardClick={handleCardClick}
            onCardDoubleClick={handleCardDoubleClick}
          />
        )}
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

      {/* Card slide panel */}
      {selectedCardWithColumn && (
        <CardSlidePanel
          card={selectedCardWithColumn}
          board={board}
          userEmail={userEmail}
          editMode={editMode}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
