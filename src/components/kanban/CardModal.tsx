import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { RichTextEditor } from "@/components/RichTextEditor";
import { AttachmentList } from "./AttachmentList";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PrioritySelector } from "@/components/ui/PrioritySelector";
import { useCardFormState } from "@/hooks/useCardFormState";
import { useEditorImageUpload } from "@/hooks/useEditorImageUpload";
import { AUTO_SAVE_DELAY } from "@/lib/constants";
import type { Card, Column, BoardMember } from "@/lib/types";

interface KanbanColumnWithCards extends Column {
  cards: Card[];
}

interface Props {
  card: Card;
  boardId: Id<"boards">;
  columns: KanbanColumnWithCards[];
  members?: BoardMember[];
  userEmail?: string;
  onClose: () => void;
}

export function CardModal({ card, columns, members = [], userEmail, onClose }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateCard = useMutation(api.cards.update);
  const deleteCard = useMutation(api.cards.remove);
  const { onImageUpload } = useEditorImageUpload(userEmail);

  // Use the new form state hook that tracks dirty fields and syncs with real-time updates
  const { values, setField, getDirtyFields, hasChanges, markSaved } = useCardFormState({
    serverData: {
      title: card.title,
      content: card.content || "",
      priority: card.priority,
      columnId: card.columnId,
      assigneeId: card.assignee?.id,
      effort: card.effort,
    },
  });

  // Auto-save with debounce - only save dirty fields
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasChanges) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const dirtyFields = getDirtyFields();

      if (Object.keys(dirtyFields).length === 0) {
        return;
      }

      setIsSaving(true);
      try {
        await updateCard({
          cardId: card._id,
          ...dirtyFields,
          currentUserEmail: userEmail,
        });
        markSaved();
      } finally {
        setIsSaving(false);
      }
    }, AUTO_SAVE_DELAY);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [values, hasChanges, getDirtyFields, card._id, updateCard, userEmail, markSaved]);

  const handleDelete = async () => {
    if (confirm("Delete this card?")) {
      setIsDeleting(true);
      try {
        await deleteCard({ cardId: card._id });
        onClose();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={card.slug} size="lg">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <input
            type="text"
            value={values.title}
            onChange={(e) => setField("title", e.target.value)}
            className="w-full bg-transparent text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 -mx-2"
            placeholder="Card title"
          />
        </div>

        {/* Status (column) selector */}
        <div>
          <label className="block text-sm text-dark-muted mb-2">Status</label>
          <select
            value={values.columnId}
            onChange={(e) => setField("columnId", e.target.value as Id<"columns">)}
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {columns.map((col) => (
              <option key={col._id} value={col._id}>
                {col.name}
              </option>
            ))}
          </select>
        </div>

        {/* Priority selector */}
        <div>
          <label className="block text-sm text-dark-muted mb-2">Priority</label>
          <PrioritySelector value={values.priority} onChange={(p) => setField("priority", p)} />
        </div>

        {/* Assignee selector */}
        <div>
          <label className="block text-sm text-dark-muted mb-2">Assignee</label>
          <select
            value={values.assigneeId || ""}
            onChange={(e) => setField("assigneeId", e.target.value ? (e.target.value as Id<"users">) : undefined)}
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Unassigned</option>
            {members.map(
              (member) =>
                member.user && (
                  <option key={member.userId} value={member.userId}>
                    {member.user.name} ({member.user.email})
                  </option>
                )
            )}
          </select>
        </div>

        {/* Time effort */}
        <div>
          <label className="block text-sm text-dark-muted mb-2">Time Effort (hours)</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={values.effort ?? ""}
            onChange={(e) => setField("effort", e.target.value ? parseFloat(e.target.value) : undefined)}
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., 2, 4, 8"
          />
        </div>

        {/* Description with rich text editor */}
        <div>
          <label className="block text-sm text-dark-muted mb-2">Description</label>
          <RichTextEditor
            content={values.content}
            onChange={(c) => setField("content", c)}
            placeholder="Add a description..."
            onImageUpload={onImageUpload}
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm text-dark-muted mb-2">Attachments</label>
          <AttachmentList cardId={card._id} />
        </div>
      </div>

      <ModalFooter className="justify-between">
        <Button variant="danger" onClick={handleDelete} loading={isDeleting}>
          Delete card
        </Button>
        <div className="flex items-center gap-2">
          {isSaving && <span className="text-dark-muted text-sm">Saving...</span>}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
