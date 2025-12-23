import { useState, useEffect, useRef, useCallback } from "react";
import {
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { Card, Column } from "@/lib/types";

// Custom collision detection that works better for kanban boards
const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return rectIntersection(args);
};

interface KanbanColumn extends Column {
  cards: Card[];
}

interface UseKanbanDndOptions {
  initialColumns: KanbanColumn[];
  canDrag: boolean;
}

export function useKanbanDnd({ initialColumns, canDrag }: UseKanbanDndOptions) {
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [columns, setColumns] = useState(initialColumns);
  const columnsRef = useRef(columns);

  const reorderCards = useMutation(api.cards.reorder);

  // Sync columns when data changes
  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  // Keep ref in sync with state for use in drag handlers
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  // Only enable sensors if user can drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: canDrag ? 5 : 9999 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const activeColumn = columns.find((col) =>
        col.cards?.some((card) => card._id === active.id)
      );
      const card = activeColumn?.cards?.find((c) => c._id === active.id);
      if (card) setActiveCard(card);
    },
    [columns]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    setColumns((cols) => {
      const activeColumn = cols.find((col) =>
        col.cards?.some((card) => card._id === activeId)
      );
      const overColumn = cols.find(
        (col) =>
          col._id === overId || col.cards?.some((card) => card._id === overId)
      );

      if (!activeColumn || !overColumn || activeColumn._id === overColumn._id) {
        return cols;
      }

      return cols.map((col) => {
        if (col._id === activeColumn._id) {
          return {
            ...col,
            cards: col.cards?.filter((c) => c._id !== activeId),
          };
        }
        if (col._id === overColumn._id) {
          const activeCard = activeColumn.cards?.find((c) => c._id === activeId);
          if (!activeCard) return col;

          const overIndex = col.cards?.findIndex((c) => c._id === overId) ?? -1;
          const newCards = [...(col.cards || [])];

          if (overIndex >= 0) {
            newCards.splice(overIndex, 0, {
              ...activeCard,
              columnId: col._id,
            });
          } else {
            newCards.push({ ...activeCard, columnId: col._id });
          }

          return { ...col, cards: newCards };
        }
        return col;
      });
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCard(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeColumn = columns.find((col) =>
        col.cards?.some((card) => card._id === activeId)
      );

      if (!activeColumn) return;

      // Reorder within same column
      if (
        activeId !== overId &&
        activeColumn.cards?.some((c) => c._id === overId)
      ) {
        const oldIndex = activeColumn.cards.findIndex((c) => c._id === activeId);
        const newIndex = activeColumn.cards.findIndex((c) => c._id === overId);

        const newCards = arrayMove(activeColumn.cards, oldIndex, newIndex);

        setColumns((cols) =>
          cols.map((col) =>
            col._id === activeColumn._id ? { ...col, cards: newCards } : col
          )
        );
      }

      // Persist changes using ref to get latest state after handleDragOver updates
      const allCards = columnsRef.current.flatMap((col) =>
        (col.cards || []).map((card, idx) => ({
          id: card._id as Id<"cards">,
          columnId: col._id as Id<"columns">,
          position: idx,
        }))
      );

      await reorderCards({ items: allCards });
    },
    [columns, reorderCards]
  );

  return {
    columns,
    activeCard,
    sensors,
    collisionDetection: customCollisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
