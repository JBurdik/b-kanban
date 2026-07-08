import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import clsx from "clsx";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { FilterOption } from "./FilterBar";

export interface FilterConfig {
  filter: FilterOption;
  versionId: Id<"versions"> | null;
}

interface Props {
  boardId: Id<"boards">;
  currentFilterConfig: FilterConfig;
  onApply: (config: FilterConfig) => void;
}

export function SavedViewsDropdown({ boardId, currentFilterConfig, onApply }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNaming, setIsNaming] = useState(false);
  const [name, setName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const savedFilters = useQuery(api.savedFilters.list, { boardId });
  const createSavedFilter = useMutation(api.savedFilters.create);
  const removeSavedFilter = useMutation(api.savedFilters.remove);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
        setIsNaming(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await createSavedFilter({
      boardId,
      name: trimmed,
      filterConfig: JSON.stringify(currentFilterConfig),
    });
    setName("");
    setIsNaming(false);
  };

  const menu =
    isOpen && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
            className="z-[100] bg-dark-surface border border-dark-border rounded-lg shadow-xl overflow-hidden min-w-[220px]"
          >
            <div className="max-h-64 overflow-y-auto py-1">
              {(savedFilters ?? []).length === 0 && !isNaming && (
                <div className="px-3 py-2 text-sm text-dark-muted">No saved views yet</div>
              )}
              {(savedFilters ?? []).map((sf) => (
                <div
                  key={sf._id}
                  className="group flex items-center gap-2 px-3 py-2 text-sm text-dark-text hover:bg-dark-hover"
                >
                  <button
                    onClick={() => {
                      onApply(JSON.parse(sf.filterConfig) as FilterConfig);
                      setIsOpen(false);
                    }}
                    className="flex-1 text-left truncate"
                  >
                    {sf.name}
                  </button>
                  <button
                    onClick={() => removeSavedFilter({ savedFilterId: sf._id })}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-dark-border text-dark-muted hover:text-red-400"
                    aria-label={`Delete ${sf.name}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-dark-border p-2">
              {isNaming ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                      if (e.key === "Escape") setIsNaming(false);
                    }}
                    placeholder="View name"
                    className="flex-1 px-2 py-1 text-sm rounded bg-dark-bg border border-dark-border text-dark-text focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!name.trim()}
                    className="px-2 py-1 text-sm rounded bg-accent text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsNaming(true)}
                  className="w-full px-2 py-1.5 text-sm text-left rounded text-accent hover:bg-dark-hover"
                >
                  + Save current filter
                </button>
              )}
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
          "bg-dark-bg text-dark-muted hover:text-dark-text border border-dark-border",
        )}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
        </svg>
        Views
      </button>

      {menu}
    </div>
  );
}
