import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { useConvexUser } from "@/hooks/useConvexUser";

interface Props {
  cardId: Id<"cards">;
  boardId: Id<"boards">;
  canEdit: boolean;
}

export function LinkedDocuments({ cardId, boardId, canEdit }: Props) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { session } = useConvexUser();

  const linkedDocs = useQuery(api.documentLinks.listByCard, { cardId });

  const searchResults = useQuery(
    api.documents.search,
    isSearching && searchQuery.length > 0 && session
      ? { boardId, query: searchQuery }
      : "skip"
  );

  const linkDocument = useMutation(api.documentLinks.link);
  const unlinkDocument = useMutation(api.documentLinks.unlink);

  const handleLink = async (documentId: Id<"documents">) => {
    try {
      await linkDocument({ cardId, documentId });
      setIsSearching(false);
      setSearchQuery("");
    } catch (error) {
      console.error("Failed to link document:", error);
    }
  };

  const handleUnlink = async (documentId: Id<"documents">) => {
    try {
      await unlinkDocument({ cardId, documentId });
    } catch (error) {
      console.error("Failed to unlink document:", error);
    }
  };

  // Filter out already linked documents from search results
  const filteredResults = searchResults?.filter(
    (doc) => !linkedDocs?.some((linked) => linked && linked._id === doc._id)
  );

  return (
    <div className="space-y-2">
      {/* Linked documents list */}
      {linkedDocs && linkedDocs.filter(Boolean).length > 0 ? (
        <div className="space-y-1">
          {linkedDocs.filter((doc): doc is NonNullable<typeof doc> => doc !== null).map((doc) => (
            <div
              key={doc._id}
              className="flex items-center gap-2 group"
            >
              <Link
                to="/boards/$boardId/docs/$docId"
                params={{ boardId, docId: doc._id }}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm bg-dark-bg rounded hover:bg-dark-hover transition-colors min-w-0"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0 text-dark-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="truncate">{doc.title}</span>
              </Link>
              {canEdit && (
                <button
                  onClick={() => handleUnlink(doc._id)}
                  className="p-1 text-dark-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Unlink document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-dark-muted">No linked documents</p>
      )}

      {/* Link document button/search */}
      {canEdit && (
        <div className="relative">
          {isSearching ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documents..."
                  className="flex-1 px-2 py-1.5 text-sm bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsSearching(false);
                      setSearchQuery("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    setIsSearching(false);
                    setSearchQuery("");
                  }}
                  className="p-1 text-dark-muted hover:text-dark-text"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search results */}
              {filteredResults && filteredResults.length > 0 ? (
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {filteredResults.map((doc) => (
                    <button
                      key={doc._id}
                      onClick={() => handleLink(doc._id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left bg-dark-bg rounded hover:bg-dark-hover transition-colors"
                    >
                      <svg
                        className="w-4 h-4 flex-shrink-0 text-dark-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="truncate">{doc.title}</span>
                    </button>
                  ))}
                </div>
              ) : searchQuery.length > 0 ? (
                <p className="text-xs text-dark-muted px-2">No documents found</p>
              ) : null}
            </div>
          ) : (
            <button
              onClick={() => setIsSearching(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-sm text-dark-muted hover:text-dark-text hover:bg-dark-hover border border-dashed border-dark-border rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Link Document
            </button>
          )}
        </div>
      )}
    </div>
  );
}
