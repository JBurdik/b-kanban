import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { RichTextEditor } from "@/components/RichTextEditor";
import { AttachmentList } from "./AttachmentList";
import clsx from "clsx";

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

type BoardRole = "owner" | "admin" | "member";

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
  onClose: () => void;
}

export function CardModal({ card, boardId, columns, members = [], userEmail, onClose }: Props) {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content || "");
  const [priority, setPriority] = useState(card.priority);
  const [columnId, setColumnId] = useState(card.columnId);
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | undefined>(card.assignee?.id);
  const [effort, setEffort] = useState<number | undefined>(card.effort);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateCard = useMutation(api.cards.update);
  const deleteCard = useMutation(api.cards.remove);

  // Auto-save on change with debounce
  useEffect(() => {
    if (
      title === card.title &&
      content === (card.content || "") &&
      priority === card.priority &&
      columnId === card.columnId &&
      assigneeId === card.assignee?.id &&
      effort === card.effort
    ) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await updateCard({
          cardId: card._id,
          title,
          content,
          priority,
          columnId,
          assigneeId,
          effort,
          currentUserEmail: userEmail,
        });
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [title, content, priority, columnId, assigneeId, effort, card._id, card.title, card.content, card.priority, card.columnId, card.assignee?.id, card.effort, updateCard]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleDelete = async () => {
    if (confirm("Delete this card?")) {
      setIsDeleting(true);
      try {
        await deleteCard({ cardId: card._id });
        onClose();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-surface border border-dark-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex-1">
            <span className="text-xs text-dark-muted font-mono mb-1 block">{card.slug}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 -mx-2 w-full"
              placeholder="Card title"
            />
          </div>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-dark-text p-1 ml-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-shadow">
          {/* Status (column) selector */}
          <div>
            <label className="block text-sm text-dark-muted mb-2">Status</label>
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value as Id<"columns">)}
              className="input w-full"
            >
              {columns.map((col) => (
                <option key={col._id} value={col._id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>

          {/* Priority selector */}
          <div>
            <label className="block text-sm text-dark-muted mb-2">Priority</label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={clsx(
                    "px-3 py-1 rounded text-sm capitalize transition-colors",
                    priority === p
                      ? p === "low"
                        ? "bg-green-500/20 text-green-400 ring-1 ring-green-500"
                        : p === "medium"
                        ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500"
                        : "bg-red-500/20 text-red-400 ring-1 ring-red-500"
                      : "bg-dark-bg text-dark-muted hover:text-dark-text"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Assignee selector */}
          <div>
            <label className="block text-sm text-dark-muted mb-2">Assignee</label>
            <select
              value={assigneeId || ""}
              onChange={(e) => setAssigneeId(e.target.value ? e.target.value as Id<"users"> : undefined)}
              className="input w-full"
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                member.user && (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name} ({member.user.email})
                  </option>
                )
              ))}
            </select>
          </div>

          {/* Time effort */}
          <div>
            <label className="block text-sm text-dark-muted mb-2">Time Effort (hours)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={effort ?? ""}
              onChange={(e) => setEffort(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="input w-full"
              placeholder="e.g., 2, 4, 8"
            />
          </div>

          {/* Description with rich text editor */}
          <div>
            <label className="block text-sm text-dark-muted mb-2">Description</label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Add a description..."
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm text-dark-muted mb-2">Attachments</label>
            <AttachmentList cardId={card._id} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark-border">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            {isDeleting ? "Deleting..." : "Delete card"}
          </button>
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-dark-muted text-sm">Saving...</span>
            )}
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
