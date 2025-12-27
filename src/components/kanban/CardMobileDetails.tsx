import { useState } from "react";
import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import { PrioritySelector } from "@/components/ui/PrioritySelector";
import { StatusSelect } from "@/components/ui/StatusSelect";
import { AssigneeSelect } from "@/components/ui/AssigneeSelect";
import { PRIORITY_CONFIG } from "@/lib/constants";
import type { Priority, Column, BoardMember } from "@/lib/types";

interface Props {
  columnId: Id<"columns">;
  priority: Priority;
  assigneeId?: Id<"users">;
  effort?: number;
  currentColumn: { name: string };
  currentAssignee?: { id: Id<"users">; name: string; image?: string } | null;
  columns: Column[];
  members: BoardMember[];
  canEdit: boolean;
  onColumnChange: (columnId: Id<"columns">) => void;
  onPriorityChange: (priority: Priority) => void;
  onAssigneeChange: (assigneeId: Id<"users"> | undefined) => void;
  onEffortChange: (effort: number | undefined) => void;
}

export function CardMobileDetails({
  columnId,
  priority,
  assigneeId,
  effort,
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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="lg:hidden border-b border-dark-border bg-dark-surface">
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm"
      >
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border capitalize",
              PRIORITY_CONFIG[priority].bg,
              PRIORITY_CONFIG[priority].text,
              PRIORITY_CONFIG[priority].border,
            )}
          >
            {priority}
          </span>
          <span className="text-dark-muted">{currentColumn.name}</span>
          {currentAssignee && (
            <div className="flex items-center gap-1">
              <Avatar
                name={currentAssignee.name}
                id={currentAssignee.id}
                imageUrl={currentAssignee.image}
                size="sm"
              />
              <span className="text-xs text-dark-muted">
                {currentAssignee.name}
              </span>
            </div>
          )}
        </div>
        <svg
          className={clsx(
            "w-5 h-5 text-dark-muted transition-transform",
            isExpanded && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Status */}
          <div>
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
          <div>
            <label className="block text-xs text-dark-muted mb-1">
              Priority
            </label>
            {canEdit ? (
              <PrioritySelector value={priority} onChange={onPriorityChange} />
            ) : (
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
            )}
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs text-dark-muted mb-1">
              Assignee
            </label>
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

          {/* Time Effort */}
          <div>
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
                <span>{effort ?? 0}h</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
