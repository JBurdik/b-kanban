import { useState, useCallback } from "react";
import type { Id } from "convex/_generated/dataModel";

export function useBulkSelect() {
  const [selectedCardIds, setSelectedCardIds] = useState<Set<Id<"cards">>>(new Set());

  const toggleCard = useCallback((cardId: Id<"cards">) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedCardIds(new Set()), []);
  const isSelected = useCallback((cardId: Id<"cards">) => selectedCardIds.has(cardId), [selectedCardIds]);

  return {
    selectedCardIds,
    selectedCount: selectedCardIds.size,
    isSelectionMode: selectedCardIds.size > 0,
    toggleCard,
    clearSelection,
    isSelected,
  };
}
