import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useBoardCursors } from "@/hooks/useBoardCursors";
import { CursorOverlay } from "./CursorOverlay";
import { useCardFormState } from "@/hooks/useCardFormState";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useRegisterAssistantCard } from "@/contexts/AssistantContext";
import { canEdit as checkCanEdit } from "@/lib/permissions";
import type {
  Card,
  Column,
  BoardMember,
  BoardRole,
  Priority,
  CardType,
  Label,
} from "@/lib/types";
import { CardTypeSelector } from "@/components/ui/CardTypeSelector";
import { CardTypeBadge } from "@/components/ui/CardTypeBadge";
import { VersionBadge } from "@/components/ui/VersionBadge";
import { VersionSelect } from "@/components/ui/VersionSelect";
import { CardContent } from "./CardContent";
import { CardSidebar } from "./CardSidebar";
import { AttachmentList } from "./AttachmentList";
import { CommentList } from "./CommentList";
import { HistoryList } from "./HistoryList";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { PrioritySelector } from "@/components/ui/PrioritySelector";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { AssigneeSelect } from "@/components/ui/AssigneeSelect";
import { LabelBadge } from "@/components/ui/LabelBadge";
import { LabelManager } from "@/components/labels/LabelManager";
import { LabelSelector } from "@/components/labels/LabelSelector";
import { Avatar } from "@/components/Avatar";

const MIN_PANEL_WIDTH = 400;
const MAX_PANEL_WIDTH = 1200;
const DEFAULT_PANEL_WIDTH = 672; // max-w-2xl equivalent

interface CardWithColumn extends Card {
  column: {
    id: Id<"columns">;
    name: string;
  };
  labels?: Label[];
}

interface Board {
  _id: Id<"boards">;
  name: string;
  columns?: Column[];
  members?: BoardMember[];
  userRole?: BoardRole;
}

interface OnlineUser {
  userId: Id<"users">;
  userName: string;
  userImage?: string;
}

interface Props {
  card: CardWithColumn;
  board: Board;
  editMode?: boolean;
  defaultExpanded?: boolean;
  onClose: () => void;
  onlineUsers?: OnlineUser[];
  currentUserId?: Id<"users">;
}

export function CardSlidePanel({
  card,
  board,
  editMode = false,
  defaultExpanded = false,
  onClose,
  onlineUsers = [],
  currentUserId,
}: Props) {
  // Expose the open card to the Codex assistant so it can edit "this card".
  useRegisterAssistantCard({
    boardId: board._id,
    slug: card.slug,
    title: card.title,
    description: card.content || "",
  });

  // Use the useCardFormState hook for proper multi-user editing
  const { values, setField, getDirtyFields, hasChanges, markSaved } = useCardFormState({
    serverData: {
      title: card.title,
      content: card.content || "",
      priority: card.priority,
      type: card.type,
      columnId: card.columnId,
      assigneeId: card.assignee?.id,
      versionId: card.versionId,
      effort: card.effort,
    },
  });

  const [isEditing, setIsEditing] = useState(editMode);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");
  const panelRef = useRef<HTMLDivElement>(null);

  // Live cursors scoped to this card's panel
  const { cursors: panelCursors, report: reportPanelCursor } = useBoardCursors(
    board._id,
    card._id
  );
  const panelUserLookupRef = useRef(new Map<string, OnlineUser>());
  const panelUserLookup = panelUserLookupRef.current;
  panelUserLookup.clear();
  for (const u of onlineUsers) panelUserLookup.set(u.userId, u);

  const handlePanelPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = panelRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      reportPanelCursor(e.clientX - rect.left, e.clientY - rect.top, card.columnId);
    },
    [reportPanelCursor, card.columnId]
  );

  // The panel is a single non-scrolling region, so it maps onto CursorOverlay's
  // per-column model as one "column" keyed by the card's real columnId.
  const panelColumnEls = useMemo(() => {
    const map = new Map<string, HTMLDivElement>();
    if (panelRef.current) map.set(card.columnId, panelRef.current);
    return map;
  }, [card.columnId, panelRef.current]);

  // On phones the panel is a full-screen sheet (no fixed px width / resize).
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setIsNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const { session, userEmail } = useConvexUser();
  const updateCard = useMutation(api.cards.update);
  const toggleWatch = useMutation(api.cardWatchers.toggle);
  const currentUser = useQuery(
    api.users.getByEmail,
    userEmail ? { email: userEmail } : "skip"
  );
  const isWatching = useQuery(
    api.cardWatchers.isWatching,
    currentUser?.id
      ? { cardId: card._id, userId: currentUser.id as Id<"users"> }
      : "skip"
  );
  const watchers = useQuery(api.cardWatchers.list, { cardId: card._id });
  const searchMembers = useQuery(api.members.search, {
    boardId: board._id,
    query: "",
  });
  const boardVersions = useQuery(
    api.versions.list,
    session ? { boardId: board._id } : "skip"
  );

  const canEdit = checkCanEdit(board.userRole);
  const columns = board.columns || [];
  const members = board.members || [];

  // Derived values from form state
  const { title, content, priority, type, columnId, assigneeId, versionId, effort } = values;

  // Manual save function - only sends dirty fields to avoid overwriting other users' changes
  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    const dirtyFields = getDirtyFields();

    // Build update args only with fields that have changed
    const updateArgs: Parameters<typeof updateCard>[0] = {
      cardId: card._id,
    };

    if ("title" in dirtyFields) updateArgs.title = dirtyFields.title;
    if ("content" in dirtyFields) updateArgs.content = dirtyFields.content;
    if ("columnId" in dirtyFields) updateArgs.columnId = dirtyFields.columnId;
    // Handle assignee: send null to clear (unassign), or the value to set
    if ("assigneeId" in dirtyFields) {
      updateArgs.assigneeId = dirtyFields.assigneeId === undefined ? null : dirtyFields.assigneeId;
    }
    if ("effort" in dirtyFields) updateArgs.effort = dirtyFields.effort;
    // Handle priority: send null to clear, or the value to set
    if ("priority" in dirtyFields) {
      updateArgs.priority = dirtyFields.priority === undefined ? null : dirtyFields.priority;
    }
    // Handle type: send null to clear, or the value to set
    if ("type" in dirtyFields) {
      updateArgs.type = dirtyFields.type === undefined ? null : dirtyFields.type;
    }
    // Handle version: send null to clear, or the value to set
    if ("versionId" in dirtyFields) {
      updateArgs.versionId = dirtyFields.versionId === undefined ? null : dirtyFields.versionId;
    }

    setIsSaving(true);
    try {
      await updateCard(updateArgs);
      markSaved();
    } finally {
      setIsSaving(false);
    }
  }, [card._id, updateCard, getDirtyFields, markSaved, hasChanges]);

  // Save on close
  const handleClose = useCallback(async () => {
    if (hasChanges) {
      await handleSave();
    }
    onClose();
  }, [hasChanges, handleSave, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleClose]);

  // Priority shortcuts: 1 = low, 2 = medium, 3 = high
  useEffect(() => {
    const handlePriorityShortcut = (e: KeyboardEvent) => {
      // Guard: skip if input is focused
      const el = document.activeElement;
      if (el) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (el.getAttribute("contenteditable") === "true") return;
        if (el.closest(".ProseMirror")) return;
      }
      if (e.metaKey || e.ctrlKey) return;

      const priorityMap: Record<string, "low" | "medium" | "high"> = {
        "1": "low",
        "2": "medium",
        "3": "high",
      };

      const newPriority = priorityMap[e.key];
      if (newPriority && canEdit) {
        e.preventDefault();
        updateCard({
          cardId: card._id,
          priority: newPriority,
        });
      }
    };

    window.addEventListener("keydown", handlePriorityShortcut);
    return () => window.removeEventListener("keydown", handlePriorityShortcut);
  }, [card._id, updateCard, canEdit]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Mention search callback
  const handleMentionSearch = useCallback(
    async (query: string) => {
      const allMembers = searchMembers || [];
      const queryLower = query.toLowerCase();
      return allMembers
        .filter(
          (m) =>
            m.name.toLowerCase().includes(queryLower) ||
            m.email.toLowerCase().includes(queryLower),
        )
        .slice(0, 5);
    },
    [searchMembers],
  );

  // Get current assignee from members based on assigneeId state
  const currentAssignee = assigneeId
    ? members.find((m) => m.user?.id === assigneeId)?.user || card.assignee
    : undefined;

  // Get current column name
  const currentColumnName =
    columns.find((c) => c._id === columnId)?.name || card.column.name;

  // Handlers using setField
  const handleTitleChange = useCallback((value: string) => setField("title", value), [setField]);
  const handleContentChange = useCallback((value: string) => setField("content", value), [setField]);
  const handlePriorityChange = useCallback((value: Priority | undefined) => setField("priority", value), [setField]);
  const handleColumnChange = useCallback((value: Id<"columns">) => setField("columnId", value), [setField]);
  const handleAssigneeChange = useCallback((value: Id<"users"> | undefined) => setField("assigneeId", value), [setField]);
  const handleEffortChange = useCallback((value: number | undefined) => setField("effort", value), [setField]);
  const handleTypeChange = useCallback((value: CardType | undefined) => setField("type", value), [setField]);
  const handleVersionChange = useCallback((value: Id<"versions"> | undefined) => setField("versionId", value), [setField]);

  // Copy link handler
  const handleCopyLink = useCallback(async () => {
    const url = `${window.location.origin}/boards/${board._id}/cards/${card.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }, [board._id, card.slug]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        onPointerMove={handlePanelPointerMove}
        style={!isExpanded && !isNarrow ? { width: panelWidth } : undefined}
        className={`fixed bg-dark-surface shadow-2xl z-50 flex flex-col pb-safe sm:pb-0 ${
          isExpanded
            ? "inset-0 sm:inset-4 md:inset-y-6 md:inset-x-[5%] lg:inset-y-8 lg:inset-x-[10%] xl:inset-x-[15%] sm:rounded-xl sm:border border-dark-border transition-all duration-300"
            : "inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:border-l border-dark-border animate-slide-up sm:animate-slide-in-right"
        }`}
      >
        {/* Resize handle - only when not expanded (desktop side-panel only) */}
        {!isExpanded && !isNarrow && (
          <div
            onMouseDown={handleResizeStart}
            className={`absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize group z-10 ${
              isResizing ? "bg-accent" : "hover:bg-accent/50"
            }`}
          >
            {/* Visual indicator */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-dark-border group-hover:bg-accent/50 rounded-full transition-colors" />
          </div>
        )}

        {/* Live cursors of other users viewing this card */}
        <CursorOverlay
          cursors={panelCursors}
          userLookup={panelUserLookup}
          currentUserId={currentUserId}
          columnEls={panelColumnEls}
          originEl={panelRef.current}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-dark-border">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-dark-muted font-mono">
                {card.slug}
              </span>
              <button
                onClick={handleCopyLink}
                className="p-1 rounded hover:bg-dark-hover text-dark-muted hover:text-dark-text transition-colors"
                title="Copy link to card"
              >
                {linkCopied ? (
                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                )}
              </button>
            </div>
            {card.labels && card.labels.length > 0 && (
              <div className="flex items-center gap-1">
                {card.labels.slice(0, 2).map((label) => (
                  <LabelBadge key={label._id} label={label} size="sm" />
                ))}
                {card.labels.length > 2 && (
                  <span className="text-xs text-dark-muted">+{card.labels.length - 2}</span>
                )}
              </div>
            )}
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
            {/* Save button - only show when editing and has changes */}
            {canEdit && isEditing && hasChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm font-medium bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            )}
            {/* Watch button */}
            <button
              onClick={() => toggleWatch({ cardId: card._id })}
              className={`p-2 rounded-lg hover:bg-dark-hover transition-colors relative ${
                isWatching
                  ? "text-accent"
                  : "text-dark-muted hover:text-dark-text"
              }`}
              title={isWatching ? "Stop watching" : "Watch this card"}
            >
              {isWatching ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
              {watchers && watchers.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-accent text-white px-1">
                  {watchers.length}
                </span>
              )}
            </button>
            {/* Open at fullscreen route */}
            <Link
              to="/boards/$boardId/cards/$cardSlug"
              params={{ boardId: board._id, cardSlug: card.slug }}
              className="p-2 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-dark-text transition-colors"
              title="Open in full page"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
            {/* Expand/Collapse button — hidden on mobile (panel is already full-screen) */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hidden sm:block p-2 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-dark-text transition-colors"
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
              onClick={handleClose}
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

        {/* Metadata Bar - always visible with status, assignee, priority */}
        <div className="px-4 py-3 border-b border-dark-border bg-dark-bg/30 flex flex-nowrap overflow-x-auto sm:overflow-visible no-scrollbar sm:flex-wrap items-center gap-3 sm:gap-4 [&>div]:flex-shrink-0">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted uppercase font-medium">Status</span>
            {canEdit ? (
              <StatusSelect
                value={columnId}
                onChange={handleColumnChange}
                columns={columns}
                size="sm"
              />
            ) : (
              <span className="text-sm text-dark-text px-2 py-0.5 bg-dark-hover rounded">
                {currentColumnName}
              </span>
            )}
          </div>

          {/* Assignee */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted uppercase font-medium">Assignee</span>
            {canEdit ? (
              <AssigneeSelect
                value={assigneeId}
                onChange={handleAssigneeChange}
                members={members}
                size="sm"
              />
            ) : currentAssignee ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-dark-hover rounded">
                <Avatar
                  name={currentAssignee.name}
                  id={currentAssignee.id}
                  imageUrl={currentAssignee.image}
                  size="xs"
                />
                <span className="text-sm text-dark-text">{currentAssignee.name}</span>
              </div>
            ) : (
              <span className="text-sm text-dark-muted px-2 py-0.5">Unassigned</span>
            )}
          </div>

          {/* Priority */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted uppercase font-medium">Priority</span>
            {canEdit ? (
              <PrioritySelector
                value={priority}
                onChange={handlePriorityChange}
                size="sm"
                allowNone
              />
            ) : priority ? (
              <PriorityBadge priority={priority} size="sm" />
            ) : (
              <span className="text-sm text-dark-muted px-2 py-0.5">None</span>
            )}
          </div>

          {/* Type */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted uppercase font-medium">Type</span>
            {canEdit ? (
              <CardTypeSelector
                value={type}
                onChange={handleTypeChange}
                size="sm"
              />
            ) : (
              <CardTypeBadge type={type} size="sm" />
            )}
          </div>

          {/* Version */}
          {(card.version || canEdit) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-dark-muted uppercase font-medium">Version</span>
              {canEdit && boardVersions ? (
                <VersionSelect
                  value={versionId}
                  onChange={handleVersionChange}
                  versions={boardVersions}
                  size="sm"
                />
              ) : card.version ? (
                <VersionBadge version={card.version} size="sm" />
              ) : (
                <span className="text-sm text-dark-muted px-2 py-0.5">None</span>
              )}
            </div>
          )}

          {/* Labels */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-dark-muted uppercase font-medium">Labels</span>
            {canEdit ? (
              <LabelSelector
                boardId={board._id}
                cardId={card._id}
                currentLabels={card.labels || []}
                onOpenManager={() => setShowLabelManager(true)}
              />
            ) : card.labels && card.labels.length > 0 ? (
              <div className="flex items-center gap-1">
                {card.labels.map((label) => (
                  <LabelBadge key={label._id} label={label} size="sm" />
                ))}
              </div>
            ) : (
              <span className="text-sm text-dark-muted px-2 py-0.5">None</span>
            )}
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
                onTitleChange={handleTitleChange}
                onContentChange={handleContentChange}
                onMentionSearch={handleMentionSearch}
                onBlur={handleSave}
              />
              <CardSidebar
                columnId={columnId}
                priority={priority}
                type={type}
                versionId={versionId}
                versions={boardVersions || []}
                assigneeId={assigneeId}
                effort={effort}
                dueDate={card.dueDate}
                currentColumn={card.column}
                currentAssignee={currentAssignee}
                reporter={card.reporter}
                columns={columns}
                members={members}
                canEdit={true}
                onColumnChange={handleColumnChange}
                onPriorityChange={handlePriorityChange}
                onTypeChange={handleTypeChange}
                onVersionChange={handleVersionChange}
                onAssigneeChange={handleAssigneeChange}
                onEffortChange={handleEffortChange}
                cardId={card._id}
                cardTitle={title}
                boardId={board._id}
                labels={card.labels}
                userRole={board.userRole}
                onOpenLabelManager={() => setShowLabelManager(true)}
              />
            </>
          ) : (
            <div
              className={`flex-1 overflow-y-auto ${
                isExpanded ? "flex flex-col lg:flex-row" : ""
              }`}
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
                      <span className="text-dark-text">
                        {currentColumnName}
                      </span>
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
                    {card.reporter && (
                      <div>
                        <span className="text-dark-muted">Reporter: </span>
                        <span className="text-dark-text">
                          {card.reporter.name}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Description */}
                {content ? (
                  <div
                    className="mb-6 cursor-pointer hover:bg-dark-hover/30 rounded-lg p-2 -mx-2 transition-colors"
                    onDoubleClick={() => setIsEditing(true)}
                    title="Double-click to edit"
                  >
                    <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3">
                      Description
                    </h2>
                    <div
                      className="rich-content prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  </div>
                ) : (
                  <p
                    className="text-dark-muted text-sm italic mb-6 cursor-pointer hover:bg-dark-hover/30 rounded-lg p-2 -mx-2 transition-colors"
                    onDoubleClick={() => setIsEditing(true)}
                    title="Double-click to edit"
                  >
                    Double-click to add description
                  </p>
                )}

                {/* Attachments */}
                <div className="mb-6">
                  <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    Attachments
                  </h2>
                  <AttachmentList cardId={card._id} readOnly />
                </div>

                {/* Comments / History tabs */}
                <div className="mb-6">
                  <div className="flex items-center gap-1 border-b border-dark-border mb-4">
                    <button
                      type="button"
                      onClick={() => setActiveTab("comments")}
                      className={
                        "px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors " +
                        (activeTab === "comments"
                          ? "border-accent text-dark-text"
                          : "border-transparent text-dark-muted hover:text-dark-text")
                      }
                    >
                      Comments
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("history")}
                      className={
                        "px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors " +
                        (activeTab === "history"
                          ? "border-accent text-dark-text"
                          : "border-transparent text-dark-muted hover:text-dark-text")
                      }
                    >
                      History
                    </button>
                  </div>
                  {activeTab === "comments" ? (
                    <CommentList cardId={card._id} boardId={board._id} readOnly={!canEdit} />
                  ) : (
                    <HistoryList cardId={card._id} />
                  )}
                </div>

              </div>

              {/* Side panel with details - only in expanded view */}
              {isExpanded && (
                <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-dark-border p-6 space-y-6 bg-dark-bg/50">
                  {/* Status */}
                  <div>
                    <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">
                      Status
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-dark-text">
                        {currentColumnName}
                      </span>
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">
                      Priority
                    </h3>
                    <PriorityBadge priority={priority} />
                  </div>

                  {/* Labels */}
                  <div>
                    <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">
                      Labels
                    </h3>
                    {canEdit ? (
                      <LabelSelector
                        boardId={board._id}
                        cardId={card._id}
                        currentLabels={card.labels || []}
                        onOpenManager={() => setShowLabelManager(true)}
                      />
                    ) : card.labels && card.labels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {card.labels.map((label) => (
                          <LabelBadge key={label._id} label={label} size="sm" />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-dark-muted italic">No labels</p>
                    )}
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
                      <p className="text-sm text-dark-muted italic">
                        Unassigned
                      </p>
                    )}
                  </div>

                  {/* Reporter */}
                  <div>
                    <h3 className="text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">
                      Reporter
                    </h3>
                    {card.reporter ? (
                      <div className="flex items-center gap-3 p-3 bg-dark-surface rounded-lg">
                        <Avatar
                          name={card.reporter.name}
                          id={card.reporter.id}
                          imageUrl={card.reporter.image}
                          size="md"
                        />
                        <div>
                          <p className="text-sm font-medium text-dark-text">
                            {card.reporter.name}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-dark-muted italic">
                        Unknown
                      </p>
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
                      <p className="text-sm text-dark-muted italic">
                        Not estimated
                      </p>
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

        {showLabelManager && (
          <LabelManager
            boardId={board._id}
            onClose={() => setShowLabelManager(false)}
          />
        )}
      </div>
    </>
  );
}
