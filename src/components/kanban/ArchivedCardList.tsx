import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PriorityBadge } from "@/components/ui/PriorityBadge";
import { Avatar } from "@/components/Avatar";

interface ArchivedCardListProps {
  boardId: Id<"boards">;
}

export function ArchivedCardList({ boardId }: ArchivedCardListProps) {
  const archivedCards = useQuery(api.cards.listArchived, { boardId });
  const restoreCard = useMutation(api.cards.restore);
  const permanentDeleteCard = useMutation(api.cards.permanentDelete);

  const [cardToDelete, setCardToDelete] = useState<Id<"cards"> | null>(null);
  const [loading, setLoading] = useState<Id<"cards"> | null>(null);

  const handleRestore = async (cardId: Id<"cards">) => {
    setLoading(cardId);
    try {
      await restoreCard({ cardId });
    } finally {
      setLoading(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!cardToDelete) return;
    setLoading(cardToDelete);
    try {
      await permanentDeleteCard({ cardId: cardToDelete });
      setCardToDelete(null);
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (archivedCards === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (archivedCards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-surface flex items-center justify-center">
          <svg
            className="w-8 h-8 text-dark-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-dark-text mb-2">No archived cards</h3>
        <p className="text-dark-muted">
          Cards you delete will appear here. You can restore them or permanently delete them.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {archivedCards.map((card) => (
          <div
            key={card._id}
            className="bg-dark-surface border border-dark-border rounded-lg p-4 hover:border-dark-border/80 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-dark-muted">{card.slug}</span>
                  <PriorityBadge priority={card.priority} size="sm" />
                </div>
                <h3 className="font-medium text-dark-text mb-1 truncate">{card.title}</h3>
                <div className="flex items-center gap-3 text-sm text-dark-muted">
                  <span className="flex items-center gap-1">
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
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    {card.columnName}
                  </span>
                  {card.assignee && (
                    <span className="flex items-center gap-1">
                      <Avatar
                        name={card.assignee.name}
                        imageUrl={card.assignee.image}
                        size="sm"
                      />
                      <span className="truncate max-w-[100px]">{card.assignee.name}</span>
                    </span>
                  )}
                  {card.archivedAt && (
                    <span className="text-xs">
                      Archived {formatDate(card.archivedAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRestore(card._id)}
                  loading={loading === card._id}
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Restore
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setCardToDelete(card._id)}
                  disabled={loading === card._id}
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={cardToDelete !== null}
        onClose={() => setCardToDelete(null)}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete Card"
        message="Are you sure you want to permanently delete this card? This action cannot be undone. All attachments, comments, and time entries will also be deleted."
        confirmText="Delete Permanently"
        variant="danger"
        loading={loading !== null}
      />
    </>
  );
}
