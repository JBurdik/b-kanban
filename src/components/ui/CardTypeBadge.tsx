import clsx from "clsx";
import type { CardType } from "@/lib/types";

interface Props {
  type?: CardType;
  size?: "sm" | "md";
}

export function CardTypeBadge({ type, size = "md" }: Props) {
  const config = type === "bug"
    ? { label: "Bug", icon: BugIcon, className: "text-red-400 bg-red-400/10 border-red-400/30" }
    : { label: "Task", icon: TagIcon, className: "text-blue-400 bg-blue-400/10 border-blue-400/30" };

  const Icon = config.icon;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded border capitalize",
        config.className,
        size === "sm" ? "text-xs px-1.5 py-0.5" : "text-sm px-2 py-1",
      )}
    >
      <Icon className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      {config.label}
    </span>
  );
}

function BugIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
