import { useState } from "react";
import type { Id } from "convex/_generated/dataModel";
import { RichTextEditor } from "@/components/RichTextEditor";
import { AttachmentList } from "./AttachmentList";
import { CommentList } from "./CommentList";
import { HistoryList } from "./HistoryList";
import { useEditorImageUpload } from "@/hooks/useEditorImageUpload";

interface MentionUser {
  id: Id<"users">;
  name: string;
  email: string;
  image?: string;
}

interface Props {
  cardId: Id<"cards">;
  boardId: Id<"boards">;
  title: string;
  content: string;
  canEdit: boolean;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onMentionSearch: (query: string) => Promise<MentionUser[]>;
  onBlur?: () => void;
}

export function CardContent({
  cardId,
  boardId,
  title,
  content,
  canEdit,
  onTitleChange,
  onContentChange,
  onMentionSearch,
  onBlur,
}: Props) {
  const { onImageUpload } = useEditorImageUpload();
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Title */}
      <div className="mb-6">
        {canEdit ? (
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="bg-transparent text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-accent rounded px-2 -mx-2 w-full"
            placeholder="Card title"
          />
        ) : (
          <h1 className="text-2xl font-semibold">{title}</h1>
        )}
      </div>

      {/* Description */}
      <div className="mb-8">
        <SectionHeader icon="description">Description</SectionHeader>
        {canEdit ? (
          <RichTextEditor
            content={content}
            onChange={onContentChange}
            onMentionSearch={onMentionSearch}
            onImageUpload={onImageUpload}
            onBlur={onBlur}
            placeholder="Add a description..."
          />
        ) : content ? (
          <div
            className="rich-content bg-dark-surface border border-dark-border rounded-lg p-4"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <p className="text-dark-muted text-sm italic">No description added yet</p>
        )}
      </div>

      {/* Attachments */}
      <div className="mb-8">
        <SectionHeader icon="attachment">Attachments</SectionHeader>
        <AttachmentList cardId={cardId} readOnly={!canEdit} />
      </div>

      {/* Comments / History tabs */}
      <div>
        <div className="flex items-center gap-1 border-b border-dark-border mb-4">
          <TabButton active={activeTab === "comments"} onClick={() => setActiveTab("comments")}>
            Comments
          </TabButton>
          <TabButton active={activeTab === "history"} onClick={() => setActiveTab("history")}>
            History
          </TabButton>
        </div>
        {activeTab === "comments" ? (
          <CommentList cardId={cardId} boardId={boardId} readOnly={!canEdit} />
        ) : (
          <HistoryList cardId={cardId} />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-2 text-sm font-medium -mb-px border-b-2 transition-colors " +
        (active
          ? "border-accent text-dark-text"
          : "border-transparent text-dark-muted hover:text-dark-text")
      }
    >
      {children}
    </button>
  );
}

function SectionHeader({ icon, children }: { icon: string; children: React.ReactNode }) {
  const icons: Record<string, React.ReactNode> = {
    description: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    ),
    attachment: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    ),
    comment: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    ),
  };

  return (
    <h2 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3 flex items-center gap-2">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icons[icon]}
      </svg>
      {children}
    </h2>
  );
}
