import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import type { CardType } from "@/lib/types";

interface Props {
  value?: CardType;
  onChange: (value: CardType | undefined) => void;
  size?: "sm" | "md";
}

const TYPE_OPTIONS: { value: CardType; label: string; icon: React.ReactNode; className: string }[] = [
  {
    value: "task",
    label: "Task",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
    className: "text-blue-400",
  },
  {
    value: "bug",
    label: "Bug",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
        <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
        <path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" />
      </svg>
    ),
    className: "text-red-400",
  },
];

export function CardTypeSelector({ value, onChange, size = "md" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = TYPE_OPTIONS.find((o) => o.value === value) || TYPE_OPTIONS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "bg-dark-surface border border-dark-border rounded-lg",
          "flex items-center gap-1.5",
          "hover:border-dark-hover focus:outline-none focus:ring-2 focus:ring-accent",
          "transition-colors cursor-pointer",
          size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm",
        )}
      >
        <span className={selected.className}>{selected.icon}</span>
        <span>{selected.label}</span>
        <svg
          className={clsx("w-3.5 h-3.5 text-dark-muted transition-transform", isOpen && "rotate-180")}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-xl overflow-hidden min-w-[120px]">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={clsx(
                "w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors",
                option.value === (value || "task")
                  ? "bg-accent/20 text-accent"
                  : "text-dark-text hover:bg-dark-hover",
              )}
            >
              <span className={option.className}>{option.icon}</span>
              <span>{option.label}</span>
              {option.value === (value || "task") && (
                <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
