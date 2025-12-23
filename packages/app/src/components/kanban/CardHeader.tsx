import { Link } from "@tanstack/react-router";
import type { Id } from "convex/_generated/dataModel";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import type { Priority } from "@/lib/types";

interface Props {
  boardId: Id<"boards">;
  boardName: string;
  cardSlug: string;
  priority: Priority;
  isSaving?: boolean;
}

export function CardHeader({ boardId, boardName, cardSlug, priority, isSaving }: Props) {
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
      </div>
    </div>
  );
}
