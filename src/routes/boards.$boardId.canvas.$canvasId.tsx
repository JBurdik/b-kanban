import { createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { CanvasEditor } from "@/components/canvas/CanvasEditor";

export const Route = createFileRoute("/boards/$boardId/canvas/$canvasId")({
  component: CanvasEditorPage,
});

function CanvasEditorPage() {
  const { boardId, canvasId } = Route.useParams();
  const navigate = useNavigate();
  const { isLoading, session } = useConvexUser();

  const canvas = useQuery(
    api.canvases.get,
    session ? { canvasId: canvasId as Id<"canvases"> } : "skip"
  );

  const deleteCanvas = useMutation(api.canvases.remove);

  const linkedCards = useQuery(
    api.canvasLinks.listByCanvas,
    session ? { canvasId: canvasId as Id<"canvases"> } : "skip"
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" />;

  if (canvas === undefined) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (canvas === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] text-sm text-muted-foreground">
        Canvas not found.
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${canvas.name}"? This cannot be undone.`)) return;
    await deleteCanvas({ canvasId: canvas._id });
    await navigate({ to: "/boards/$boardId/canvas", params: { boardId } });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/boards/$boardId/canvas"
            params={{ boardId }}
            className="text-sm text-muted-foreground hover:text-foreground shrink-0"
          >
            ← Canvases
          </Link>
          <h1 className="text-sm font-medium truncate">{canvas.name}</h1>
          {linkedCards && linkedCards.length > 0 && (
            <div className="flex items-center gap-1.5 min-w-0">
              {linkedCards.map((card) => (
                <Link
                  key={card._id}
                  to="/boards/$boardId/cards/$cardSlug"
                  params={{ boardId, cardSlug: card.slug }}
                  title={card.title}
                  className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground hover:text-foreground shrink-0"
                >
                  {card.slug}
                </Link>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => void handleDelete()}
          className="text-xs text-muted-foreground hover:text-red-500"
        >
          Delete
        </button>
      </div>

      {/* Excalidraw needs a sized container, not an auto-height one. */}
      <div className="flex-1 min-h-0">
        <CanvasEditor canvas={canvas} />
      </div>
    </div>
  );
}
