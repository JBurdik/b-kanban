import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import { PrioritySelector } from "@/components/ui/PrioritySelector";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { AssigneeSelect } from "@/components/ui/AssigneeSelect";
import { LabelSelector } from "@/components/labels/LabelSelector";
import { LinkedDocuments } from "./LinkedDocuments";
import { PRIORITY_CONFIG } from "@/lib/constants";
import type { Priority, CardType, Column, BoardMember, Label, BoardRole } from "@/lib/types";
import { CardTypeSelector } from "@/components/ui/CardTypeSelector";
import { CardTypeBadge } from "@/components/ui/CardTypeBadge";
import { VersionSelect } from "@/components/ui/VersionSelect";
import { formatDateLong } from "@/utils/formatting";
import { useActiveTimer } from "@/hooks/useActiveTimer";
import { formatTimerDisplay } from "@/lib/timeUtils";

interface Props {
  columnId: Id<"columns">;
  priority?: Priority;
  type?: CardType;
  versionId?: Id<"versions">;
  versions: { _id: Id<"versions">; name: string; color: string }[];
  assigneeId?: Id<"users">;
  effort?: number;
  dueDate?: number;
  currentColumn: { name: string };
  currentAssignee?: { id: Id<"users">; name: string; image?: string } | null;
  reporter?: { id: Id<"users">; name: string; image?: string } | null;
  columns: Column[];
  members: BoardMember[];
  canEdit: boolean;
  onColumnChange: (columnId: Id<"columns">) => void;
  onPriorityChange: (priority: Priority | undefined) => void;
  onTypeChange: (type: CardType | undefined) => void;
  onVersionChange: (versionId: Id<"versions"> | undefined) => void;
  onAssigneeChange: (assigneeId: Id<"users"> | undefined) => void;
  onEffortChange: (effort: number | undefined) => void;
  // Time tracking props
  cardId?: Id<"cards">;
  cardTitle?: string;
  userEmail?: string;
  // Board ID for linked documents
  boardId?: Id<"boards">;
  // Labels props
  labels?: Label[];
  userRole?: BoardRole;
  onOpenLabelManager?: () => void;
}

export function CardSidebar({
  columnId,
  priority,
  type,
  versionId,
  versions,
  assigneeId,
  effort,
  dueDate,
  currentColumn,
  currentAssignee,
  reporter,
  columns,
  members,
  canEdit,
  onColumnChange,
  onPriorityChange,
  onTypeChange,
  onVersionChange,
  onAssigneeChange,
  onEffortChange,
  cardId,
  cardTitle,
  userEmail,
  boardId,
  labels,
  userRole,
  onOpenLabelManager,
}: Props) {
  const {
    activeTimer,
    elapsedMs,
    isRunning,
    start,
    stop,
  } = useActiveTimer(userEmail || "");

  // Check if timer is running for THIS card
  const isTimerForThisCard = isRunning && activeTimer?.cardId === cardId;
  const isTimerForOtherCard = isRunning && activeTimer?.cardId !== cardId;

  const handleStartTimer = () => {
    if (cardId && cardTitle) {
      start(cardTitle, cardId);
    }
  };
  return (
    <aside className="hidden lg:block w-80 border-l border-dark-border bg-dark-surface p-6 overflow-y-auto">
      <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-4">
        Details
      </h2>

      {/* Status */}
      <div className="mb-4">
        <label className="block text-xs text-dark-muted mb-1">Status</label>
        {canEdit ? (
          <StatusSelect
            value={columnId}
            onChange={onColumnChange}
            columns={columns}
          />
        ) : (
          <p className="text-sm font-medium">{currentColumn.name}</p>
        )}
      </div>

      {/* Priority */}
      <div className="mb-4">
        <label className="block text-xs text-dark-muted mb-1">Priority</label>
        {canEdit ? (
          <PrioritySelector value={priority} onChange={onPriorityChange} allowNone />
        ) : priority ? (
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border capitalize",
              PRIORITY_CONFIG[priority].bg,
              PRIORITY_CONFIG[priority].text,
              PRIORITY_CONFIG[priority].border,
            )}
          >
            {priority}
          </span>
        ) : (
          <span className="text-sm text-dark-muted">None</span>
        )}
      </div>

      {/* Type */}
      <div className="mb-4">
        <label className="block text-xs text-dark-muted mb-1">Type</label>
        {canEdit ? (
          <CardTypeSelector value={type} onChange={onTypeChange} />
        ) : (
          <CardTypeBadge type={type} />
        )}
      </div>

      {/* Version */}
      <div className="mb-4">
        <label className="block text-xs text-dark-muted mb-1">Version</label>
        {canEdit ? (
          <VersionSelect value={versionId} onChange={onVersionChange} versions={versions} />
        ) : versionId ? (
          <span className="text-sm">{versions.find((v) => v._id === versionId)?.name || "Unknown"}</span>
        ) : (
          <span className="text-sm text-dark-muted">None</span>
        )}
      </div>

      {/* Labels */}
      {cardId && boardId && (
        <div className="mb-4">
          <label className="block text-xs text-dark-muted mb-1">Labels</label>
          <LabelSelector
            boardId={boardId}
            cardId={cardId}
            currentLabels={labels || []}
            userEmail={userEmail}
            onOpenManager={
              (userRole === "owner" || userRole === "admin") && onOpenLabelManager
                ? onOpenLabelManager
                : undefined
            }
          />
        </div>
      )}

      {/* Assignee */}
      <div className="mb-4">
        <label className="block text-xs text-dark-muted mb-1">Assignee</label>
        {canEdit ? (
          <AssigneeSelect
            value={assigneeId}
            onChange={onAssigneeChange}
            members={members}
          />
        ) : (
          <div className="flex items-center gap-2">
            {currentAssignee ? (
              <>
                <Avatar
                  name={currentAssignee.name}
                  id={currentAssignee.id}
                  imageUrl={currentAssignee.image}
                  size="sm"
                />
                <span className="text-sm">{currentAssignee.name}</span>
              </>
            ) : (
              <span className="text-sm text-dark-muted">Unassigned</span>
            )}
          </div>
        )}
      </div>

      {/* Reporter */}
      <div className="mb-4">
        <label className="block text-xs text-dark-muted mb-1">Reporter</label>
        <div className="flex items-center gap-2">
          {reporter ? (
            <>
              <Avatar
                name={reporter.name}
                id={reporter.id}
                imageUrl={reporter.image}
                size="sm"
              />
              <span className="text-sm">{reporter.name}</span>
            </>
          ) : (
            <span className="text-sm text-dark-muted">Unknown</span>
          )}
        </div>
      </div>

      {/* Due Date */}
      {dueDate && (
        <div className="mb-4">
          <label className="block text-xs text-dark-muted mb-1">Due Date</label>
          <div className="flex items-center gap-2 text-sm">
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
            <span>{formatDateLong(dueDate)}</span>
          </div>
        </div>
      )}

      {/* Time Effort */}
      <div className="mb-4">
        <label className="block text-xs text-dark-muted mb-1">
          Time Effort
        </label>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.5"
              value={effort ?? ""}
              onChange={(e) =>
                onEffortChange(
                  e.target.value ? parseFloat(e.target.value) : undefined,
                )
              }
              className="input w-20 text-sm"
              placeholder="0"
            />
            <span className="text-sm text-dark-muted">hours</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
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
            <span>{effort ?? 0}h</span>
          </div>
        )}
      </div>

      {/* Time Tracking */}
      {userEmail && cardId && (
        <div className="mb-4 pt-4 border-t border-dark-border">
          <label className="block text-xs text-dark-muted mb-2">
            Time Tracking
          </label>
          {isTimerForThisCard ? (
            <div className="space-y-2">
              <div className="text-2xl font-mono font-bold text-accent text-center">
                {formatTimerDisplay(elapsedMs)}
              </div>
              <button
                onClick={stop}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Stop Timer
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartTimer}
              disabled={isTimerForOtherCard}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-dark-hover hover:bg-dark-border disabled:opacity-50 disabled:cursor-not-allowed text-dark-text rounded-lg text-sm transition-colors"
              title={isTimerForOtherCard ? "Stop the current timer first" : "Start tracking time"}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
              {isTimerForOtherCard ? "Timer Running" : "Start Timer"}
            </button>
          )}
          {isTimerForOtherCard && (
            <p className="text-xs text-dark-muted mt-1 text-center">
              Timer running on another task
            </p>
          )}
        </div>
      )}

      {/* Linked Documents */}
      {cardId && boardId && (
        <div className="mb-4 pt-4 border-t border-dark-border">
          <label className="block text-xs text-dark-muted mb-2">
            Linked Documents
          </label>
          <LinkedDocuments
            cardId={cardId}
            boardId={boardId}
            userEmail={userEmail}
            canEdit={canEdit}
          />
        </div>
      )}
    </aside>
  );
}
