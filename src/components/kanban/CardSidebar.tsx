import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import { PrioritySelector } from "@/components/ui/PrioritySelector";
import { PRIORITY_CONFIG } from "@/lib/constants";
import type { Priority, Column, BoardMember } from "@/lib/types";
import { formatDateLong } from "@/utils/formatting";

interface Props {
  columnId: Id<"columns">;
  priority: Priority;
  assigneeId?: Id<"users">;
  effort?: number;
  dueDate?: number;
  currentColumn: { name: string };
  currentAssignee?: { id: Id<"users">; name: string } | null;
  columns: Column[];
  members: BoardMember[];
  canEdit: boolean;
  onColumnChange: (columnId: Id<"columns">) => void;
  onPriorityChange: (priority: Priority) => void;
  onAssigneeChange: (assigneeId: Id<"users"> | undefined) => void;
  onEffortChange: (effort: number | undefined) => void;
}

export function CardSidebar({
  columnId,
  priority,
  assigneeId,
  effort,
  dueDate,
  currentColumn,
  currentAssignee,
  columns,
  members,
  canEdit,
  onColumnChange,
  onPriorityChange,
  onAssigneeChange,
  onEffortChange,
}: Props) {
  return (
    <aside className="hidden lg:block w-80 border-l border-dark-border bg-dark-surface p-6 overflow-y-auto">
      <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-4">Details</h2>

      {/* Status */}
      <div className="mb-4">
        <label className="block text-xs text-dark-muted mb-1">Status</label>
        {canEdit ? (
          <select
            value={columnId}
            onChange={(e) => onColumnChange(e.target.value as Id<"columns">)}
            className="input w-full text-sm"
          >
            {columns.map((col) => (
              <option key={col._id} value={col._id}>
                {col.name}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm font-medium">{currentColumn.name}</p>
        )}
      </div>

      {/* Priority */}
      <div className="mb-4">
        <label className="block text-xs text-dark-muted mb-1">Priority</label>
        {canEdit ? (
          <PrioritySelector value={priority} onChange={onPriorityChange} />
        ) : (
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border capitalize",
              PRIORITY_CONFIG[priority].bg,
              PRIORITY_CONFIG[priority].text,
              PRIORITY_CONFIG[priority].border
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
            onChange={(e) => onAssigneeChange(e.target.value ? (e.target.value as Id<"users">) : undefined)}
            className="input w-full text-sm"
          >
            <option value="">Unassigned</option>
            {members.map(
              (member) =>
                member.user && (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name}
                  </option>
                )
            )}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            {currentAssignee ? (
              <>
                <Avatar name={currentAssignee.name} id={currentAssignee.id} size="sm" />
                <span className="text-sm">{currentAssignee.name}</span>
              </>
            ) : (
              <span className="text-sm text-dark-muted">Unassigned</span>
            )}
          </div>
        )}
      </div>

      {/* Due Date */}
      {dueDate && (
        <div className="mb-4">
          <label className="block text-xs text-dark-muted mb-1">Due Date</label>
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <label className="block text-xs text-dark-muted mb-1">Time Effort</label>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.5"
              value={effort ?? ""}
              onChange={(e) => onEffortChange(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="input w-20 text-sm"
              placeholder="0"
            />
            <span className="text-sm text-dark-muted">hours</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-dark-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </aside>
  );
}
