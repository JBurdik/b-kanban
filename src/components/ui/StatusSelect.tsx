import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";
import type { Column } from "@/lib/types";

interface Props {
  value: Id<"columns">;
  onChange: (value: Id<"columns">) => void;
  columns: Column[];
  disabled?: boolean;
  className?: string;
}

// Status colors based on common column names
function getStatusColor(name: string): { bg: string; text: string; dot: string } {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("done") || lowerName.includes("complete") || lowerName.includes("finished")) {
    return { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" };
  }
  if (lowerName.includes("progress") || lowerName.includes("doing") || lowerName.includes("working")) {
    return { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" };
  }
  if (lowerName.includes("review") || lowerName.includes("testing") || lowerName.includes("qa")) {
    return { bg: "bg-purple-500/10", text: "text-purple-400", dot: "bg-purple-400" };
  }
  if (lowerName.includes("blocked") || lowerName.includes("hold")) {
    return { bg: "bg-rose-500/10", text: "text-rose-400", dot: "bg-rose-400" };
  }
  // Default (To Do, Backlog, etc.)
  return { bg: "bg-slate-500/10", text: "text-slate-400", dot: "bg-slate-400" };
}

export function StatusSelect({
  value,
  onChange,
  columns,
  disabled = false,
  className,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedColumn = columns.find((c) => c._id === value);
  const selectedColor = selectedColumn ? getStatusColor(selectedColumn.name) : null;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleSelect = (column: Column) => {
    onChange(column._id);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm",
          "flex items-center justify-between gap-2",
          "hover:border-dark-hover focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent",
          "transition-colors",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && "cursor-pointer"
        )}
      >
        <span className="flex-1 text-left">
          {selectedColumn ? (
            <span className="flex items-center gap-2">
              <span className={clsx("w-2 h-2 rounded-full", selectedColor?.dot)} />
              <span className={selectedColor?.text}>{selectedColumn.name}</span>
            </span>
          ) : (
            <span className="text-dark-muted">Select status...</span>
          )}
        </span>

        <svg
          className={clsx("w-4 h-4 text-dark-muted transition-transform", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={clsx(
            "absolute z-50 w-full mt-1 py-1",
            "bg-dark-surface border border-dark-border rounded-lg shadow-xl",
            "max-h-60 overflow-y-auto"
          )}
        >
          {columns.length === 0 ? (
            <div className="px-3 py-2 text-sm text-dark-muted">No columns</div>
          ) : (
            columns.map((column) => {
              const isSelected = column._id === value;
              const color = getStatusColor(column.name);

              return (
                <button
                  key={column._id}
                  type="button"
                  onClick={() => handleSelect(column)}
                  className={clsx(
                    "w-full px-3 py-2 text-sm text-left",
                    "flex items-center gap-2",
                    "transition-colors",
                    isSelected
                      ? "bg-accent/20"
                      : "hover:bg-dark-hover"
                  )}
                >
                  <span className={clsx("w-2 h-2 rounded-full", color.dot)} />
                  <span className={clsx("flex-1", color.text)}>{column.name}</span>
                  {isSelected && (
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
