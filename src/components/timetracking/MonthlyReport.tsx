import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { formatDuration, formatMonthYear } from "@/lib/timeUtils";

interface MonthlyReportProps {
  userEmail: string;
}

export function MonthlyReport({ userEmail }: MonthlyReportProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const summary = useQuery(api.timeTracking.getMonthlySummary, {
    userEmail,
    year,
    month,
  });

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrevMonth}
          className="p-2 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h3 className="font-semibold text-lg">{formatMonthYear(year, month)}</h3>

        <button
          onClick={handleNextMonth}
          disabled={isCurrentMonth}
          className="p-2 text-dark-muted hover:text-dark-text hover:bg-dark-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Loading state */}
      {!summary && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      )}

      {/* Summary */}
      {summary && (
        <>
          {/* Total hours */}
          <div className="text-center py-6 bg-dark-bg rounded-lg border border-dark-border">
            <p className="text-4xl font-bold text-accent">
              {formatDuration(summary.totalMs)}
            </p>
            <p className="text-dark-muted text-sm mt-1">
              Total time logged
            </p>
            {summary.entryCount > 0 && (
              <p className="text-dark-muted text-xs mt-2">
                {summary.entryCount} {summary.entryCount === 1 ? "entry" : "entries"}
              </p>
            )}
          </div>

          {/* Breakdown by board */}
          {summary.byBoard.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-dark-muted">By Project</h4>
              <div className="space-y-2">
                {summary.byBoard.map((item, index) => {
                  const percentage = summary.totalMs > 0
                    ? (item.totalMs / summary.totalMs) * 100
                    : 0;

                  return (
                    <div key={item.boardId || "standalone"} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-dark-text">{item.name}</span>
                        <span className="font-mono text-accent">
                          {formatDuration(item.totalMs)}
                        </span>
                      </div>
                      <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-dark-muted text-sm text-center py-4">
              No time logged this month
            </p>
          )}
        </>
      )}
    </div>
  );
}
