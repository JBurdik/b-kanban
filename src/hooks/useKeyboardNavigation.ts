import { useState, useEffect, useCallback } from "react";
import type { Id } from "convex/_generated/dataModel";
import type { Card } from "@/lib/types";

interface Column {
  _id: Id<"columns">;
  cards: Card[];
}

interface Options {
  columns: Column[];
  onCardOpen?: (card: Card) => void;
  onCardEdit?: (card: Card) => void;
  onCardArchive?: (card: Card) => void;
  onNewCard?: (columnId: Id<"columns">) => void;
  enabled?: boolean;
}

function isInputFocused() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  if (el.closest(".ProseMirror")) return true;
  return false;
}

export function useKeyboardNavigation({
  columns,
  onCardOpen,
  onCardEdit,
  onCardArchive,
  onNewCard,
  enabled = true,
}: Options) {
  const [focusedColumnIndex, setFocusedColumnIndex] = useState<number | null>(null);
  const [focusedCardIndex, setFocusedCardIndex] = useState<number | null>(null);

  const clearFocus = useCallback(() => {
    setFocusedColumnIndex(null);
    setFocusedCardIndex(null);
  }, []);

  // Derive focused card ID
  const focusedCardId =
    focusedColumnIndex !== null &&
    focusedCardIndex !== null &&
    columns[focusedColumnIndex]?.cards[focusedCardIndex]
      ? columns[focusedColumnIndex].cards[focusedCardIndex]._id
      : null;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (e.metaKey || e.ctrlKey) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          if (focusedColumnIndex === null) {
            // Nothing focused: focus first card in first column
            if (columns.length > 0 && columns[0].cards.length > 0) {
              setFocusedColumnIndex(0);
              setFocusedCardIndex(0);
            }
          } else {
            const col = columns[focusedColumnIndex];
            if (col && focusedCardIndex !== null && focusedCardIndex < col.cards.length - 1) {
              setFocusedCardIndex(focusedCardIndex + 1);
            }
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (focusedColumnIndex !== null && focusedCardIndex !== null && focusedCardIndex > 0) {
            setFocusedCardIndex(focusedCardIndex - 1);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (focusedColumnIndex !== null && focusedColumnIndex < columns.length - 1) {
            const nextColIndex = focusedColumnIndex + 1;
            const nextCol = columns[nextColIndex];
            if (nextCol) {
              setFocusedColumnIndex(nextColIndex);
              // Preserve card index, clamp to column length
              const cardIdx = focusedCardIndex ?? 0;
              setFocusedCardIndex(
                nextCol.cards.length > 0
                  ? Math.min(cardIdx, nextCol.cards.length - 1)
                  : null
              );
            }
          } else if (focusedColumnIndex === null && columns.length > 0) {
            setFocusedColumnIndex(0);
            setFocusedCardIndex(columns[0].cards.length > 0 ? 0 : null);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (focusedColumnIndex !== null && focusedColumnIndex > 0) {
            const prevColIndex = focusedColumnIndex - 1;
            const prevCol = columns[prevColIndex];
            if (prevCol) {
              setFocusedColumnIndex(prevColIndex);
              const cardIdx = focusedCardIndex ?? 0;
              setFocusedCardIndex(
                prevCol.cards.length > 0
                  ? Math.min(cardIdx, prevCol.cards.length - 1)
                  : null
              );
            }
          }
          break;
        }
        case "Enter": {
          if (focusedColumnIndex !== null && focusedCardIndex !== null) {
            const card = columns[focusedColumnIndex]?.cards[focusedCardIndex];
            if (card && onCardOpen) {
              e.preventDefault();
              onCardOpen(card);
            }
          }
          break;
        }
        case "Escape": {
          clearFocus();
          break;
        }
        case "n":
        case "N": {
          e.preventDefault();
          if (onNewCard) {
            const colId =
              focusedColumnIndex !== null
                ? columns[focusedColumnIndex]?._id
                : columns[0]?._id;
            if (colId) {
              onNewCard(colId);
            }
          }
          break;
        }
        case "e":
        case "E": {
          if (focusedColumnIndex !== null && focusedCardIndex !== null) {
            const card = columns[focusedColumnIndex]?.cards[focusedCardIndex];
            if (card && onCardEdit) {
              e.preventDefault();
              onCardEdit(card);
            }
          }
          break;
        }
        case "a":
        case "A": {
          if (focusedColumnIndex !== null && focusedCardIndex !== null) {
            const card = columns[focusedColumnIndex]?.cards[focusedCardIndex];
            if (card && onCardArchive) {
              e.preventDefault();
              onCardArchive(card);
            }
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, columns, focusedColumnIndex, focusedCardIndex, onCardOpen, onCardEdit, onCardArchive, onNewCard, clearFocus]);

  return { focusedColumnIndex, focusedCardIndex, focusedCardId, clearFocus };
}
