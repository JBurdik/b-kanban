import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { KanbanCard } from "./KanbanCard";

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

interface Props {
  column: Column;
  boardId: Id<"boards">;
  allColumns?: Column[];
  canEdit?: boolean;
  canManageColumns?: boolean;
  userRole?: BoardRole;
}

export function KanbanColumn({
  column,
  boardId,
  allColumns = [],
  canEdit = true,
  canManageColumns = false,
  userRole,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [isCreatingCard, setIsCreatingCard] = useState(false);

  const { setNodeRef, isOver } = useDroppable({ id: column._id });

  // Convex mutations
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

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 sm:w-80 lg:w-72 xl:w-80 bg-dark-surface rounded-lg flex flex-col max-h-full ${
        isOver ? "ring-2 ring-accent" : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between p-3 border-b border-dark-border">
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
            className="input text-sm py-1"
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
              columns={allColumns}
              userRole={userRole}
            />
          ))}
        </SortableContext>

        {/* Add card form (editor+ only) */}
        {canEdit &&
          (showAddCard ? (
            <form onSubmit={handleCreateCard} className="space-y-2">
              <input
                type="text"
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                placeholder="Card title"
                className="input text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isCreatingCard}
                  className="btn-primary text-sm py-1"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCard(false);
                    setNewCardTitle("");
                  }}
                  className="btn-secondary text-sm py-1"
                >
                  Cancel
                </button>
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
