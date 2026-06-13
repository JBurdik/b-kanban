import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";

interface Version {
  _id: Id<"versions">;
  name: string;
  color: string;
}

interface Props {
  versions: Version[];
  selectedVersionId: Id<"versions"> | null;
  onChange: (versionId: Id<"versions"> | null) => void;
}

export function VersionFilter({ versions, selectedVersionId, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const selected = versions.find((v) => v._id === selectedVersionId);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Anchor the portaled menu to the button rect, tracking scroll/resize.
  useEffect(() => {
    if (!isOpen) return;
    function updatePos() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [isOpen]);

  if (versions.length === 0) return null;

  const menu =
    isOpen && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[100] bg-dark-surface border border-dark-border rounded-lg shadow-xl overflow-hidden min-w-[160px]"
          >
            <div className="max-h-48 overflow-y-auto py-1">
              <button
                onClick={() => { onChange(null); setIsOpen(false); }}
                className={clsx(
                  "w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors",
                  !selectedVersionId ? "bg-accent/20 text-accent" : "text-dark-text hover:bg-dark-hover",
                )}
              >
                All versions
                {!selectedVersionId && (
                  <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              {versions.map((version) => (
                <button
                  key={version._id}
                  onClick={() => { onChange(version._id); setIsOpen(false); }}
                  className={clsx(
                    "w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors",
                    version._id === selectedVersionId ? "bg-accent/20 text-accent" : "text-dark-text hover:bg-dark-hover",
                  )}
                >
                  <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", version.color)} />
                  <span className="flex-1">{version.name}</span>
                  {version._id === selectedVersionId && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors",
          selectedVersionId
            ? "bg-accent/20 text-accent border border-accent/30"
            : "bg-dark-bg text-dark-muted hover:text-dark-text border border-dark-border",
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
        </svg>
        {selected ? (
          <>
            <span className={clsx("w-2 h-2 rounded-full", selected.color)} />
            {selected.name}
          </>
        ) : (
          "Version"
        )}
        {selectedVersionId && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="p-0.5 hover:bg-accent/30 rounded ml-0.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </button>

      {menu}
    </div>
  );
}
