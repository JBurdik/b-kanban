import clsx from "clsx";

export type FilterOption = "all" | "my-tasks" | "unassigned";

interface FilterBarProps {
  currentFilter: FilterOption;
  onFilterChange: (filter: FilterOption) => void;
  taskCounts?: {
    all: number;
    myTasks: number;
    unassigned: number;
  };
}

const filters: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All Tasks" },
  { value: "my-tasks", label: "My Tasks" },
  { value: "unassigned", label: "Unassigned" },
];

export function FilterBar({
  currentFilter,
  onFilterChange,
  taskCounts,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-1 bg-dark-bg rounded-lg p-1">
      {filters.map((filter) => {
        const count =
          taskCounts &&
          (filter.value === "all"
            ? taskCounts.all
            : filter.value === "my-tasks"
              ? taskCounts.myTasks
              : taskCounts.unassigned);

        return (
          <button
            key={filter.value}
            onClick={() => onFilterChange(filter.value)}
            className={clsx(
              "px-3 py-1.5 text-sm rounded-md transition-all flex items-center gap-2",
              currentFilter === filter.value
                ? "bg-accent text-white shadow-sm"
                : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
            )}
          >
            {filter.label}
            {count !== undefined && count > 0 && (
              <span
                className={clsx(
                  "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                  currentFilter === filter.value
                    ? "bg-white/20"
                    : "bg-dark-border"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
