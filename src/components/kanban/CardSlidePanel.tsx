import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useAutoSave } from "@/hooks/useAutoSave";
import { canEdit as checkCanEdit } from "@/lib/permissions";
import type {
  Card,
  Column,
  BoardMember,
  BoardRole,
  Priority,
} from "@/lib/types";
import { CardContent } from "./CardContent";
import { CardSidebar } from "./CardSidebar";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Avatar } from "@/components/Avatar";

interface CardWithColumn extends Card {
  column: {
    id: Id<"columns">;
    name: string;
  };
}

interface Board {
  _id: Id<"boards">;
  name: string;
  columns?: Column[];
  members?: BoardMember[];
  userRole?: BoardRole;
}

interface Props {
  card: CardWithColumn;
  board: Board;
  userEmail?: string;
  editMode?: boolean;
  onClose: () => void;
}

interface CardData {
  title: string;
  content: string;
  priority: Priority;
  columnId: Id<"columns">;
  assigneeId?: Id<"users">;
  effort?: number;
}

export function CardSlidePanel({
  card,
  board,
  userEmail,
  editMode = false,
  onClose,
}: Props) {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content || "");
  const [priority, setPriority] = useState(card.priority);
  const [columnId, setColumnId] = useState(card.columnId);
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | undefined>(
    card.assignee?.id
  );
  const [effort, setEffort] = useState<number | undefined>(card.effort);
  const [isEditing, setIsEditing] = useState(editMode);
  const [isExpanded, setIsExpanded] = useState(false);

  const updateCard = useMutation(api.cards.update);
  const searchMembers = useQuery(api.members.search, {
    boardId: board._id,
    query: "",
  });

  const canEdit = checkCanEdit(board.userRole);
  const columns = board.columns || [];
  const members = board.members || [];

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Use auto-save hook
  const handleSave = useCallback(
    async (data: CardData) => {
      await updateCard({
        cardId: card._id,
        title: data.title,
        content: data.content,
        priority: data.priority,
        columnId: data.columnId,
        assigneeId: data.assigneeId,
        effort: data.effort,
        currentUserEmail: userEmail,
      });
    },
    [card._id, updateCard, userEmail]
  );

  const { isSaving } = useAutoSave({
    data: { title, content, priority, columnId, assigneeId, effort },
    originalData: {
      title: card.title,
      content: card.content || "",
      priority: card.priority,
      columnId: card.columnId,
      assigneeId: card.assignee?.id,
      effort: card.effort,
    },
    onSave: handleSave,
  });

  // Mention search callback
  const handleMentionSearch = useCallback(
    async (query: string) => {
      const allMembers = searchMembers || [];
      const queryLower = query.toLowerCase();
      return allMembers
        .filter(
          (m) =>
            m.name.toLowerCase().includes(queryLower) ||
            m.email.toLowerCase().includes(queryLower)
        )
        .slice(0, 5);
    },
    [searchMembers]
  );

  // Get current assignee from members based on assigneeId state
  const currentAssignee = assigneeId
    ? members.find((m) => m.user?.id === assigneeId)?.user || card.assignee
    : card.assignee;

  // Get current column name
  const currentColumnName =
    columns.find((c) => c._id === columnId)?.name || card.column.name;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed bg-dark-surface border-l border-dark-border shadow-2xl z-50 flex flex-col animate-slide-in-right transition-all duration-300 ${
          isExpanded
            ? "inset-4 rounded-xl border"
            : "inset-y-0 right-0 w-full max-w-2xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <span className="text-sm text-dark-muted font-mono">
              {card.slug}
            </span>
            <PriorityBadge priority={priority} size="sm" />
            {isSaving && (
              <span className="text-xs text-dark-muted animate-pulse">
                Saving...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-ghost text-sm"
              >
                Edit
              </button>
            )}
            {/* Expand/Collapse button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-dark-text transition-colors"
              title={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? (
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
                    d="M9 9L4 4m0 0v5m0-5h5m6 6l5 5m0 0v-5m0 5h-5"
                  />
                </svg>
              ) : (
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
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
                  />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-dark-text transition-colors"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {isEditing ? (
            <>
              <CardContent
                cardId={card._id}
                boardId={board._id}
                title={title}
                content={content}
                canEdit={true}
                userEmail={userEmail}
                onTitleChange={setTitle}
                onContentChange={setContent}
                onMentionSearch={handleMentionSearch}
              />
              <CardSidebar
                columnId={columnId}
                priority={priority}
                assigneeId={assigneeId}
                effort={effort}
                dueDate={card.dueDate}
                currentColumn={card.column}
                currentAssignee={card.assignee}
                columns={columns}
                members={members}
                canEdit={true}
                onColumnChange={setColumnId}
                onPriorityChange={setPriority}
                onAssigneeChange={setAssigneeId}
                onEffortChange={setEffort}
                cardId={card._id}
                cardTitle={title}
                userEmail={userEmail}
              />
            </>
          ) : (
            <div
              className={`flex-1 overflow-y-auto cursor-pointer ${
                isExpanded ? "flex" : ""
              }`}
              onDoubleClick={() => canEdit && setIsEditing(true)}
            >
              {/* Main content area */}
              <div className={`p-6 ${isExpanded ? "flex-1" : ""}`}>
                {/* Read-only view */}
                <h1 className="text-2xl font-semibold mb-4">{title}</h1>

                {/* Status bar - compact when not expanded */}
                {!isExpanded && (
                  <div className="flex flex-wrap gap-4 mb-6 text-sm">
                    <div>
                      <span className="text-dark-muted">Status: </span>
                      <span className="text-dark-text">{currentColumnName}</span>
                    </div>
                    {currentAssignee && (
                      <div>
                        <span className="text-dark-muted">Assignee: </span>
                        <span className="text-dark-text">
                          {currentAssignee.name}
                        </span>
                      </div>
                    )}
                    {effort && (
                      <div>
                        <span className="text-dark-muted">Effort: </span>
                        <span className="text-dark-text">{effort}h</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                {content ? (
                  <div className="mb-6">
                    <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3">
                      Description
                    </h2>
                    <div
                      className="rich-content prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  </div>
                ) : (
                  <p className="text-dark-muted text-sm italic mb-6">
                    No description. Double-click to add one.
                  </p>
                )}

                {canEdit && (
                  <p className="text-xs text-dark-muted italic">
                    Double-click anywhere to edit
                  </p>
                )}
              </div>

              {/* Side panel with details - only in expanded view */}
              {isExpanded && (
                <div className="w-80 border-l border-dark-border p-6 space-y-6 bg-dark-bg/50">
                  {/* Status */}
                  <div>
                    <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">
                      Status
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-dark-text">{currentColumnName}</span>
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">
                      Priority
                    </h3>
                    <PriorityBadge priority={priority} />
                  </div>

                  {/* Assignee */}
                  <div>
                    <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">
                      Assignee
                    </h3>
                    {currentAssignee ? (
                      <div className="flex items-center gap-3 p-3 bg-dark-surface rounded-lg">
                        <Avatar
                          name={currentAssignee.name}
                          id={currentAssignee.id}
                          imageUrl={currentAssignee.image}
                          size="md"
                        />
                        <div>
                          <p className="text-sm font-medium text-dark-text">
                            {currentAssignee.name}
                          </p>
                          <p className="text-xs text-dark-muted">
                            {currentAssignee.email}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-dark-muted italic">Unassigned</p>
                    )}
                  </div>

                  {/* Effort */}
                  <div>
                    <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">
                      Effort
                    </h3>
                    {effort ? (
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-dark-muted"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="text-dark-text">{effort} hours</span>
                      </div>
                    ) : (
                      <p className="text-sm text-dark-muted italic">Not estimated</p>
                    )}
                  </div>

                  {/* Due Date */}
                  {card.dueDate && (
                    <div>
                      <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">
                        Due Date
                      </h3>
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-dark-muted"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-dark-text">
                          {new Date(card.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Created info */}
                  <div className="pt-4 border-t border-dark-border">
                    <p className="text-xs text-dark-muted">
                      Card ID: {card.slug}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
