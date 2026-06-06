import { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";
import { SelectPopover } from "./SelectPopover";
import { useIsMobile } from "@/hooks/useIsMobile";

interface VersionItem {
  _id: Id<"versions">;
  name: string;
  color: string;
}

interface Props {
  value?: Id<"versions">;
  onChange: (value: Id<"versions"> | undefined) => void;
  versions: VersionItem[];
  size?: "sm" | "md";
}

export function VersionSelect({ value, onChange, versions, size = "md" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const selected = versions.find((v) => v._id === value);

  useEffect(() => {
    if (isMobile) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

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
        {selected ? (
          <>
            <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", selected.color)} />
            <span>{selected.name}</span>
          </>
        ) : (
          <span className="text-dark-muted">No version</span>
        )}
        <div className="flex items-center gap-1 ml-1">
          {selected && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
              }}
              className="p-0.5 hover:bg-dark-hover rounded transition-colors"
            >
              <svg className="w-3 h-3 text-dark-muted hover:text-dark-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
          <svg
            className={clsx("w-3.5 h-3.5 text-dark-muted transition-transform", isOpen && "rotate-180")}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <SelectPopover
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Version"
        desktopClassName="absolute z-50 mt-1 bg-dark-surface border border-dark-border rounded-lg shadow-xl overflow-hidden min-w-[140px]"
      >
          <div className="max-h-48 overflow-y-auto py-1">
            {/* No version option */}
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setIsOpen(false);
              }}
              className={clsx(
                "w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors",
                !value ? "bg-accent/20 text-accent" : "text-dark-text hover:bg-dark-hover",
              )}
            >
              <span className="w-2 h-2 rounded-full bg-dark-border flex-shrink-0" />
              <span className="flex-1">No version</span>
              {!value && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {versions.map((version) => (
              <button
                key={version._id}
                type="button"
                onClick={() => {
                  onChange(version._id);
                  setIsOpen(false);
                }}
                className={clsx(
                  "w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors",
                  version._id === value ? "bg-accent/20 text-accent" : "text-dark-text hover:bg-dark-hover",
                )}
              >
                <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", version.color)} />
                <span className="flex-1">{version.name}</span>
                {version._id === value && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}

            {versions.length === 0 && (
              <div className="px-3 py-2 text-sm text-dark-muted">No versions created yet</div>
            )}
          </div>
      </SelectPopover>
    </div>
  );
}
