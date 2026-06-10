import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveTimer } from "@/hooks/useActiveTimer";
import { formatTimerDisplay, formatDuration } from "@/lib/timeUtils";

interface TimeTrackerWidgetProps {
  userEmail: string;
}

export function TimeTrackerWidget({ userEmail }: TimeTrackerWidgetProps) {
  const [description, setDescription] = useState("");

  const {
    activeTimer,
    elapsedMs,
    isRunning,
    start,
    stop,
  } = useActiveTimer(userEmail);

  const todayData = useQuery(api.timeTracking.getTodayEntries, { userEmail });

  const handleStart = () => {
    if (description.trim()) {
      start(description.trim());
      setDescription("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isRunning) {
      handleStart();
    }
  };

  return (
    <div className="space-y-4">
      {isRunning ? (
        // Running timer display
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-2xl font-mono font-bold text-accent">
              {formatTimerDisplay(elapsedMs)}
            </p>
            <p className="text-sm text-dark-muted truncate">
              {activeTimer?.description}
            </p>
          </div>
          <button
            onClick={stop}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop
          </button>
        </div>
      ) : (
        // Quick start
        <div className="flex gap-2">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What are you working on?"
            className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
          <button
            onClick={handleStart}
            disabled={!description.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 disabled:bg-dark-hover disabled:text-dark-muted text-white rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start
          </button>
        </div>
      )}

      {/* Today's total */}
      {todayData && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-dark-muted">Today</span>
          <span className="font-mono text-accent">
            {formatDuration(todayData.totalMs)}
          </span>
        </div>
      )}

      {/* Recent entries */}
      {todayData && todayData.entries.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-dark-border">
          {todayData.entries.slice(0, 3).map((entry) => (
            <div key={entry._id} className="flex items-center justify-between text-sm">
              <span className="text-dark-text truncate">{entry.description}</span>
              <span className="font-mono text-dark-muted ml-2">
                {formatDuration(entry.durationMs)}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
