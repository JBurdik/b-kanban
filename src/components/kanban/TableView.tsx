import { useMemo } from "react";
import type { Id } from "convex/_generated/dataModel";
import type { Card, Column, BoardMember, BoardRole } from "@/lib/types";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Avatar } from "@/components/Avatar";
import type { FilterOption } from "./FilterBar";

interface ColumnWithCards extends Column {
  cards: Card[];
}

interface Board {
  _id: Id<"boards">;
  name: string;
  columns: ColumnWithCards[];
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

interface TableCard extends Card {
  columnName: string;
}

export function TableView({
  board,
  filter = "all",
  currentUserId,
  onCardClick,
  onCardDoubleClick,
}: Props) {
  // Flatten all cards with their column info and apply filter
  const cards = useMemo(() => {
    const allCards: TableCard[] = [];

    board.columns.forEach((column) => {
      column.cards.forEach((card) => {
        // Apply filter
        if (filter === "my-tasks" && card.assignee?.id !== currentUserId) {
          return;
        }
        if (filter === "unassigned" && card.assignee) {
          return;
        }

        allCards.push({
          ...card,
          columnName: column.name,
        });
      });
    });

    return allCards;
  }, [board.columns, filter, currentUserId]);

  // Sort by column position, then card position
  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      const colA = board.columns.findIndex((c) => c.name === a.columnName);
      const colB = board.columns.findIndex((c) => c.name === b.columnName);
      if (colA !== colB) return colA - colB;
      return a.position - b.position;
    });
  }, [cards, board.columns]);

  return (
    <div className="h-full overflow-auto p-4">
      <div className="bg-dark-surface rounded-lg border border-dark-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-border bg-dark-bg/50">
              <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wide w-16">
                ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wide">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wide w-32">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wide w-28">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wide w-48">
                Assignee
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wide w-24">
                Effort
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border">
            {sortedCards.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-dark-muted">
                  No tasks found
                </td>
              </tr>
            ) : (
              sortedCards.map((card) => (
                <tr
                  key={card._id}
                  onClick={() => onCardClick?.(card)}
                  onDoubleClick={() => onCardDoubleClick?.(card)}
                  className="hover:bg-dark-hover cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-dark-muted">
                      {card.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-dark-text font-medium">
                      {card.title}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent" />
                      <span className="text-sm text-dark-text">
                        {card.columnName}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={card.priority} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    {card.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar
                          name={card.assignee.name}
                          id={card.assignee.id}
                          imageUrl={card.assignee.image}
                          size="sm"
                        />
                        <span className="text-sm text-dark-text truncate">
                          {card.assignee.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-dark-muted">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {card.effort ? (
                      <span className="text-sm text-dark-text">
                        {card.effort}h
                      </span>
                    ) : (
                      <span className="text-sm text-dark-muted">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="mt-4 flex items-center justify-between text-sm text-dark-muted">
        <span>{sortedCards.length} tasks</span>
        <span>
          Total effort:{" "}
          {sortedCards.reduce((acc, card) => acc + (card.effort || 0), 0)}h
        </span>
      </div>
    </div>
  );
}
