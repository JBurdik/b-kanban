import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { RichTextEditor } from "@/components/RichTextEditor";
import { AttachmentList } from "./AttachmentList";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PrioritySelector } from "@/components/ui/PrioritySelector";
import { useAutoSave } from "@/hooks/useAutoSave";
import type { Card, Column, BoardMember, Priority } from "@/lib/types";

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

interface CardData {
  title: string;
  content: string;
  priority: Priority;
  columnId: Id<"columns">;
  assigneeId?: Id<"users">;
  effort?: number;
}

export function CardModal({ card, columns, members = [], userEmail, onClose }: Props) {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content || "");
  const [priority, setPriority] = useState<Priority>(card.priority);
  const [columnId, setColumnId] = useState(card.columnId);
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | undefined>(card.assignee?.id);
  const [effort, setEffort] = useState<number | undefined>(card.effort);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateCard = useMutation(api.cards.update);
  const deleteCard = useMutation(api.cards.remove);

  const handleSave = useCallback(
    async (data: CardData) => {
      await updateCard({
        cardId: card._id,
        title: data.title,
        content: data.content,
        priority: data.priority,
        columnId: data.columnId,
        assigneeId: data.assigneeId,
        effort: data.effort,
        currentUserEmail: userEmail,
      });
    },
    [card._id, updateCard, userEmail]
  );

  const { isSaving } = useAutoSave({
    data: { title, content, priority, columnId, assigneeId, effort },
    originalData: {
      title: card.title,
      content: card.content || "",
      priority: card.priority,
      columnId: card.columnId,
      assigneeId: card.assignee?.id,
      effort: card.effort,
    },
    onSave: handleSave,
  });

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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 -mx-2"
            placeholder="Card title"
          />
        </div>

        {/* Status (column) selector */}
        <div>
          <label className="block text-sm text-dark-muted mb-2">Status</label>
          <select
            value={columnId}
            onChange={(e) => setColumnId(e.target.value as Id<"columns">)}
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
          <PrioritySelector value={priority} onChange={setPriority} />
        </div>

        {/* Assignee selector */}
        <div>
          <label className="block text-sm text-dark-muted mb-2">Assignee</label>
          <select
            value={assigneeId || ""}
            onChange={(e) => setAssigneeId(e.target.value ? (e.target.value as Id<"users">) : undefined)}
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
            value={effort ?? ""}
            onChange={(e) => setEffort(e.target.value ? parseFloat(e.target.value) : undefined)}
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="e.g., 2, 4, 8"
          />
        </div>

        {/* Description with rich text editor */}
        <div>
          <label className="block text-sm text-dark-muted mb-2">Description</label>
          <RichTextEditor content={content} onChange={setContent} placeholder="Add a description..." />
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
