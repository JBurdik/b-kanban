import { createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useState } from "react";

export const Route = createFileRoute("/boards/$boardId/canvas/")({
  component: CanvasListPage,
});

function CanvasListPage() {
  const { boardId } = Route.useParams();
  const navigate = useNavigate();
  const { isLoading, session } = useConvexUser();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const canvases = useQuery(
    api.canvases.list,
    session ? { boardId: boardId as Id<"boards"> } : "skip"
  );

  const createCanvas = useMutation(api.canvases.create);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" />;
  }

  const handleCreate = async () => {
    if (!newName.trim()) return;

    try {
      const canvasId = await createCanvas({
        boardId: boardId as Id<"boards">,
        name: newName.trim(),
      });
      setNewName("");
      setIsCreating(false);
      await navigate({
        to: "/boards/$boardId/canvas/$canvasId",
        params: { boardId, canvasId },
      });
    } catch (error) {
      console.error("Failed to create canvas:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/boards/$boardId"
            params={{ boardId }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to board
          </Link>
          <h1 className="text-2xl font-semibold">Canvases</h1>
        </div>

        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:opacity-90"
          >
            New canvas
          </button>
        )}
      </div>

      {isCreating && (
        <div className="flex gap-2 mb-6">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") setIsCreating(false);
            }}
            placeholder="Canvas name"
            className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background"
          />
          <button
            onClick={() => void handleCreate()}
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white hover:opacity-90"
          >
            Create
          </button>
          <button
            onClick={() => setIsCreating(false)}
            className="px-3 py-1.5 text-sm rounded-md hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      )}

      {canvases === undefined ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : canvases.length === 0 ? (
        <div className="text-sm text-muted-foreground py-12 text-center">
          No canvases yet. Create one to start drawing.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {canvases.map((canvas) => (
            <li key={canvas._id}>
              <Link
                to="/boards/$boardId/canvas/$canvasId"
                params={{ boardId, canvasId: canvas._id }}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted"
              >
                <span className="text-sm font-medium">{canvas.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(canvas.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
