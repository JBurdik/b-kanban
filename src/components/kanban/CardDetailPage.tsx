import { useState, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useCardFormState } from "@/hooks/useCardFormState";
import { useSessionToken } from "@/hooks/useSessionToken";
import { AUTO_SAVE_DELAY } from "@/lib/constants";
import { canEdit as checkCanEdit } from "@/lib/permissions";
import type {
  Card,
  Column,
  BoardMember,
  BoardRole,
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
}

export function CardDetailPage({ card, board }: Props) {
  const [isSaving, setIsSaving] = useState(false);

  const sessionToken = useSessionToken();
  const updateCard = useMutation(api.cards.update);
  const searchMembers = useQuery(api.members.search, {
    boardId: board._id,
    query: "",
  });
  const boardVersions = useQuery(
    api.versions.list,
    sessionToken ? { boardId: board._id, sessionToken } : "skip"
  );

  const canEdit = checkCanEdit(board.userRole);
  const columns = board.columns || [];
  const members = board.members || [];

  // Use the new form state hook that tracks dirty fields and syncs with real-time updates
  const { values, setField, getDirtyFields, hasChanges, markSaved } = useCardFormState({
    serverData: {
      title: card.title,
      content: card.content || "",
      priority: card.priority,
      type: card.type,
      columnId: card.columnId,
      assigneeId: card.assignee?.id,
      versionId: card.versionId,
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
          sessionToken,
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
  }, [values, hasChanges, getDirtyFields, card._id, updateCard, markSaved, sessionToken]);

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
        columnId={values.columnId}
        priority={values.priority}
        assigneeId={values.assigneeId}
        effort={values.effort}
        currentColumn={card.column}
        currentAssignee={card.assignee}
        reporter={card.reporter}
        columns={columns}
        members={members}
        canEdit={canEdit}
        onColumnChange={(v) => setField("columnId", v)}
        onPriorityChange={(v) => setField("priority", v)}
        onAssigneeChange={(v) => setField("assigneeId", v)}
        onEffortChange={(v) => setField("effort", v)}
      />

      <div className="flex-1 flex overflow-hidden">
        <CardContent
          cardId={card._id}
          boardId={board._id}
          title={values.title}
          content={values.content}
          canEdit={canEdit}
          onTitleChange={(v) => setField("title", v)}
          onContentChange={(v) => setField("content", v)}
          onMentionSearch={handleMentionSearch}
        />

        <CardSidebar
          columnId={values.columnId}
          priority={values.priority}
          type={values.type}
          versionId={values.versionId}
          versions={boardVersions || []}
          assigneeId={values.assigneeId}
          effort={values.effort}
          dueDate={card.dueDate}
          currentColumn={card.column}
          currentAssignee={card.assignee}
          reporter={card.reporter}
          columns={columns}
          members={members}
          canEdit={canEdit}
          onColumnChange={(v) => setField("columnId", v)}
          onPriorityChange={(v) => setField("priority", v)}
          onTypeChange={(v) => setField("type", v)}
          onVersionChange={(v) => setField("versionId", v)}
          onAssigneeChange={(v) => setField("assigneeId", v)}
          onEffortChange={(v) => setField("effort", v)}
          cardId={card._id}
          cardTitle={values.title}
          boardId={board._id}
        />
      </div>
    </div>
  );
}
