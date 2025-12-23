import { useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useKanbanDnd } from "@/hooks/useKanbanDnd";
import { canEdit, canManageColumns } from "@/lib/permissions";
import type { Card, Column, BoardMember, BoardRole } from "@/lib/types";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { AddColumnModal } from "./AddColumnModal";
import { AddColumnButton } from "./AddColumnButton";

interface KanbanColumnWithCards extends Column {
  cards: Card[];
}

interface Board {
  _id: Id<"boards">;
  name: string;
  columns: KanbanColumnWithCards[];
  members?: BoardMember[];
  userRole?: BoardRole;
}

interface Props {
  board: Board;
  userEmail?: string;
}

export function KanbanBoard({ board, userEmail }: Props) {
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

  const userRole = board.userRole;
  const canDrag = canEdit(userRole);
  const canAddColumn = canManageColumns(userRole);

  const createColumn = useMutation(api.columns.create);

  const {
    columns,
    activeCard,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useKanbanDnd({
    initialColumns: board.columns || [],
    canDrag,
  });

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
      collisionDetection={collisionDetection}
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

        {canAddColumn && <AddColumnButton onClick={() => setShowAddColumn(true)} />}
      </div>

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
