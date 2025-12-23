import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { CardModal } from "./CardModal";
import { AttachmentList } from "./AttachmentList";
import { CommentList } from "./CommentList";
import { Avatar } from "@/components/Avatar";
import clsx from "clsx";

type BoardRole = "owner" | "admin" | "member";

interface Card {
  _id: Id<"cards">;
  columnId: Id<"columns">;
  slug: string;
  title: string;
  content?: string;
  position: number;
  priority: "low" | "medium" | "high";
  assignee?: {
    id: Id<"users">;
    name: string;
    email: string;
    image?: string;
  } | null;
  dueDate?: number;
  effort?: number;
}

interface Column {
  _id: Id<"columns">;
  boardId: Id<"boards">;
  name: string;
  position: number;
  cards: Card[];
}

interface BoardMember {
  id: Id<"boardMembers">;
  role: BoardRole;
  userId: Id<"users">;
  user: {
    id: Id<"users">;
    name: string;
    email: string;
    image?: string;
  } | null;
}

interface Props {
  card: Card;
  boardId: Id<"boards">;
  columns: Column[];
  members?: BoardMember[];
  userEmail?: string;
  userRole?: BoardRole;
  onClose: () => void;
}

const priorityConfig = {
  low: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-400" },
  high: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", dot: "bg-rose-400" },
};

export function CardViewModal({ card, boardId, columns, members = [], userEmail, userRole, onClose }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentColumnId, setCurrentColumnId] = useState(card.columnId);
  const [isUpdating, setIsUpdating] = useState(false);

  const canEdit = userRole === "member" || userRole === "admin" || userRole === "owner";
  const currentColumn = columns.find((c) => c._id === currentColumnId);

  const updateCard = useMutation(api.cards.update);

  const handleStatusChange = async (newColumnId: Id<"columns">) => {
    setCurrentColumnId(newColumnId);
    setIsUpdating(true);
    try {
      await updateCard({ cardId: card._id, columnId: newColumnId, currentUserEmail: userEmail });
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, isFullscreen, isEditing]);

  // If editing, show edit modal
  if (isEditing) {
    return (
      <CardModal
        card={card}
        boardId={boardId}
        columns={columns}
        members={members}
        userEmail={userEmail}
        onClose={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={clsx(
          "bg-dark-surface border border-dark-border rounded-lg flex flex-col",
          isFullscreen
            ? "w-full h-full max-w-none max-h-none m-0 rounded-none"
            : "w-full max-w-2xl max-h-[90vh]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-dark-border sticky top-0 bg-dark-surface z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-dark-muted font-mono bg-dark-bg px-2 py-0.5 rounded">
                {card.slug}
              </span>
              <span
                className={clsx(
                  "flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border",
                  priorityConfig[card.priority].bg,
                  priorityConfig[card.priority].text,
                  priorityConfig[card.priority].border
                )}
              >
                <span className={clsx("w-1.5 h-1.5 rounded-full", priorityConfig[card.priority].dot)} />
                {card.priority}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-white leading-tight">{card.title}</h2>
          </div>
          <div className="flex items-center gap-1 ml-4 flex-shrink-0">
            <Link
              to="/boards/$boardId/cards/$cardSlug"
              params={{ boardId, cardSlug: card.slug }}
              className="p-2 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
              title="Open in full page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0l5 0m-5 0l0 5m11-5l5 0m0 0l0 5m0-5l-5 5m-6 6l-5 5m0 0l5 0m-5 0l0-5m16 5l-5-5m5 5l0-5m0 5l-5 0" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              )}
            </button>
            {canEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-dark-text bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Metadata bar */}
          <div className="flex flex-wrap items-center gap-4 px-5 py-4 bg-dark-bg/50 border-b border-dark-border">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {canEdit ? (
                <select
                  value={currentColumnId}
                  onChange={(e) => handleStatusChange(e.target.value as Id<"columns">)}
                  disabled={isUpdating}
                  className="bg-transparent text-sm font-medium text-dark-text border-none focus:ring-0 cursor-pointer hover:text-accent transition-colors p-0 pr-6"
                >
                  {columns.map((col) => (
                    <option key={col._id} value={col._id} className="bg-dark-surface">
                      {col.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm font-medium">{currentColumn?.name || "Unknown"}</span>
              )}
            </div>

            {card.dueDate && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-dark-text">
                  {new Date(card.dueDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}

            {/* Assignee */}
            <div className="flex items-center gap-2 text-sm">
              {card.assignee ? (
                <>
                  <Avatar
                    name={card.assignee.name}
                    id={card.assignee.id}
                    size="sm"
                  />
                  <span className="text-dark-text">{card.assignee.name}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-dark-muted">Unassigned</span>
                </>
              )}
            </div>

            {/* Time Effort */}
            {card.effort !== undefined && card.effort > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-dark-text">{card.effort}h</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="p-5">
            {card.content ? (
              <div
                className="rich-content"
                dangerouslySetInnerHTML={{ __html: card.content }}
              />
            ) : (
              <p className="text-dark-muted text-sm italic py-4 text-center">No description added yet</p>
            )}
          </div>

          {/* Attachments */}
          <div className="px-5 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-sm font-medium text-dark-muted uppercase tracking-wide">Attachments</span>
            </div>
            <AttachmentList cardId={card._id} readOnly={!canEdit} />
          </div>

          {/* Comments */}
          <div className="px-5 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm font-medium text-dark-muted uppercase tracking-wide">Comments</span>
            </div>
            <CommentList cardId={card._id} boardId={boardId} userEmail={userEmail} readOnly={!canEdit} />
          </div>
        </div>
      </div>
    </div>
  );
}
