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
import clsx from "clsx";

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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-dark-surface border-l border-dark-border shadow-2xl z-50 flex flex-col animate-slide-in-right">
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
              />
            </>
          ) : (
            <div
              className="flex-1 overflow-y-auto p-6 cursor-pointer"
              onDoubleClick={() => canEdit && setIsEditing(true)}
            >
              {/* Read-only view */}
              <h1 className="text-2xl font-semibold mb-4">{card.title}</h1>

              {/* Status bar */}
              <div className="flex flex-wrap gap-4 mb-6 text-sm">
                <div>
                  <span className="text-dark-muted">Status: </span>
                  <span className="text-dark-text">{card.column.name}</span>
                </div>
                {card.assignee && (
                  <div>
                    <span className="text-dark-muted">Assignee: </span>
                    <span className="text-dark-text">{card.assignee.name}</span>
                  </div>
                )}
                {card.effort && (
                  <div>
                    <span className="text-dark-muted">Effort: </span>
                    <span className="text-dark-text">{card.effort}h</span>
                  </div>
                )}
              </div>

              {/* Description */}
              {card.content ? (
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3">
                    Description
                  </h2>
                  <div
                    className="rich-content prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: card.content }}
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
          )}
        </div>
      </div>
    </>
  );
}
