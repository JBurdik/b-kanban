import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { RichTextEditor } from "@/components/RichTextEditor";
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
  effort?: number;
  assignee?: {
    id: Id<"users">;
    name: string;
    email: string;
    image?: string;
  } | null;
  dueDate?: number;
  column: {
    id: Id<"columns">;
    name: string;
  };
}

interface Column {
  _id: Id<"columns">;
  boardId: Id<"boards">;
  name: string;
  position: number;
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

interface Board {
  _id: Id<"boards">;
  name: string;
  columns?: Column[];
  members?: BoardMember[];
  userRole?: BoardRole;
}

interface Props {
  card: Card;
  board: Board;
  userEmail?: string;
}

const priorityConfig = {
  low: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-400" },
  high: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", dot: "bg-rose-400" },
};

export function CardDetailPage({ card, board, userEmail }: Props) {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content || "");
  const [priority, setPriority] = useState(card.priority);
  const [columnId, setColumnId] = useState(card.columnId);
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | undefined>(card.assignee?.id);
  const [effort, setEffort] = useState<number | undefined>(card.effort);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateCard = useMutation(api.cards.update);
  const searchMembers = useQuery(api.members.search, { boardId: board._id, query: "" });

  const canEdit = board.userRole === "member" || board.userRole === "admin" || board.userRole === "owner";
  const columns = board.columns || [];
  const members = board.members || [];

  // Mention search callback
  const handleMentionSearch = useCallback(async (query: string) => {
    const allMembers = searchMembers || [];
    const queryLower = query.toLowerCase();
    return allMembers.filter(m =>
      m.name.toLowerCase().includes(queryLower) ||
      m.email.toLowerCase().includes(queryLower)
    ).slice(0, 5);
  }, [searchMembers]);

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

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-dark-bg">
      {/* Breadcrumb header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border bg-dark-surface">
        <div className="flex items-center gap-3">
          <Link
            to="/boards/$boardId"
            params={{ boardId: board._id }}
            className="text-dark-muted hover:text-dark-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Link
              to="/boards/$boardId"
              params={{ boardId: board._id }}
              className="text-dark-muted hover:text-accent transition-colors"
            >
              {board.name}
            </Link>
            <span className="text-dark-muted">/</span>
            <span className="text-xs text-dark-muted font-mono bg-dark-bg px-2 py-0.5 rounded">
              {card.slug}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isSaving && (
            <span className="text-dark-muted text-sm">Saving...</span>
          )}
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
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Title */}
          <div className="mb-6">
            {canEdit ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-transparent text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 -mx-2 w-full"
                placeholder="Card title"
              />
            ) : (
              <h1 className="text-2xl font-semibold">{title}</h1>
            )}
          </div>

          {/* Description */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              Description
            </h2>
            {canEdit ? (
              <RichTextEditor
                content={content}
                onChange={setContent}
                onMentionSearch={handleMentionSearch}
                placeholder="Add a description..."
              />
            ) : (
              card.content ? (
                <div
                  className="rich-content bg-dark-surface border border-dark-border rounded-lg p-4"
                  dangerouslySetInnerHTML={{ __html: card.content }}
                />
              ) : (
                <p className="text-dark-muted text-sm italic">No description added yet</p>
              )
            )}
          </div>

          {/* Attachments */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Attachments
            </h2>
            <AttachmentList cardId={card._id} readOnly={!canEdit} />
          </div>

          {/* Comments */}
          <div>
            <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Comments
            </h2>
            <CommentList cardId={card._id} boardId={board._id} userEmail={userEmail} readOnly={!canEdit} />
          </div>
        </div>

        {/* Right: Sidebar (visible on lg+ screens) */}
        <aside className="hidden lg:block w-80 border-l border-dark-border bg-dark-surface p-6 overflow-y-auto">
          <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-4">Details</h2>

          {/* Status */}
          <div className="mb-4">
            <label className="block text-xs text-dark-muted mb-1">Status</label>
            {canEdit ? (
              <select
                value={columnId}
                onChange={(e) => setColumnId(e.target.value as Id<"columns">)}
                className="input w-full text-sm"
              >
                {columns.map((col) => (
                  <option key={col._id} value={col._id}>
                    {col.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium">{card.column.name}</p>
            )}
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-xs text-dark-muted mb-1">Priority</label>
            {canEdit ? (
              <div className="flex gap-1">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={clsx(
                      "px-2 py-1 rounded text-xs capitalize transition-colors",
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
            ) : (
              <span
                className={clsx(
                  "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border capitalize",
                  priorityConfig[priority].bg,
                  priorityConfig[priority].text,
                  priorityConfig[priority].border
                )}
              >
                {priority}
              </span>
            )}
          </div>

          {/* Assignee */}
          <div className="mb-4">
            <label className="block text-xs text-dark-muted mb-1">Assignee</label>
            {canEdit ? (
              <select
                value={assigneeId || ""}
                onChange={(e) => setAssigneeId(e.target.value ? e.target.value as Id<"users"> : undefined)}
                className="input w-full text-sm"
              >
                <option value="">Unassigned</option>
                {members.map((member) => (
                  member.user && (
                    <option key={member.userId} value={member.userId}>
                      {member.user.name}
                    </option>
                  )
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2">
                {card.assignee ? (
                  <>
                    <Avatar name={card.assignee.name} id={card.assignee.id} size="sm" />
                    <span className="text-sm">{card.assignee.name}</span>
                  </>
                ) : (
                  <span className="text-sm text-dark-muted">Unassigned</span>
                )}
              </div>
            )}
          </div>

          {/* Due Date */}
          {card.dueDate && (
            <div className="mb-4">
              <label className="block text-xs text-dark-muted mb-1">Due Date</label>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>
                  {new Date(card.dueDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          )}

          {/* Time Effort */}
          <div className="mb-4">
            <label className="block text-xs text-dark-muted mb-1">Time Effort</label>
            {canEdit ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={effort ?? ""}
                  onChange={(e) => setEffort(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="input w-20 text-sm"
                  placeholder="0"
                />
                <span className="text-sm text-dark-muted">hours</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{effort ?? 0}h</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
