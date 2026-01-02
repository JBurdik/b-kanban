import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { stripHtml, formatDate } from "@/utils/formatting";
import type { Card } from "@/lib/types";
import clsx from "clsx";

interface Props {
  card: Card;
  boardId?: Id<"boards">;
  isOverlay?: boolean;
  onCardClick?: (card: Card) => void;
  onCardDoubleClick?: (card: Card) => void;
}

export function KanbanCard({
  card,
  boardId,
  isOverlay,
  onCardClick,
  onCardDoubleClick,
}: Props) {
  const navigate = useNavigate();

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
        onClick={() => {
          if (!isDragging && boardId) {
            if (onCardClick) {
              onCardClick(card);
            } else {
              navigate({
                to: "/boards/$boardId/cards/$cardSlug",
                params: { boardId, cardSlug: card.slug },
              });
            }
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!isDragging && onCardDoubleClick) {
            onCardDoubleClick(card);
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isDragging && boardId) {
            e.preventDefault();
            if (onCardClick) {
              onCardClick(card);
            } else {
              navigate({
                to: "/boards/$boardId/cards/$cardSlug",
                params: { boardId, cardSlug: card.slug },
              });
            }
          }
        }}
        className={clsx(
          "group bg-dark-bg border border-dark-border rounded-lg p-3 cursor-pointer hover:border-dark-hover transition-colors card-focusable",
          isDragging && "opacity-50",
          isOverlay && "shadow-xl ring-2 ring-accent",
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
            {stripHtml(card.content).slice(0, 100)}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 mt-3">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={card.priority} size="sm" />
            {card.dueDate && (
              <span className="text-xs text-dark-muted">
                {formatDate(card.dueDate)}
              </span>
            )}
          </div>
          {card.assignee && (
            <Avatar
              name={card.assignee.name}
              id={card.assignee.id}
              imageUrl={card.assignee.image}
              size="sm"
            />
          )}
        </div>
      </div>
    </>
  );
}
