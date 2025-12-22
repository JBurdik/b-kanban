import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { CardViewModal } from "./CardViewModal";
import clsx from "clsx";

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
  card: Card;
  boardId?: Id<"boards">;
  columns?: Column[];
  userRole?: BoardRole;
  isOverlay?: boolean;
}

const priorityColors = {
  low: "bg-green-500/20 text-green-300 border border-green-500/30",
  medium: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  high: "bg-red-500/20 text-red-300 border border-red-500/30",
};

export function KanbanCard({
  card,
  boardId,
  columns = [],
  userRole,
  isOverlay,
}: Props) {
  const [showModal, setShowModal] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Convex mutation
  const deleteCard = useMutation(api.cards.remove);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this card?")) {
      await deleteCard({ cardId: card._id });
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        tabIndex={0}
        onClick={() => !isDragging && setShowModal(true)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isDragging) {
            e.preventDefault();
            setShowModal(true);
          }
        }}
        className={clsx(
          "group bg-dark-bg border border-dark-border rounded-lg p-3 cursor-pointer hover:border-dark-hover transition-colors card-focusable",
          isDragging && "opacity-50",
          isOverlay && "shadow-xl ring-2 ring-accent"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs text-dark-muted font-mono">
              {card.slug}
            </span>
            <h4 className="text-sm font-medium">{card.title}</h4>
          </div>
          {!isOverlay && (
            <button
              onClick={handleDelete}
              className="text-dark-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
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

        {card.content && (
          <p className="text-xs text-dark-muted mt-2 line-clamp-2">
            {card.content.replace(/<[^>]*>/g, "").slice(0, 100)}
          </p>
        )}

        <div className="flex items-center gap-2 mt-3">
          <span
            className={clsx(
              "text-xs px-2 py-0.5 rounded",
              priorityColors[card.priority]
            )}
          >
            {card.priority}
          </span>
          {card.dueDate && (
            <span className="text-xs text-dark-muted">
              {new Date(card.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {showModal && boardId && (
        <CardViewModal
          card={card}
          boardId={boardId}
          columns={columns}
          userRole={userRole}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
