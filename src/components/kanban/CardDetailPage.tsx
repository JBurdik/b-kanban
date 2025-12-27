import { useState, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useAutoSave } from "@/hooks/useAutoSave";
import { canEdit as checkCanEdit } from "@/lib/permissions";
import type {
  Card,
  Column,
  BoardMember,
  BoardRole,
  Priority,
} from "@/lib/types";
import { CardHeader } from "./CardHeader";
import { CardContent } from "./CardContent";
import { CardSidebar } from "./CardSidebar";
import { CardMobileDetails } from "./CardMobileDetails";

interface CardWithColumn extends Card {
  column: {
    id: Id<"columns">;
    name: string;
  };
}

interface Board {
  _id: Id<"boards">;
  name: string;
  columns?: Column[];
  members?: BoardMember[];
  userRole?: BoardRole;
}

interface Props {
  card: CardWithColumn;
  board: Board;
  userEmail?: string;
}

interface CardData {
  title: string;
  content: string;
  priority: Priority;
  columnId: Id<"columns">;
  assigneeId?: Id<"users">;
  effort?: number;
}

export function CardDetailPage({ card, board, userEmail }: Props) {
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content || "");
  const [priority, setPriority] = useState(card.priority);
  const [columnId, setColumnId] = useState(card.columnId);
  const [assigneeId, setAssigneeId] = useState<Id<"users"> | undefined>(
    card.assignee?.id,
  );
  const [effort, setEffort] = useState<number | undefined>(card.effort);

  const updateCard = useMutation(api.cards.update);
  const searchMembers = useQuery(api.members.search, {
    boardId: board._id,
    query: "",
  });

  const canEdit = checkCanEdit(board.userRole);
  const columns = board.columns || [];
  const members = board.members || [];

  // Use auto-save hook
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
    [card._id, updateCard, userEmail],
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

  // Mention search callback
  const handleMentionSearch = useCallback(
    async (query: string) => {
      const allMembers = searchMembers || [];
      const queryLower = query.toLowerCase();
      return allMembers
        .filter(
          (m) =>
            m.name.toLowerCase().includes(queryLower) ||
            m.email.toLowerCase().includes(queryLower),
        )
        .slice(0, 5);
    },
    [searchMembers],
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-dark-bg">
      <CardHeader
        boardId={board._id}
        boardName={board.name}
        cardSlug={card.slug}
        priority={card.priority}
        isSaving={isSaving}
      />

      {/* Mobile details section */}
      <CardMobileDetails
        columnId={columnId}
        priority={priority}
        assigneeId={assigneeId}
        effort={effort}
        currentColumn={card.column}
        currentAssignee={card.assignee}
        columns={columns}
        members={members}
        canEdit={canEdit}
        onColumnChange={setColumnId}
        onPriorityChange={setPriority}
        onAssigneeChange={setAssigneeId}
        onEffortChange={setEffort}
      />

      <div className="flex-1 flex overflow-hidden">
        <CardContent
          cardId={card._id}
          boardId={board._id}
          title={title}
          content={content}
          canEdit={canEdit}
          userEmail={userEmail}
          onTitleChange={setTitle}
          onContentChange={setContent}
          onMentionSearch={handleMentionSearch}
        />

        <CardSidebar
          columnId={columnId}
          priority={priority}
          assigneeId={assigneeId}
          effort={effort}
          dueDate={card.dueDate}
          currentColumn={card.column}
          currentAssignee={card.assignee}
          columns={columns}
          members={members}
          canEdit={canEdit}
          onColumnChange={setColumnId}
          onPriorityChange={setPriority}
          onAssigneeChange={setAssigneeId}
          onEffortChange={setEffort}
        />
      </div>
    </div>
  );
}
