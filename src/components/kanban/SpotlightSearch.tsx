import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Card, Column } from "@/lib/types";
import type { Id } from "convex/_generated/dataModel";
import type { FilterOption } from "./FilterBar";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? "⌘" : "Ctrl+";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { VersionBadge } from "@/components/ui/VersionBadge";
import { Avatar } from "@/components/Avatar";
import { stripHtml } from "@/utils/formatting";

interface ColumnWithCards extends Column {
  cards: Card[];
}

interface Version {
  _id: Id<"versions">;
  name: string;
  color: string;
}

interface CommandItem {
  id: string;
  type: "command";
  icon: "version" | "filter" | "clear" | "add" | "label";
  label: string;
  description?: string;
  action: () => void;
  active?: boolean;
}

interface CardItem {
  type: "card";
  card: Card & { columnName: string };
}

type ResultItem = CommandItem | CardItem;

interface Props {
  columns: ColumnWithCards[];
  onCardClick: (card: Card) => void;
  onSearchChange: (query: string) => void;
  searchQuery?: string;
  // Filter props
  versions?: Version[];
  selectedVersionId?: Id<"versions"> | null;
  onVersionChange?: (versionId: Id<"versions"> | null) => void;
  currentFilter?: FilterOption;
  onFilterChange?: (filter: FilterOption) => void;
  // Action callbacks
  onOpenLabelManager?: () => void;
  onOpenVersionManager?: () => void;
  /** Increment to open the spotlight imperatively (e.g. from the mobile bar). */
  openToken?: number;
}

export function SpotlightSearch({
  columns,
  onCardClick,
  onSearchChange,
  searchQuery: externalSearchQuery = "",
  versions = [],
  selectedVersionId = null,
  onVersionChange,
  currentFilter = "all",
  onFilterChange,
  onOpenLabelManager,
  onOpenVersionManager,
  openToken,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isCommandMode = query.startsWith("!");

  // Build command results
  const commands = useMemo((): CommandItem[] => {
    const searchLower = isCommandMode
      ? query.slice(1).trim().toLowerCase()
      : query.toLowerCase().trim();


    const items: CommandItem[] = [];

    // Version commands
    if (onVersionChange && versions.length > 0) {
      // Clear version filter
      if (selectedVersionId) {
        const cmd: CommandItem = {
          id: "clear-version",
          type: "command",
          icon: "clear",
          label: "Clear version filter",
          action: () => onVersionChange(null),
        };
        if (!searchLower || "clear version".includes(searchLower) || "verze".includes(searchLower)) {
          items.push(cmd);
        }
      }

      // Each version as a filter option
      for (const version of versions) {
        const cmd: CommandItem = {
          id: `version-${version._id}`,
          type: "command",
          icon: "version",
          label: `Version: ${version.name}`,
          description: version._id === selectedVersionId ? "Active" : undefined,
          active: version._id === selectedVersionId,
          action: () => {
            if (version._id === selectedVersionId) {
              onVersionChange(null);
            } else {
              onVersionChange(version._id);
            }
          },
        };
        const matchTerms = `version verze ${version.name}`.toLowerCase();
        if (!searchLower || matchTerms.includes(searchLower)) {
          items.push(cmd);
        }
      }
    }

    // Task filter commands
    if (onFilterChange) {
      const filterOptions: { value: FilterOption; label: string; keywords: string }[] = [
        { value: "all", label: "All Tasks", keywords: "all tasks všechny filter filtr" },
        { value: "my-tasks", label: "My Tasks", keywords: "my tasks moje úkoly filter filtr assigned" },
        { value: "unassigned", label: "Unassigned", keywords: "unassigned nepřiřazené filter filtr" },
      ];

      for (const opt of filterOptions) {
        const cmd: CommandItem = {
          id: `filter-${opt.value}`,
          type: "command",
          icon: "filter",
          label: `Filter: ${opt.label}`,
          active: currentFilter === opt.value,
          description: currentFilter === opt.value ? "Active" : undefined,
          action: () => onFilterChange(opt.value),
        };
        if (!searchLower || opt.keywords.includes(searchLower) || opt.label.toLowerCase().includes(searchLower)) {
          items.push(cmd);
        }
      }
    }

    // Action commands
    if (onOpenLabelManager) {
      const cmd: CommandItem = {
        id: "manage-labels",
        type: "command",
        icon: "label",
        label: "Manage Labels",
        description: "Create and edit labels",
        action: () => onOpenLabelManager(),
      };
      const keywords = "label labels štítek štítky create vytvořit manage spravovat";
      if (!searchLower || keywords.includes(searchLower) || "manage labels".includes(searchLower)) {
        items.push(cmd);
      }
    }

    if (onOpenVersionManager) {
      const cmd: CommandItem = {
        id: "manage-versions",
        type: "command",
        icon: "add",
        label: "Manage Versions",
        description: "Create and edit versions",
        action: () => onOpenVersionManager(),
      };
      const keywords = "version versions verze create vytvořit manage spravovat milestone";
      if (!searchLower || keywords.includes(searchLower) || "manage versions".includes(searchLower)) {
        items.push(cmd);
      }
    }

    return items;
  }, [query, isCommandMode, versions, selectedVersionId, onVersionChange, currentFilter, onFilterChange, onOpenLabelManager, onOpenVersionManager]);

  // Card results (only when not in command mode)
  const cardResults = useMemo(() => {
    if (isCommandMode) return [];

    const searchLower = query.toLowerCase().trim();
    const allCards: (Card & { columnName: string })[] = [];

    columns.forEach((column) => {
      column.cards.forEach((card) => {
        if (!searchLower) {
          allCards.push({ ...card, columnName: column.name });
          return;
        }
        const titleMatch = card.title.toLowerCase().includes(searchLower);
        const slugMatch = card.slug.toLowerCase().includes(searchLower);
        const contentMatch = stripHtml(card.content || "").toLowerCase().includes(searchLower);
        if (titleMatch || slugMatch || contentMatch) {
          allCards.push({ ...card, columnName: column.name });
        }
      });
    });

    return allCards;
  }, [columns, query, isCommandMode]);

  // Combined results
  const results = useMemo((): ResultItem[] => {
    const items: ResultItem[] = [];

    // In command mode, only show commands
    if (isCommandMode) {
      return commands.map((cmd) => cmd as ResultItem);
    }

    // If query is empty, show commands first then cards
    // If query has text, show matching commands (max 3) then cards
    const matchingCommands = query.trim() ? commands.slice(0, 3) : [];
    for (const cmd of matchingCommands) {
      items.push(cmd);
    }

    for (const card of cardResults) {
      items.push({ type: "card", card });
    }

    return items;
  }, [isCommandMode, commands, cardResults, query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const open = useCallback(() => {
    setIsOpen(true);
    setQuery(externalSearchQuery);
    setSelectedIndex(0);
  }, [externalSearchQuery]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectItem = useCallback(
    (item: ResultItem) => {
      if (item.type === "command") {
        item.action();
        close();
      } else {
        close();
        onCardClick(item.card);
      }
    },
    [close, onCardClick],
  );

  // Global Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, open, close]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Open imperatively when openToken changes (mobile bar "Find").
  useEffect(() => {
    if (openToken) open();
  }, [openToken, open]);

  // Keyboard navigation inside spotlight
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          selectItem(results[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  };

  // Sync query to parent filter (only for card search, not command mode)
  useEffect(() => {
    if (isCommandMode) {
      onSearchChange("");
    } else {
      onSearchChange(query);
    }
  }, [query, isCommandMode, onSearchChange]);

  // Active filters indicator
  const activeFilterCount = (selectedVersionId ? 1 : 0) + (currentFilter !== "all" ? 1 : 0) + (externalSearchQuery ? 1 : 0);

  if (!isOpen) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={open}
          className="flex items-center gap-2 px-3 py-1.5 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-muted hover:text-dark-text hover:border-dark-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {externalSearchQuery ? (
            <span className="hidden sm:inline text-dark-text truncate max-w-[120px]">{externalSearchQuery}</span>
          ) : (
            <span className="hidden sm:inline">Search...</span>
          )}
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-medium bg-accent text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-dark-muted bg-dark-surface border border-dark-border rounded ml-2">
            {modKey}K
          </kbd>
        </button>
        {externalSearchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="flex items-center justify-center w-6 h-6 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors"
            title="Clear search"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

      {/* Spotlight modal */}
      <div className="relative w-full max-w-xl mx-4 bg-dark-surface border border-dark-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-border">
          <svg className="w-5 h-5 text-dark-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isCommandMode ? "Filter commands..." : "Search cards... (type ! for filters)"}
            className="flex-1 bg-transparent text-base text-dark-text placeholder:text-dark-muted focus:outline-none"
          />
          <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-dark-muted bg-dark-bg border border-dark-border rounded">
            ESC
          </kbd>
        </div>

        {/* Active filters banner */}
        {activeFilterCount > 0 && !isCommandMode && (
          <div className="px-4 py-2 border-b border-dark-border bg-dark-bg/50 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-dark-muted">Active:</span>
            {currentFilter !== "all" && (
              <button
                onClick={() => onFilterChange?.("all")}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors"
              >
                {currentFilter === "my-tasks" ? "My Tasks" : "Unassigned"}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {selectedVersionId && versions.length > 0 && (
              <button
                onClick={() => onVersionChange?.(null)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors"
              >
                {versions.find((v) => v._id === selectedVersionId)?.name || "Version"}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {externalSearchQuery && (
              <button
                onClick={() => {
                  onSearchChange("");
                  setQuery("");
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-accent/20 text-accent rounded-full hover:bg-accent/30 transition-colors"
              >
                Search: {externalSearchQuery}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-dark-muted text-sm">
              {isCommandMode
                ? "No matching commands"
                : query
                  ? "No cards found"
                  : "No cards"}
            </div>
          ) : (
            results.map((item, index) => {
              if (item.type === "command") {
                return (
                  <button
                    key={item.id}
                    onClick={() => selectItem(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                      index === selectedIndex
                        ? "bg-accent/15 text-dark-text"
                        : "text-dark-text hover:bg-dark-hover"
                    }`}
                  >
                    {/* Command icon */}
                    {item.icon === "version" && (
                      <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    )}
                    {item.icon === "filter" && (
                      <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    )}
                    {item.icon === "clear" && (
                      <svg className="w-4 h-4 text-dark-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    {item.icon === "label" && (
                      <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    )}
                    {item.icon === "add" && (
                      <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    )}

                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>

                    {item.active && (
                      <span className="text-xs px-1.5 py-0.5 bg-accent/20 text-accent rounded">
                        Active
                      </span>
                    )}
                  </button>
                );
              }

              const card = item.card;
              return (
                <button
                  key={card._id}
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                    index === selectedIndex
                      ? "bg-accent/15 text-dark-text"
                      : "text-dark-text hover:bg-dark-hover"
                  }`}
                >
                  {/* Type icon */}
                  {card.type === "bug" ? (
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3.003 3.003 0 116 0v1" />
                      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 014-4h4a4 4 0 014 4v3c0 3.3-2.7 6-6 6" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                      <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                  )}

                  {/* Card info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-dark-muted">{card.slug}</span>
                      <span className="text-sm font-medium truncate">{card.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-dark-muted">{card.columnName}</span>
                    </div>
                  </div>

                  {/* Right side: priority, version, assignee */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {card.priority && <PriorityBadge priority={card.priority} size="sm" />}
                    {card.version && <VersionBadge version={card.version} size="sm" />}
                    {card.assignee && (
                      <Avatar
                        name={card.assignee.name}
                        id={card.assignee.id}
                        imageUrl={card.assignee.image}
                        size="sm"
                      />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-dark-border flex items-center gap-4 text-[11px] text-dark-muted">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px]">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px]">↵</kbd>
            {isCommandMode ? "apply" : "open"}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px]">esc</kbd>
            close
          </span>
          {!isCommandMode && (
            <span className="flex items-center gap-1 ml-auto">
              <kbd className="px-1 py-0.5 bg-dark-bg border border-dark-border rounded text-[10px]">!</kbd>
              filters
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
