import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { useConvexUser } from "@/hooks/useConvexUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { CardDetailPage } from "@/components/kanban/CardDetailPage";

export const Route = createFileRoute("/boards/$boardId/cards/$cardSlug")({
  component: CardDetailRoute,
});

function CardDetailRoute() {
  const { boardId, cardSlug } = Route.useParams();
  const { userEmail, isLoading: userLoading, session } = useConvexUser();

  // Get board data for context
  const board = useQuery(api.boards.get, {
    boardId: boardId as Id<"boards">,
    userEmail,
  });

  // Get card by slug
  const card = useQuery(api.cards.getBySlug, {
    slug: cardSlug,
    boardId: boardId as Id<"boards">,
  });

  const isLoading = board === undefined || card === undefined;

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-dark-muted mb-4">Board not found</p>
        <Link to="/boards" className="btn-primary">
          Back to boards
        </Link>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-dark-muted mb-4">Card not found</p>
        <Link
          to="/boards/$boardId"
          params={{ boardId }}
          className="btn-primary"
        >
          Back to board
        </Link>
      </div>
    );
  }

  return (
    <CardDetailPage
      card={card}
      board={board}
      userEmail={userEmail}
    />
  );
}
