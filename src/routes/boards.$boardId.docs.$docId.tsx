import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useConvexUser } from "@/hooks/useConvexUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useState, useEffect, useCallback } from "react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useEditorImageUpload } from "@/hooks/useEditorImageUpload";

export const Route = createFileRoute("/boards/$boardId/docs/$docId")({
  component: DocumentEditorPage,
});

function DocumentEditorPage() {
  const { boardId, docId } = Route.useParams();
  const { isLoading, session } = useConvexUser();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const { onImageUpload } = useEditorImageUpload();

  const document = useQuery(api.documents.get, {
    documentId: docId as Id<"documents">,
  });

  const updateDocument = useMutation(api.documents.update);
  const deleteDocument = useMutation(api.documents.remove);

  // Initialize state when document loads
  useEffect(() => {
    if (document && !isInitialized) {
      setTitle(document.title);
      setContent(document.content || "");
      setIsInitialized(true);
    }
  }, [document, isInitialized]);

  const handleSave = useCallback(
    async (data: { title: string; content: string }) => {
      await updateDocument({
        documentId: docId as Id<"documents">,
        title: data.title,
        content: data.content,
      });
    },
    [updateDocument, docId],
  );

  const { isSaving, hasChanges } = useAutoSave({
    data: { title, content },
    originalData: {
      title: document?.title || "",
      content: document?.content || "",
    },
    onSave: handleSave,
    enabled: isInitialized && !!document,
  });

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this document?"))
      return;

    try {
      await deleteDocument({
        documentId: docId as Id<"documents">,
      });
      window.location.href = `/boards/${boardId}/docs`;
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
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

  if (document === null) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)]">
        <h1 className="text-xl font-medium text-dark-muted mb-4">
          Document not found
        </h1>
        <Link
          to="/boards/$boardId/docs"
          params={{ boardId }}
          className="text-accent hover:underline"
        >
          Back to Documents
        </Link>
      </div>
    );
  }

  if (document === undefined) {
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
        <div className="flex items-center gap-4">
          <Link
            to="/boards/$boardId/docs"
            params={{ boardId }}
            className="text-dark-muted hover:text-dark-text transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div className="flex items-center gap-2 text-sm text-dark-muted">
            {isSaving ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-accent border-t-transparent rounded-full" />
                <span>Saving...</span>
              </>
            ) : hasChanges ? (
              <>
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span>Unsaved changes</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Saved</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            className="p-2 text-dark-muted hover:text-red-500 transition-colors"
            title="Delete document"
          >
            <svg
              className="w-5 h-5"
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
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {/* Title input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder-dark-muted mb-6"
          />

          {/* Rich text editor */}
          <RichTextEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing..."
            onImageUpload={onImageUpload}
          />

          {/* Linked cards section */}
          {document.linkedCards &&
            document.linkedCards.filter(Boolean).length > 0 && (
              <div className="mt-8 pt-6 border-t border-dark-border">
                <h3 className="text-sm font-medium text-dark-muted mb-3">
                  Linked Cards
                </h3>
                <div className="flex flex-wrap gap-2">
                  {document.linkedCards
                    .filter(
                      (card): card is NonNullable<typeof card> => card !== null,
                    )
                    .map((card) => (
                      <Link
                        key={card.id}
                        to="/boards/$boardId/cards/$cardSlug"
                        params={{ boardId, cardSlug: card.slug }}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-sm hover:border-accent/50 transition-colors"
                      >
                        <span className="text-accent font-mono text-xs">
                          {card.slug}
                        </span>
                        <span className="truncate max-w-[200px]">
                          {card.title}
                        </span>
                      </Link>
                    ))}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
