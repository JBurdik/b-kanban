import { useState, useMemo, useCallback, useEffect } from "react";
import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useSession } from "@/lib/auth-client";
import { useCardOpenMode } from "@/hooks/useCardOpenMode";
import { useBoardFilters } from "@/hooks/useBoardFilters";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useBulkSelect } from "@/hooks/useBulkSelect";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { Card } from "@/lib/types";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TableView } from "@/components/kanban/TableView";
import { BoardMembers } from "@/components/BoardMembers";
import { FilterBar } from "@/components/kanban/FilterBar";
import { SpotlightSearch } from "@/components/kanban/SpotlightSearch";
import { VersionFilter } from "@/components/kanban/VersionFilter";
import { CardSlidePanel } from "@/components/kanban/CardSlidePanel";
import { LabelManager } from "@/components/labels/LabelManager";
import { VersionManager } from "@/components/VersionManager";
import { NotificationBell } from "@/components/NotificationBell";
import { useRegisterAssistantBoard } from "@/contexts/AssistantContext";
import { PresenceBar } from "@/components/kanban/PresenceBar";
import { UserDropdown } from "@/components/UserDropdown";
import { usePresence } from "@/hooks/usePresence";
import { BoardIcon } from "@/components/BoardIcon";
import { BoardIconPicker } from "@/components/BoardIconPicker";
import { BoardBadge, BoardBadgeEditor } from "@/components/BoardBadge";
import { BulkActionBar } from "@/components/kanban/BulkActionBar";
import { MobileBoardBar } from "@/components/kanban/MobileBoardBar";

export const Route = createFileRoute("/boards/$boardId/")({
  component: BoardPage,
});

function BoardPage() {
  const { boardId } = Route.useParams();
  const { userEmail, isLoading: userLoading, session } = useConvexUser();
  const { data: authSession } = useSession();
  const { mode: cardOpenMode } = useCardOpenMode();
  const { filter, setFilter, viewMode, setViewMode, selectedVersionId, setSelectedVersionId, searchQuery, setSearchQuery } = useBoardFilters(boardId);
  const [showMembers, setShowMembers] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showBadgeEditor, setShowBadgeEditor] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showVersionManager, setShowVersionManager] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [searchToken, setSearchToken] = useState(0);

  // Bulk selection
  const {
    selectedCardIds,
    selectedCount,
    isSelectionMode,
    toggleCard,
    clearSelection,
    isSelected,
  } = useBulkSelect();

  // Escape key clears bulk selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isSelectionMode) {
        clearSelection();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSelectionMode, clearSelection]);

  // Real-time subscription to board data
  const board = useQuery(api.boards.get, {
    boardId: boardId as Id<"boards">,
    userEmail,
  });

  // Get versions for this board
  const boardVersions = useQuery(api.versions.list, {
    boardId: boardId as Id<"boards">,
    userEmail,
  });

  // Get current user for filtering and display
  const currentUser = useQuery(
    api.users.getByEmail,
    userEmail ? { email: userEmail } : "skip"
  );

  // User display info
  const userName = currentUser?.name ?? authSession?.user?.name;
  const userImage = currentUser?.image ?? authSession?.user?.image;
  const userId = currentUser?.id ?? authSession?.user?.id;

  // Real-time presence tracking
  const { onlineUsers } = usePresence(
    boardId as Id<"boards">,
    selectedCard?._id
  );

  // Mutation for updating board name
  const updateBoard = useMutation(api.boards.update);

  // Register board context with the Codex assistant (desktop panel).
  const assistantBoard = useMemo(
    () =>
      board
        ? {
            name: board.name,
            columns: (board.columns ?? []).map((col) => ({
              _id: col._id as string,
              name: col.name,
              cards: col.cards.map((c) => ({
                _id: c._id as string,
                slug: c.slug,
                title: c.title,
              })),
            })),
          }
        : null,
    [board]
  );
  useRegisterAssistantBoard(assistantBoard, userEmail);

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

  // Archive card handler for keyboard shortcut
  const archiveCard = useMutation(api.cards.remove);
  const handleCardArchive = useCallback(
    (card: Card) => {
      archiveCard({ cardId: card._id });
    },
    [archiveCard]
  );

  // New card handler for keyboard shortcut — triggers click on the "+ Add card" button
  // by finding the column element and programmatically clicking
  const createCard = useMutation(api.cards.create);
  const handleNewCard = useCallback(
    async (columnId: Id<"columns">) => {
      await createCard({
        columnId,
        title: "Untitled",
        position: 0,
        userEmail,
      });
    },
    [createCard, userEmail]
  );

  // Mobile bottom-bar add-card: create with a real title at top of chosen column.
  const handleMobileCreateCard = useCallback(
    async (columnId: Id<"columns">, title: string) => {
      await createCard({ columnId, title, position: 0, userEmail });
    },
    [createCard, userEmail]
  );

  // Keyboard navigation for board
  const { focusedCardId } = useKeyboardNavigation({
    columns: board?.columns || [],
    onCardOpen: handleCardClick,
    onCardEdit: handleCardDoubleClick,
    onCardArchive: handleCardArchive,
    onNewCard: handleNewCard,
    enabled: !selectedCard && viewMode === "board",
  });

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

  const canEditBoardName = board.userRole === "owner" || board.userRole === "admin";

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
    if (!userEmail) return;
    await updateBoard({
      boardId: boardId as Id<"boards">,
      name,
      userEmail,
    });
  };

  return (
    <div className="h-screen flex flex-col -mt-topbar">
      {/* Top bar with board name - replaces global top bar for this page */}
      <div className="pt-safe border-b border-dark-border bg-dark-bg sticky top-0 z-30">
        <div className="h-14 flex items-center justify-between gap-2 px-3 sm:px-4">
        {/* Left: Back + Board icon + Board name */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <Link to="/boards" className="p-1.5 rounded-lg text-dark-muted hover:text-dark-text hover:bg-dark-hover transition-colors">
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

          {/* Board icon with picker for owners/admins */}
          <div className="relative">
            <button
              onClick={() => {
                if (board.userRole === "owner" || board.userRole === "admin") {
                  setShowIconPicker(!showIconPicker);
                }
              }}
              className={`p-1 rounded ${
                board.userRole === "owner" || board.userRole === "admin"
                  ? "hover:bg-dark-hover cursor-pointer"
                  : ""
              }`}
              title={
                board.userRole === "owner" || board.userRole === "admin"
                  ? "Change board icon"
                  : undefined
              }
            >
              <BoardIcon
                board={{
                  name: board.name,
                  iconType: board.iconType,
                  iconEmoji: board.iconEmoji,
                  iconUrl: board.iconUrl,
                }}
                size="md"
              />
            </button>
            {showIconPicker && (
              <BoardIconPicker
                boardId={boardId as Id<"boards">}
                boardName={board.name}
                currentIcon={{
                  type: board.iconType,
                  emoji: board.iconEmoji,
                  url: board.iconUrl,
                }}
                onClose={() => setShowIconPicker(false)}
              />
            )}
          </div>

          {canEditBoardName ? (
            <input
              type="text"
              defaultValue={board.name}
              onBlur={(e) => {
                if (e.target.value !== board.name) {
                  handleUpdateName(e.target.value);
                }
              }}
              className="bg-transparent border-none text-base sm:text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 -mx-2 min-w-0 max-w-full truncate [field-sizing:content]"
            />
          ) : (
            <h1 className="text-base sm:text-lg font-semibold truncate min-w-0">
              {board.name}
            </h1>
          )}
          {/* Configurable board badge (owners/admins can edit) */}
          {board.userRole === "owner" || board.userRole === "admin" ? (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowBadgeEditor(!showBadgeEditor)}
                title="Edit board badge"
                className="flex items-center rounded hover:opacity-80 transition-opacity"
              >
                {board.badgeText ? (
                  <BoardBadge text={board.badgeText} color={board.badgeColor} />
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full border border-dashed border-dark-border text-dark-muted hover:text-dark-text">
                    + Badge
                  </span>
                )}
              </button>
              {showBadgeEditor && (
                <BoardBadgeEditor
                  boardId={boardId as Id<"boards">}
                  currentText={board.badgeText}
                  currentColor={board.badgeColor}
                  onClose={() => setShowBadgeEditor(false)}
                />
              )}
            </div>
          ) : (
            <BoardBadge text={board.badgeText} color={board.badgeColor} />
          )}

          {board.userRole && board.userRole !== "owner" && (
            <span className="hidden sm:inline-block flex-shrink-0 text-xs px-2 py-1 bg-dark-surface text-dark-muted rounded">
              {board.userRole === "admin" ? "Admin" : "Member"}
            </span>
          )}
        </div>

        {/* Right: Notifications + User */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <div className="hidden sm:block">
            <PresenceBar
              onlineUsers={onlineUsers}
              currentUserId={currentUser?.id}
            />
          </div>
          <NotificationBell userEmail={userEmail} />
          <UserDropdown
            userName={userName}
            userEmail={userEmail}
            userImage={userImage ?? undefined}
            userId={userId}
          />
        </div>
        </div>
      </div>

      {/* Secondary toolbar: View toggle, Filters, Members (desktop only — mobile uses bottom bar) */}
      <div className="hidden sm:flex items-center gap-3 px-3 sm:px-4 py-2 border-b border-dark-border bg-dark-surface/50 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* View toggle */}
          <div className="flex items-center bg-dark-bg rounded-lg p-1 border border-dark-border">
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === "board"
                  ? "bg-accent text-white shadow-sm"
                  : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
              }`}
            >
              <svg
                className="w-4 h-4"
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
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-accent text-white shadow-sm"
                  : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
              }`}
            >
              <svg
                className="w-4 h-4"
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

          {/* Version filter */}
          {boardVersions && boardVersions.length > 0 && (
            <VersionFilter
              versions={boardVersions}
              selectedVersionId={selectedVersionId}
              onChange={setSelectedVersionId}
            />
          )}

          {/* Spotlight search */}
          <SpotlightSearch
            columns={board.columns || []}
            onCardClick={handleCardClick}
            onSearchChange={setSearchQuery}
            searchQuery={searchQuery}
            versions={boardVersions || []}
            selectedVersionId={selectedVersionId}
            onVersionChange={setSelectedVersionId}
            currentFilter={filter}
            onFilterChange={setFilter}
            onOpenLabelManager={(board.userRole === "owner" || board.userRole === "admin") ? () => setShowLabelManager(true) : undefined}
            onOpenVersionManager={(board.userRole === "owner" || board.userRole === "admin") ? () => setShowVersionManager(true) : undefined}
            openToken={searchToken}
          />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Labels button (for admin/owner) */}
          {(board.userRole === "owner" || board.userRole === "admin") && (
            <button
              onClick={() => setShowLabelManager(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <span className="text-sm">Labels</span>
            </button>
          )}

          {/* Versions button (for admin/owner) */}
          {(board.userRole === "owner" || board.userRole === "admin") && (
            <button
              onClick={() => setShowVersionManager(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              <span className="text-sm">Versions</span>
            </button>
          )}

          {/* Secrets link */}
          <Link
            to="/boards/$boardId/secrets"
            params={{ boardId }}
            className="flex items-center gap-2 px-3 py-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
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
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            <span className="text-sm">Secrets</span>
          </Link>

          {/* Members button */}
          <button
            onClick={() => setShowMembers(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
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
      <div className="flex-1 overflow-hidden pb-bottombar sm:pb-0">
        {viewMode === "board" ? (
          <KanbanBoard
            board={board}
            filter={filter}
            searchQuery={searchQuery}
            currentUserId={currentUser?.id}
            userEmail={userEmail}
            versionFilter={selectedVersionId}
            onCardClick={handleCardClick}
            onCardDoubleClick={handleCardDoubleClick}
            focusedCardId={focusedCardId}
            isSelected={isSelected}
            onSelectionToggle={toggleCard}
          />
        ) : (
          <TableView
            board={board}
            filter={filter}
            searchQuery={searchQuery}
            currentUserId={currentUser?.id}
            versionFilter={selectedVersionId}
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
          defaultExpanded={cardOpenMode === "fullscreen"}
          onClose={handleClosePanel}
        />
      )}

      {/* Label manager modal */}
      {showLabelManager && (
        <LabelManager
          boardId={boardId as Id<"boards">}
          userEmail={userEmail}
          onClose={() => setShowLabelManager(false)}
        />
      )}

      {/* Version manager modal */}
      {showVersionManager && (
        <VersionManager
          boardId={boardId as Id<"boards">}
          userEmail={userEmail}
          onClose={() => setShowVersionManager(false)}
        />
      )}

      {/* Bulk action bar */}
      {isSelectionMode && (
        <BulkActionBar
          selectedCardIds={selectedCardIds}
          selectedCount={selectedCount}
          onClearSelection={clearSelection}
          boardId={boardId as Id<"boards">}
        />
      )}

      {/* Mobile bottom tab bar */}
      <MobileBoardBar
        boardId={boardId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filter={filter}
        onFilterChange={setFilter}
        taskCounts={taskCounts}
        versions={boardVersions || []}
        selectedVersionId={selectedVersionId}
        onVersionChange={setSelectedVersionId}
        columns={board.columns || []}
        onCreateCard={handleMobileCreateCard}
        onSearch={() => setSearchToken((t) => t + 1)}
        canEdit={board.userRole === "owner" || board.userRole === "admin" || board.userRole === "member"}
        canManage={board.userRole === "owner" || board.userRole === "admin"}
        memberCount={board.members?.length || 0}
        onOpenLabels={() => setShowLabelManager(true)}
        onOpenVersions={() => setShowVersionManager(true)}
        onOpenMembers={() => setShowMembers(true)}
      />
    </div>
  );
}
