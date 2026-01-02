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
  canReorderColumns?: boolean;
}

export function useKanbanDnd({ initialColumns, canDrag, canReorderColumns = false }: UseKanbanDndOptions) {
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeColumn, setActiveColumn] = useState<KanbanColumn | null>(null);
  const [columns, setColumns] = useState(initialColumns);
  const columnsRef = useRef(columns);

  const reorderCards = useMutation(api.cards.reorder);
  const reorderColumns = useMutation(api.columns.reorder);

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

      // Check if dragging a column
      const draggedColumn = columns.find((col) => col._id === active.id);
      if (draggedColumn && canReorderColumns) {
        setActiveColumn(draggedColumn);
        return;
      }

      // Otherwise, check if dragging a card
      const activeCol = columns.find((col) =>
        col.cards?.some((card) => card._id === active.id)
      );
      const card = activeCol?.cards?.find((c) => c._id === active.id);
      if (card) setActiveCard(card);
    },
    [columns, canReorderColumns]
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dragging a column, handle column reordering
    if (activeColumn) {
      setColumns((cols) => {
        const oldIndex = cols.findIndex((col) => col._id === activeId);
        const newIndex = cols.findIndex((col) => col._id === overId);

        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
          return cols;
        }

        return arrayMove(cols, oldIndex, newIndex);
      });
      return;
    }

    // Otherwise handle card movement between columns
    setColumns((cols) => {
      const activeColumnData = cols.find((col) =>
        col.cards?.some((card) => card._id === activeId)
      );
      const overColumn = cols.find(
        (col) =>
          col._id === overId || col.cards?.some((card) => card._id === overId)
      );

      if (!activeColumnData || !overColumn || activeColumnData._id === overColumn._id) {
        return cols;
      }

      return cols.map((col) => {
        if (col._id === activeColumnData._id) {
          return {
            ...col,
            cards: col.cards?.filter((c) => c._id !== activeId),
          };
        }
        if (col._id === overColumn._id) {
          const activeCard = activeColumnData.cards?.find((c) => c._id === activeId);
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
  }, [activeColumn]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const wasDraggingColumn = !!activeColumn;
      setActiveCard(null);
      setActiveColumn(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // If we were dragging a column, persist column positions
      if (wasDraggingColumn) {
        const columnItems = columnsRef.current.map((col, idx) => ({
          id: col._id as Id<"columns">,
          position: idx,
        }));
        await reorderColumns({ items: columnItems });
        return;
      }

      // Otherwise handle card reordering
      const activeColumnData = columns.find((col) =>
        col.cards?.some((card) => card._id === activeId)
      );

      if (!activeColumnData) return;

      // Reorder within same column
      if (
        activeId !== overId &&
        activeColumnData.cards?.some((c) => c._id === overId)
      ) {
        const oldIndex = activeColumnData.cards.findIndex((c) => c._id === activeId);
        const newIndex = activeColumnData.cards.findIndex((c) => c._id === overId);

        const newCards = arrayMove(activeColumnData.cards, oldIndex, newIndex);

        setColumns((cols) =>
          cols.map((col) =>
            col._id === activeColumnData._id ? { ...col, cards: newCards } : col
          )
        );
      }

      // Persist card changes using ref to get latest state after handleDragOver updates
      const allCards = columnsRef.current.flatMap((col) =>
        (col.cards || []).map((card, idx) => ({
          id: card._id as Id<"cards">,
          columnId: col._id as Id<"columns">,
          position: idx,
        }))
      );

      await reorderCards({ items: allCards });
    },
    [columns, activeColumn, reorderCards, reorderColumns]
  );

  return {
    columns,
    activeCard,
    activeColumn,
    sensors,
    collisionDetection: customCollisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
