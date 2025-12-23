import clsx from "clsx";
import { PRIORITIES, PRIORITY_CONFIG } from "@/lib/constants";
import type { Priority } from "@/lib/types";

export interface PrioritySelectorProps {
  /** Currently selected priority */
  value: Priority;
  /** Callback when priority changes */
  onChange: (priority: Priority) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional className */
  className?: string;
}

/**
 * Button group for selecting priority levels.
 *
 * @example
 * ```tsx
 * <PrioritySelector
 *   value={priority}
 *   onChange={setPriority}
 * />
 * ```
 */
export function PrioritySelector({
  value,
  onChange,
  disabled = false,
  size = "md",
  className,
}: PrioritySelectorProps) {
  return (
    <div className={clsx("flex gap-1", className)}>
      {PRIORITIES.map((priority) => {
        const isSelected = value === priority;
        const config = PRIORITY_CONFIG[priority];

        return (
          <button
            key={priority}
            type="button"
            onClick={() => onChange(priority)}
            disabled={disabled}
            className={clsx(
              "rounded capitalize transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-dark-bg",
              size === "sm" ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-xs",
              isSelected
                ? [config.bg, config.text, "ring-1", config.ring]
                : "bg-dark-bg text-dark-muted hover:text-dark-text hover:bg-dark-hover",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {priority}
          </button>
        );
      })}
    </div>
  );
}
