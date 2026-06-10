import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useConvexUser } from "@/hooks/useConvexUser";

interface Props {
  selectedCardIds: Set<Id<"cards">>;
  selectedCount: number;
  onClearSelection: () => void;
  boardId: Id<"boards">;
}

export function BulkActionBar({
  selectedCardIds,
  selectedCount,
  onClearSelection,
  boardId,
}: Props) {
  const { userEmail } = useConvexUser();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [labelRemoveMode, setLabelRemoveMode] = useState(false);

  const versions = useQuery(api.versions.list, { boardId, userEmail });
  const labels = useQuery(api.labels.list, { boardId, userEmail });

  const bulkUpdatePriority = useMutation(api.cards.bulkUpdatePriority);
  const bulkArchive = useMutation(api.cards.bulkArchive);
  const bulkDelete = useMutation(api.cards.bulkDelete);
  const bulkSetVersion = useMutation(api.cards.bulkSetVersion);
  const bulkAddLabel = useMutation(api.labels.bulkAddToCards);
  const bulkRemoveLabel = useMutation(api.labels.bulkRemoveFromCards);

  const cardIds = Array.from(selectedCardIds);

  const handlePriority = async (priority: "low" | "medium" | "high") => {
    await bulkUpdatePriority({ cardIds, priority });
    setShowPriorityDropdown(false);
    onClearSelection();
  };

  const handleArchive = async () => {
    await bulkArchive({ cardIds });
    onClearSelection();
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await bulkDelete({ cardIds });
      setShowDeleteConfirm(false);
      onClearSelection();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVersion = async (versionId: Id<"versions"> | undefined) => {
    await bulkSetVersion({ cardIds, versionId });
    setShowVersionDropdown(false);
    onClearSelection();
  };

  const handleLabelClick = async (labelId: Id<"labels">) => {
    if (!userEmail) return;
    if (labelRemoveMode) {
      await bulkRemoveLabel({ cardIds, labelId, userEmail });
    } else {
      await bulkAddLabel({ cardIds, labelId, userEmail });
    }
    setShowLabelDropdown(false);
    onClearSelection();
  };

  return (
    <>
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-dark-surface border border-dark-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
        {/* Selection count */}
        <span className="text-sm font-medium text-dark-text whitespace-nowrap">
          {selectedCount} card{selectedCount !== 1 ? "s" : ""} selected
        </span>

        <div className="w-px h-6 bg-dark-border" />

        {/* Priority dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowPriorityDropdown(!showPriorityDropdown);
              setShowVersionDropdown(false);
              setShowLabelDropdown(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Priority
          </button>
          {showPriorityDropdown && (
            <div className="absolute bottom-full mb-2 left-0 bg-dark-surface border border-dark-border rounded-lg shadow-xl py-1 min-w-[120px]">
              <button
                onClick={() => handlePriority("low")}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-dark-hover transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Low
              </button>
              <button
                onClick={() => handlePriority("medium")}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-dark-hover transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                Medium
              </button>
              <button
                onClick={() => handlePriority("high")}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-dark-hover transition-colors flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-red-400" />
                High
              </button>
            </div>
          )}
        </div>

        {/* Version dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowVersionDropdown(!showVersionDropdown);
              setShowPriorityDropdown(false);
              setShowLabelDropdown(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Version
          </button>
          {showVersionDropdown && (
            <div className="absolute bottom-full mb-2 left-0 bg-dark-surface border border-dark-border rounded-lg shadow-xl py-1 min-w-[140px] max-h-48 overflow-y-auto">
              <button
                onClick={() => handleVersion(undefined)}
                className="w-full px-3 py-1.5 text-sm text-left hover:bg-dark-hover transition-colors text-dark-muted"
              >
                No version
              </button>
              {versions?.map((version) => (
                <button
                  key={version._id}
                  onClick={() => handleVersion(version._id)}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-dark-hover transition-colors"
                >
                  {version.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Label dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowLabelDropdown(!showLabelDropdown);
              setShowPriorityDropdown(false);
              setShowVersionDropdown(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Labels
          </button>
          {showLabelDropdown && (
            <div className="absolute bottom-full mb-2 left-0 bg-dark-surface border border-dark-border rounded-lg shadow-xl py-1 min-w-[180px] max-h-48 overflow-y-auto">
              {/* Toggle add/remove mode */}
              <div className="px-3 py-1.5 border-b border-dark-border flex items-center gap-2">
                <button
                  onClick={() => setLabelRemoveMode(false)}
                  className={`text-xs px-2 py-0.5 rounded ${!labelRemoveMode ? "bg-accent text-white" : "text-dark-muted hover:text-dark-text"}`}
                >
                  Add
                </button>
                <button
                  onClick={() => setLabelRemoveMode(true)}
                  className={`text-xs px-2 py-0.5 rounded ${labelRemoveMode ? "bg-red-500 text-white" : "text-dark-muted hover:text-dark-text"}`}
                >
                  Remove
                </button>
              </div>
              {labels?.map((label) => (
                <button
                  key={label._id}
                  onClick={() => handleLabelClick(label._id)}
                  className="w-full px-3 py-1.5 text-sm text-left hover:bg-dark-hover transition-colors flex items-center gap-2"
                >
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span style={{ color: label.textColor || undefined }}>{label.name}</span>
                </button>
              ))}
              {(!labels || labels.length === 0) && (
                <div className="px-3 py-2 text-sm text-dark-muted">No labels</div>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-dark-border" />

        {/* Archive button */}
        <button
          onClick={handleArchive}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-muted hover:text-yellow-400 hover:bg-dark-hover rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          Archive
        </button>

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-muted hover:text-red-400 hover:bg-dark-hover rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>

        <div className="w-px h-6 bg-dark-border" />

        {/* Deselect All */}
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Deselect All
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Cards"
        message={`Are you sure you want to permanently delete ${selectedCount} card${selectedCount !== 1 ? "s" : ""}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={isDeleting}
      />
    </>
  );
}
