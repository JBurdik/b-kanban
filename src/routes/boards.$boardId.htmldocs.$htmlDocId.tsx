import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useState } from "react";

export const Route = createFileRoute("/boards/$boardId/htmldocs/$htmlDocId")({
  component: HtmlDocViewerPage,
});

function HtmlDocViewerPage() {
  const { boardId, htmlDocId } = Route.useParams();
  const { isLoading, session } = useConvexUser();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const doc = useQuery(
    api.htmlDocs.get,
    session ? { docId: htmlDocId as Id<"htmlDocs"> } : "skip",
  );

  const renameDoc = useMutation(api.htmlDocs.rename);
  const deleteDoc = useMutation(api.htmlDocs.remove);

  const handleRename = async () => {
    if (!newTitle.trim()) return;
    await renameDoc({
      docId: htmlDocId as Id<"htmlDocs">,
      title: newTitle.trim(),
    });
    setIsRenaming(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this HTML doc?"))
      return;
    await deleteDoc({ docId: htmlDocId as Id<"htmlDocs"> });
    window.location.href = `/boards/${boardId}/htmldocs`;
  };

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

  if (doc === null) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)]">
        <h1 className="text-xl font-medium text-dark-muted mb-4">
          HTML doc not found
        </h1>
        <Link
          to="/boards/$boardId/htmldocs"
          params={{ boardId }}
          className="text-accent hover:underline"
        >
          Back to HTML Docs
        </Link>
      </div>
    );
  }

  if (doc === undefined) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border bg-dark-surface">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            to="/boards/$boardId/htmldocs"
            params={{ boardId }}
            className="text-dark-muted hover:text-dark-text transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          {isRenaming ? (
            <input
              type="text"
              value={newTitle}
              autoFocus
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              onBlur={handleRename}
              className="text-lg font-semibold bg-dark-bg border border-dark-border rounded px-2 py-1 outline-none focus:ring-2 focus:ring-accent"
            />
          ) : (
            <button
              onClick={() => {
                setNewTitle(doc.title);
                setIsRenaming(true);
              }}
              className="text-lg font-semibold truncate hover:text-accent transition-colors"
              title="Click to rename"
            >
              {doc.title}
            </button>
          )}
          <span className="text-xs text-dark-muted font-mono truncate hidden sm:inline">
            {doc.fileName}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {doc.url && (
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-dark-muted hover:text-dark-text transition-colors"
              title="Open in new tab"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
          <button
            onClick={handleDelete}
            className="p-2 text-dark-muted hover:text-red-500 transition-colors"
            title="Delete HTML doc"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sandboxed render */}
      <div className="flex-1 bg-white">
        {doc.url ? (
          <iframe
            src={doc.url}
            title={doc.title}
            className="w-full h-full border-0"
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-dark-muted">
            Content unavailable
          </div>
        )}
      </div>
    </div>
  );
}
