import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { KanbanCard } from "./KanbanCard";
import { Button } from "@/components/ui/Button";
import type { Card, Column } from "@/lib/types";

interface KanbanColumnWithCards extends Column {
  cards: Card[];
}

interface Props {
  column: KanbanColumnWithCards;
  boardId: Id<"boards">;
  canEdit?: boolean;
  canManageColumns?: boolean;
  isDraggingColumn?: boolean;
  onCardClick?: (card: Card) => void;
  onCardDoubleClick?: (card: Card) => void;
}

export function KanbanColumn({
  column,
  boardId,
  canEdit = true,
  canManageColumns = false,
  isDraggingColumn = false,
  onCardClick,
  onCardDoubleClick,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [isCreatingCard, setIsCreatingCard] = useState(false);

  // Sortable for column reordering (admins only)
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column._id,
    disabled: !canManageColumns,
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: column._id });

  // Combine refs for both sortable and droppable
  const setNodeRef = (node: HTMLDivElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const updateColumn = useMutation(api.columns.update);
  const deleteColumn = useMutation(api.columns.remove);
  const createCard = useMutation(api.cards.create);

  const handleUpdateName = async () => {
    if (name.trim() && name !== column.name) {
      await updateColumn({ columnId: column._id, name: name.trim() });
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm("Delete this column and all its cards?")) {
      await deleteColumn({ columnId: column._id });
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) return;

    setIsCreatingCard(true);
    try {
      await createCard({
        columnId: column._id,
        title: newCardTitle.trim(),
        position: column.cards?.length || 0,
      });
      setShowAddCard(false);
      setNewCardTitle("");
    } finally {
      setIsCreatingCard(false);
    }
  };

  const cards = column.cards || [];

  // Don't render content while dragging (show placeholder)
  if (isDragging && !isDraggingColumn) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex-shrink-0 w-72 sm:w-80 lg:w-72 xl:w-80 bg-dark-surface/50 rounded-lg border-2 border-dashed border-dark-border min-h-[200px]"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-shrink-0 w-72 sm:w-80 lg:w-72 xl:w-80 bg-dark-surface rounded-lg flex flex-col max-h-full ${
        isOver && !isDragging ? "ring-2 ring-accent" : ""
      } ${isDragging ? "opacity-90 shadow-2xl ring-2 ring-accent" : ""}`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between p-3 border-b border-dark-border">
        {/* Drag handle for admins */}
        {canManageColumns && (
          <button
            {...attributes}
            {...listeners}
            className="p-1 -ml-1 mr-1 text-dark-muted hover:text-dark-text cursor-grab active:cursor-grabbing touch-none"
            title="Drag to reorder"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
            </svg>
          </button>
        )}
        {isEditing && canManageColumns ? (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleUpdateName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                setName(column.name);
                setIsEditing(false);
              }
            }}
            className="w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
            autoFocus
          />
        ) : (
          <h3
            onClick={() => canManageColumns && setIsEditing(true)}
            className={`font-medium text-sm ${
              canManageColumns ? "cursor-pointer hover:text-accent" : ""
            }`}
          >
            {column.name}
            <span className="ml-2 text-dark-muted">({cards.length})</span>
          </h3>
        )}
        {canManageColumns && (
          <button
            onClick={handleDelete}
            className="text-dark-muted hover:text-red-400 p-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <SortableContext
          items={cards.map((c) => c._id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => (
            <KanbanCard
              key={card._id}
              card={card}
              boardId={boardId}
              onCardClick={onCardClick}
              onCardDoubleClick={onCardDoubleClick}
            />
          ))}
        </SortableContext>

        {/* Add card form */}
        {canEdit &&
          (showAddCard ? (
            <form onSubmit={handleCreateCard} className="space-y-2">
              <input
                type="text"
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                placeholder="Card title"
                className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" loading={isCreatingCard}>
                  Add
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowAddCard(false);
                    setNewCardTitle("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddCard(true)}
              className="w-full p-2 text-sm text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors text-left"
            >
              + Add card
            </button>
          ))}
      </div>
    </div>
  );
}
