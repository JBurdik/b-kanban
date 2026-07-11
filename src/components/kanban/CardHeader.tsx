import { Link } from "@tanstack/react-router";
import type { Id } from "convex/_generated/dataModel";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import type { Priority } from "@/lib/types";

interface Props {
  boardId: Id<"boards">;
  boardName: string;
  cardSlug: string;
  priority?: Priority;
  isSaving?: boolean;
  canEdit?: boolean;
  isEditing?: boolean;
  onToggleEdit?: () => void;
}

export function CardHeader({
  boardId,
  boardName,
  cardSlug,
  priority,
  isSaving,
  canEdit,
  isEditing,
  onToggleEdit,
}: Props) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border bg-dark-surface">
      <div className="flex items-center gap-3">
        <Link
          to="/boards/$boardId"
          params={{ boardId }}
          className="text-dark-muted hover:text-dark-text transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/boards/$boardId"
            params={{ boardId }}
            className="text-dark-muted hover:text-accent transition-colors"
          >
            {boardName}
          </Link>
          <span className="text-dark-muted">/</span>
          <span className="text-xs text-dark-muted font-mono bg-dark-bg px-2 py-0.5 rounded">
            {cardSlug}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isSaving && (
          <span className="text-dark-muted text-sm">Saving...</span>
        )}
        <PriorityBadge priority={priority} />
        {canEdit && onToggleEdit && !isEditing && (
          <button
            onClick={onToggleEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-dark-text bg-dark-hover hover:bg-dark-border rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
