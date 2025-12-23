import clsx from "clsx";
import { PRIORITY_CONFIG } from "@/lib/constants";
import type { Priority } from "@/lib/types";

export interface PriorityBadgeProps {
  /** Priority level */
  priority: Priority;
  /** Whether to show the dot indicator */
  showDot?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional className */
  className?: string;
}

/**
 * Badge component for displaying priority levels.
 *
 * @example
 * ```tsx
 * <PriorityBadge priority="high" />
 * <PriorityBadge priority="low" showDot={false} size="sm" />
 * ```
 */
export function PriorityBadge({
  priority,
  showDot = true,
  size = "md",
  className,
}: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded border capitalize",
        config.bg,
        config.text,
        config.border,
        size === "sm" ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-0.5",
        className
      )}
    >
      {showDot && (
        <span
          className={clsx(
            "rounded-full",
            config.dot,
            size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5"
          )}
        />
      )}
      {priority}
    </span>
  );
}
