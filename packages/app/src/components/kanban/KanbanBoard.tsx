import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  DragOverlay,
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
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { AddColumnModal } from "./AddColumnModal";

type BoardRole = "owner" | "admin" | "member";

interface Card {
  _id: Id<"cards">;
  columnId: Id<"columns">;
  slug: string;
  title: string;
  content?: string;
  position: number;
  priority: "low" | "medium" | "high";
  assignee?: {
    id: Id<"users">;
    name: string;
    email: string;
    image?: string;
  } | null;
  dueDate?: number;
}

interface Column {
  _id: Id<"columns">;
  boardId: Id<"boards">;
  name: string;
  position: number;
  cards: Card[];
}

interface BoardMember {
  id: Id<"boardMembers">;
  role: BoardRole;
  userId: Id<"users">;
  user: {
    id: Id<"users">;
    name: string;
    email: string;
    image?: string;
  } | null;
}

interface Board {
  _id: Id<"boards">;
  name: string;
  columns: Column[];
  members?: BoardMember[];
  userRole?: BoardRole;
}

interface Props {
  board: Board;
  userEmail?: string;
}

// Permission helpers
function canEdit(role?: BoardRole): boolean {
  return role === "member" || role === "admin" || role === "owner";
}

function canManageColumns(role?: BoardRole): boolean {
  return role === "admin" || role === "owner";
}

// Custom collision detection that works better for kanban boards
const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return rectIntersection(args);
};

export function KanbanBoard({ board, userEmail }: Props) {
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [columns, setColumns] = useState(board.columns || []);
  const columnsRef = useRef(columns);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

  const userRole = board.userRole;
  const canDrag = canEdit(userRole);
  const canAddColumn = canManageColumns(userRole);

  // Convex mutations
  const reorderCards = useMutation(api.cards.reorder);
  const createColumn = useMutation(api.columns.create);

  // Sync columns when board data changes
  useEffect(() => {
    setColumns(board.columns || []);
  }, [board.columns]);

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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeColumn = columns.find((col) =>
      col.cards?.some((card) => card._id === active.id)
    );
    const card = activeColumn?.cards?.find((c) => c._id === active.id);
    if (card) setActiveCard(card);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeColumn = columns.find((col) =>
      col.cards?.some((card) => card._id === activeId)
    );
    const overColumn = columns.find(
      (col) =>
        col._id === overId || col.cards?.some((card) => card._id === overId)
    );

    if (!activeColumn || !overColumn || activeColumn._id === overColumn._id)
      return;

    setColumns((cols) =>
      cols.map((col) => {
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
      })
    );
  };

  const handleDragEnd = async (event: DragEndEvent) => {
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
        id: card._id,
        columnId: col._id,
        position: idx,
      }))
    );

    await reorderCards({ items: allCards });
  };

  const handleCreateColumn = async (name: string) => {
    setIsCreatingColumn(true);
    try {
      await createColumn({
        boardId: board._id,
        name,
        position: columns.length,
      });
      setShowAddColumn(false);
    } finally {
      setIsCreatingColumn(false);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-4 h-full overflow-x-auto">
        <SortableContext
          items={columns.map((c) => c._id)}
          strategy={horizontalListSortingStrategy}
        >
          {columns.map((column) => (
            <KanbanColumn
              key={column._id}
              column={column}
              boardId={board._id}
              allColumns={columns}
              members={board.members}
              userEmail={userEmail}
              canEdit={canDrag}
              canManageColumns={canAddColumn}
              userRole={userRole}
            />
          ))}
        </SortableContext>

        {/* Add column button (admin or owner) */}
        {canAddColumn && (
          <button
            onClick={() => setShowAddColumn(true)}
            className="flex-shrink-0 w-72 h-fit p-4 border-2 border-dashed border-dark-border rounded-lg text-dark-muted hover:border-accent hover:text-accent transition-colors"
          >
            + Add Column
          </button>
        )}
      </div>

      {/* Add Column Modal */}
      {showAddColumn && (
        <AddColumnModal
          onSubmit={handleCreateColumn}
          onClose={() => setShowAddColumn(false)}
          isPending={isCreatingColumn}
        />
      )}

      <DragOverlay>
        {activeCard && <KanbanCard card={activeCard} isOverlay />}
      </DragOverlay>
    </DndContext>
  );
}
