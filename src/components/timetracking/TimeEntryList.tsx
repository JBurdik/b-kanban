import { TimeEntryRow } from "./TimeEntryRow";
import { formatDuration } from "@/lib/timeUtils";
import type { Id } from "convex/_generated/dataModel";

interface TimeEntry {
  _id: Id<"timeEntries">;
  description: string;
  durationMs: number;
  date: number;
  card?: { _id: Id<"cards">; slug: string; title: string } | null;
  board?: { _id: Id<"boards">; name: string } | null;
}

interface TimeEntryListProps {
  entries: TimeEntry[];
  totalMs: number;
  title?: string;
  compact?: boolean;
  showEmpty?: boolean;
}

export function TimeEntryList({
  entries,
  totalMs,
  title = "Time Entries",
  compact = false,
  showEmpty = true,
}: TimeEntryListProps) {
  if (entries.length === 0 && !showEmpty) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-dark-text">{title}</h3>
        {totalMs > 0 && (
          <span className="text-sm font-mono text-accent">
            Total: {formatDuration(totalMs)}
          </span>
        )}
      </div>

      {/* Entries */}
      {entries.length === 0 ? (
        <p className="text-dark-muted text-sm py-4 text-center">
          No time entries yet
        </p>
      ) : (
        <div className={compact ? "divide-y divide-dark-border" : "space-y-2"}>
          {entries.map((entry) => (
            <TimeEntryRow key={entry._id} entry={entry} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}
