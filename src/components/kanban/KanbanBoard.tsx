import { useState, useMemo } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
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
import type { FilterOption } from "./FilterBar";

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
  filter?: FilterOption;
  currentUserId?: string;
  onCardClick?: (card: Card) => void;
  onCardDoubleClick?: (card: Card) => void;
}

export function KanbanBoard({
  board,
  filter = "all",
  currentUserId,
  onCardClick,
  onCardDoubleClick,
}: Props) {
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);

  const userRole = board.userRole;
  const canDrag = canEdit(userRole);
  const canAddColumn = canManageColumns(userRole);

  const createColumn = useMutation(api.columns.create);

  // Apply filter to cards while keeping column structure
  const filteredColumns = useMemo(() => {
    if (filter === "all" || !currentUserId) {
      return board.columns || [];
    }

    return (board.columns || []).map((column) => ({
      ...column,
      cards: column.cards.filter((card) => {
        if (filter === "my-tasks") {
          return card.assignee?.id === currentUserId;
        }
        if (filter === "unassigned") {
          return !card.assignee;
        }
        return true;
      }),
    }));
  }, [board.columns, filter, currentUserId]);

  const {
    columns,
    activeCard,
    activeColumn,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useKanbanDnd({
    initialColumns: filteredColumns,
    canDrag,
    canReorderColumns: canAddColumn,
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
              canEdit={canDrag}
              canManageColumns={canAddColumn}
              isDraggingColumn={!!activeColumn}
              onCardClick={onCardClick}
              onCardDoubleClick={onCardDoubleClick}
            />
          ))}
        </SortableContext>

        {canAddColumn && (
          <AddColumnButton onClick={() => setShowAddColumn(true)} />
        )}
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
        {activeColumn && (
          <div className="flex-shrink-0 w-72 sm:w-80 lg:w-72 xl:w-80 bg-dark-surface rounded-lg shadow-2xl opacity-90 max-h-[400px] overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-dark-border">
              <div className="flex items-center gap-1">
                <div className="p-1 text-dark-muted">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                  </svg>
                </div>
                <h3 className="font-medium text-sm">
                  {activeColumn.name}
                  <span className="ml-2 text-dark-muted">({activeColumn.cards?.length || 0})</span>
                </h3>
              </div>
            </div>
            <div className="p-2 space-y-2">
              {activeColumn.cards?.slice(0, 3).map((card) => (
                <div key={card._id} className="p-2 bg-dark-bg rounded-lg text-sm text-dark-text truncate">
                  {card.title}
                </div>
              ))}
              {(activeColumn.cards?.length || 0) > 3 && (
                <div className="text-xs text-dark-muted text-center py-1">
                  +{activeColumn.cards!.length - 3} more cards
                </div>
              )}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
