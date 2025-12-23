import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import { CommentEditor } from "./CommentEditor";
import { extractMentionedUserIds } from "@/utils/mentions";

interface Props {
  cardId: Id<"cards">;
  boardId: Id<"boards">;
  userEmail?: string;
  readOnly?: boolean;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Check if content is HTML (rich text) or plain text
function isHtmlContent(content: string): boolean {
  return content.startsWith("<") && content.includes(">");
}

export function CommentList({ cardId, boardId, userEmail, readOnly = false }: Props) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<Id<"comments"> | null>(null);
  const [editContent, setEditContent] = useState("");

  const comments = useQuery(api.comments.list, { cardId });
  const createComment = useMutation(api.comments.create);
  const updateComment = useMutation(api.comments.update);
  const deleteComment = useMutation(api.comments.remove);
  const searchMembers = useQuery(api.members.search, { boardId, query: "" });

  // Mention search callback
  const handleMentionSearch = useCallback(async (query: string) => {
    // Search board members by query
    const members = searchMembers || [];
    const queryLower = query.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(queryLower) ||
      m.email.toLowerCase().includes(queryLower)
    ).slice(0, 5);
  }, [searchMembers]);

  // Check if content has actual text (not just empty HTML tags)
  const hasContent = (html: string): boolean => {
    const text = html.replace(/<[^>]*>/g, "").trim();
    return text.length > 0;
  };

  const handleSubmit = async () => {
    if (!hasContent(newComment) || !userEmail) return;

    setIsSubmitting(true);
    try {
      // Extract mentioned user IDs from the HTML content
      const mentionedUserIds = extractMentionedUserIds(newComment) as Id<"users">[];

      await createComment({
        cardId,
        content: newComment,
        authorEmail: userEmail,
        mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
      });
      setNewComment("");
    } catch (err) {
      console.error("Failed to create comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (commentId: Id<"comments">) => {
    if (!hasContent(editContent)) return;

    try {
      await updateComment({
        commentId,
        content: editContent,
      });
      setEditingId(null);
      setEditContent("");
    } catch (err) {
      console.error("Failed to update comment:", err);
    }
  };

  const handleDelete = async (commentId: Id<"comments">) => {
    if (!confirm("Delete this comment?")) return;

    try {
      await deleteComment({ commentId });
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const startEditing = (commentId: Id<"comments">, content: string) => {
    setEditingId(commentId);
    setEditContent(content);
  };

  if (comments === undefined) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-16 bg-dark-bg rounded" />
        <div className="h-16 bg-dark-bg rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Comment list */}
      {comments.length === 0 ? (
        <p className="text-dark-muted text-sm text-center py-4">No comments yet</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div
              key={comment._id}
              className="bg-dark-bg rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar
                    name={comment.author?.name || "Unknown"}
                    id={comment.author?.id}
                    size="sm"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      {comment.author?.name || "Unknown"}
                    </span>
                    <span className="text-xs text-dark-muted ml-2">
                      {formatTimeAgo(comment.createdAt)}
                      {comment.updatedAt > comment.createdAt && " (edited)"}
                    </span>
                  </div>
                </div>
                {!readOnly && comment.author?.email === userEmail && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEditing(comment._id, comment.content)}
                      className="text-dark-muted hover:text-dark-text p-1"
                      title="Edit"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(comment._id)}
                      className="text-dark-muted hover:text-red-400 p-1"
                      title="Delete"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {editingId === comment._id ? (
                <div className="mt-2 space-y-2">
                  <CommentEditor
                    content={editContent}
                    onChange={setEditContent}
                    onSubmit={() => handleUpdate(comment._id)}
                    onMentionSearch={handleMentionSearch}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(comment._id)}
                      className="btn-primary text-xs py-1 px-2"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditContent("");
                      }}
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  {isHtmlContent(comment.content) ? (
                    <div
                      className="comment-content text-sm text-dark-text"
                      dangerouslySetInnerHTML={{ __html: comment.content }}
                    />
                  ) : (
                    <p className="text-sm text-dark-text whitespace-pre-wrap">
                      {comment.content}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      {!readOnly && userEmail && (
        <div className="space-y-2">
          <CommentEditor
            content={newComment}
            onChange={setNewComment}
            onSubmit={handleSubmit}
            onMentionSearch={handleMentionSearch}
            placeholder="Write a comment... (use '/' for formatting, '@' for mentions)"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !hasContent(newComment)}
              className="btn-primary text-sm py-1.5 px-3"
            >
              {isSubmitting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </div>
      )}

      {/* Comment content styles */}
      <style>{`
        .comment-content p { margin: 0.25em 0; }
        .comment-content p:first-child { margin-top: 0; }
        .comment-content p:last-child { margin-bottom: 0; }
        .comment-content ul, .comment-content ol { padding-left: 1.5em; margin: 0.25em 0; }
        .comment-content li { margin: 0.15em 0; }
        .comment-content code { background: #2a2a2a; padding: 0.1em 0.3em; border-radius: 0.2em; font-size: 0.85em; }
        .comment-content pre { background: #2a2a2a; padding: 0.5em 0.75em; border-radius: 0.4em; margin: 0.25em 0; overflow-x: auto; font-size: 0.85em; }
        .comment-content pre code { background: none; padding: 0; }
        .comment-content blockquote { border-left: 2px solid #3b82f6; padding-left: 0.75em; margin: 0.25em 0; color: #888; }
        .comment-content .mention {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          padding: 0.1em 0.3em;
          border-radius: 0.25em;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
