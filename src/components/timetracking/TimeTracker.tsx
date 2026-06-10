import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useActiveTimer } from "@/hooks/useActiveTimer";
import { TimerDisplay } from "./TimerDisplay";
import { ManualEntryForm } from "./ManualEntryForm";
import { TimeEntryList } from "./TimeEntryList";
import clsx from "clsx";

type Tab = "timer" | "manual";

interface TimeTrackerProps {
  userEmail: string;
  mode?: "compact" | "full";
}

export function TimeTracker({ userEmail, mode = "full" }: TimeTrackerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("timer");

  const {
    activeTimer,
    elapsedMs,
    isRunning,
    start,
    stop,
    discard,
  } = useActiveTimer(userEmail);

  const todayData = useQuery(api.timeTracking.getTodayEntries, { userEmail });

  const isCompact = mode === "compact";

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex bg-dark-bg rounded-lg p-1 border border-dark-border">
        <button
          onClick={() => setActiveTab("timer")}
          className={clsx(
            "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === "timer"
              ? "bg-accent text-white"
              : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {!isCompact && "Timer"}
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={clsx(
            "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors",
            activeTab === "manual"
              ? "bg-accent text-white"
              : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
          )}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          {!isCompact && "Manual"}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "timer" ? (
        <TimerDisplay
          userEmail={userEmail}
          isRunning={isRunning}
          elapsedMs={elapsedMs}
          description={activeTimer?.description}
          cardInfo={activeTimer?.card}
          onStart={start}
          onStop={stop}
          onDiscard={discard}
        />
      ) : (
        <ManualEntryForm userEmail={userEmail} />
      )}

      {/* Today's entries (only in full mode) */}
      {!isCompact && todayData && (
        <div className="pt-4 border-t border-dark-border">
          <TimeEntryList
            entries={todayData.entries}
            totalMs={todayData.totalMs}
            title="Today"
          />
        </div>
      )}
    </div>
  );
}
