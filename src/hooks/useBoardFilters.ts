import { useState, useEffect, useCallback } from "react";
import type { FilterOption } from "@/components/kanban/FilterBar";
import type { Id } from "convex/_generated/dataModel";

type ViewMode = "board" | "table";

interface BoardFilters {
  filter: FilterOption;
  viewMode: ViewMode;
  selectedVersionId: string | null;
}

const STORAGE_KEY = "board-filters";

function getStoredFilters(): Record<string, BoardFilters> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveFilters(all: Record<string, BoardFilters>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage full or unavailable
  }
}

export function useBoardFilters(boardId: string) {
  const [filter, setFilterState] = useState<FilterOption>(() => {
    return getStoredFilters()[boardId]?.filter ?? "all";
  });

  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    return getStoredFilters()[boardId]?.viewMode ?? "board";
  });

  const [selectedVersionId, setSelectedVersionIdState] = useState<Id<"versions"> | null>(() => {
    const stored = getStoredFilters()[boardId]?.selectedVersionId;
    return (stored as Id<"versions">) ?? null;
  });

  // Reset state when boardId changes (re-read from localStorage)
  useEffect(() => {
    const stored = getStoredFilters()[boardId];
    setFilterState(stored?.filter ?? "all");
    setViewModeState(stored?.viewMode ?? "board");
    setSelectedVersionIdState((stored?.selectedVersionId as Id<"versions">) ?? null);
  }, [boardId]);

  // Persist on change
  useEffect(() => {
    const all = getStoredFilters();
    all[boardId] = {
      filter,
      viewMode,
      selectedVersionId,
    };
    saveFilters(all);
  }, [boardId, filter, viewMode, selectedVersionId]);

  const setFilter = useCallback((f: FilterOption) => setFilterState(f), []);
  const setViewMode = useCallback((v: ViewMode) => setViewModeState(v), []);
  const setSelectedVersionId = useCallback(
    (v: Id<"versions"> | null) => setSelectedVersionIdState(v),
    []
  );

  return {
    filter,
    setFilter,
    viewMode,
    setViewMode,
    selectedVersionId,
    setSelectedVersionId,
  };
}
