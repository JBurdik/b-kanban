import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { formatDuration, parseHoursMinutes } from "@/lib/timeUtils";
import type { Id } from "convex/_generated/dataModel";

interface TimeEntry {
  _id: Id<"timeEntries">;
  description: string;
  durationMs: number;
  card?: { _id: Id<"cards">; slug: string; title: string } | null;
  board?: { _id: Id<"boards">; name: string } | null;
}

interface TimeEntryRowProps {
  entry: TimeEntry;
  compact?: boolean;
}

export function TimeEntryRow({ entry, compact = false }: TimeEntryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDescription, setEditDescription] = useState(entry.description);
  const [editHours, setEditHours] = useState("");
  const [editMinutes, setEditMinutes] = useState("");

  const updateEntry = useMutation(api.timeTracking.updateEntry);
  const deleteEntry = useMutation(api.timeTracking.deleteEntry);

  const handleStartEdit = () => {
    const { hours, minutes } = parseHoursMinutes(entry.durationMs);
    setEditDescription(entry.description);
    setEditHours(hours.toString());
    setEditMinutes(minutes.toString());
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateEntry({
      entryId: entry._id,
      description: editDescription,
      hours: parseInt(editHours) || 0,
      minutes: parseInt(editMinutes) || 0,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm("Delete this time entry?")) {
      await deleteEntry({ entryId: entry._id });
    }
  };

  if (isEditing) {
    return (
      <div className="p-3 rounded-lg bg-dark-hover space-y-2">
        <input
          type="text"
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-dark-text focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min="0"
            value={editHours}
            onChange={(e) => setEditHours(e.target.value)}
            className="w-16 px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-dark-text text-center focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="h"
          />
          <span className="text-dark-muted">:</span>
          <input
            type="number"
            min="0"
            max="59"
            value={editMinutes}
            onChange={(e) => setEditMinutes(e.target.value)}
            className="w-16 px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-dark-text text-center focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="m"
          />
          <div className="flex-1" />
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-accent hover:bg-accent/80 text-white rounded transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="px-2 py-1 text-xs bg-dark-border hover:bg-dark-hover text-dark-muted rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 group">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-dark-text truncate">{entry.description}</p>
          {entry.card && entry.board && (
            <Link
              to="/boards/$boardId/cards/$cardSlug"
              params={{ boardId: entry.board._id, cardSlug: entry.card.slug }}
              className="text-xs text-dark-muted hover:text-accent truncate font-mono transition-colors"
            >
              {entry.card.slug}
            </Link>
          )}
          {entry.card && !entry.board && (
            <span className="text-xs text-dark-muted truncate font-mono">
              {entry.card.slug}
            </span>
          )}
        </div>
        <span className="text-sm font-mono text-accent ml-2">
          {formatDuration(entry.durationMs)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-dark-bg hover:bg-dark-hover transition-colors group">
      <div className="flex-1 min-w-0">
        <p className="text-dark-text truncate">{entry.description}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-dark-muted">
          {entry.card && entry.board && (
            <Link
              to="/boards/$boardId/cards/$cardSlug"
              params={{ boardId: entry.board._id, cardSlug: entry.card.slug }}
              className="font-mono bg-dark-surface hover:bg-accent/20 hover:text-accent px-1.5 py-0.5 rounded transition-colors"
            >
              {entry.card.slug}
            </Link>
          )}
          {entry.card && !entry.board && (
            <span className="font-mono bg-dark-surface px-1.5 py-0.5 rounded">
              {entry.card.slug}
            </span>
          )}
          {entry.board && !entry.card && (
            <span className="bg-dark-surface px-1.5 py-0.5 rounded">
              {entry.board.name}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-accent">
          {formatDuration(entry.durationMs)}
        </span>

        {/* Edit/Delete buttons - visible on hover */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleStartEdit}
            className="p-1 text-dark-muted hover:text-dark-text transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-dark-muted hover:text-red-400 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
