import { useState, useRef, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

interface TaskSelectorProps {
  userEmail: string;
  value: Id<"cards"> | null;
  onChange: (cardId: Id<"cards"> | null) => void;
  compact?: boolean;
}

export function TaskSelector({
  userEmail,
  value,
  onChange,
  compact = false,
}: TaskSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user's tasks
  const tasksData = useQuery(api.cards.getMyTasks, {
    userEmail,
    limit: 50,
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Find selected task info
  const selectedTask = tasksData?.tasks.find((t) => t._id === value);

  // Filter tasks by search
  const filteredTasks = tasksData?.tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase())
  );

  // Group tasks by board
  const groupedTasks: Record<string, typeof filteredTasks> = {};
  filteredTasks?.forEach((task) => {
    const boardName = task.boardName;
    if (!groupedTasks[boardName]) {
      groupedTasks[boardName] = [];
    }
    groupedTasks[boardName]!.push(task);
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 text-left transition-colors ${
          compact
            ? "p-1.5 rounded hover:bg-dark-hover"
            : "w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg hover:border-dark-muted"
        }`}
      >
        {selectedTask ? (
          <>
            <span className="text-xs font-mono text-dark-muted">
              {selectedTask.slug}
            </span>
            {!compact && (
              <span className="text-sm text-dark-text truncate flex-1">
                {selectedTask.title}
              </span>
            )}
          </>
        ) : (
          <>
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
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            {!compact && (
              <span className="text-sm text-dark-muted">Link to task (optional)</span>
            )}
          </>
        )}
        {!compact && (
          <svg
            className="w-4 h-4 text-dark-muted ml-auto"
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
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-dark-surface border border-dark-border rounded-lg shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-dark-border">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full px-2 py-1.5 text-sm bg-dark-bg border border-dark-border rounded text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-1 focus:ring-accent"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto">
            {/* No task option */}
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
                setSearch("");
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dark-hover transition-colors ${
                value === null ? "bg-accent/10 text-accent" : "text-dark-muted"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span className="text-sm">No task (standalone)</span>
            </button>

            {/* Tasks grouped by board */}
            {Object.entries(groupedTasks).map(([boardName, tasks]) => (
              <div key={boardName}>
                <div className="px-3 py-1.5 text-xs font-medium text-dark-muted bg-dark-bg/50 sticky top-0">
                  {boardName}
                </div>
                {tasks?.map((task) => (
                  <button
                    key={task._id}
                    type="button"
                    onClick={() => {
                      onChange(task._id as Id<"cards">);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dark-hover transition-colors ${
                      value === task._id ? "bg-accent/10" : ""
                    }`}
                  >
                    <span className="text-xs font-mono text-dark-muted shrink-0">
                      {task.slug}
                    </span>
                    <span className="text-sm text-dark-text truncate">
                      {task.title}
                    </span>
                  </button>
                ))}
              </div>
            ))}

            {filteredTasks?.length === 0 && (
              <p className="px-3 py-4 text-sm text-dark-muted text-center">
                No tasks found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
