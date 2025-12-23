import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";

interface Props {
  cardId: Id<"cards">;
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

export function CommentList({ cardId, userEmail, readOnly = false }: Props) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<Id<"comments"> | null>(null);
  const [editContent, setEditContent] = useState("");

  const comments = useQuery(api.comments.list, { cardId });
  const createComment = useMutation(api.comments.create);
  const updateComment = useMutation(api.comments.update);
  const deleteComment = useMutation(api.comments.remove);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !userEmail) return;

    setIsSubmitting(true);
    try {
      await createComment({
        cardId,
        content: newComment.trim(),
        authorEmail: userEmail,
      });
      setNewComment("");
    } catch (err) {
      console.error("Failed to create comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (commentId: Id<"comments">) => {
    if (!editContent.trim()) return;

    try {
      await updateComment({
        commentId,
        content: editContent.trim(),
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
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="input w-full text-sm resize-none"
                    rows={2}
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
                <p className="text-sm text-dark-text mt-2 whitespace-pre-wrap">
                  {comment.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      {!readOnly && userEmail && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="input w-full text-sm resize-none"
            rows={2}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="btn-primary text-sm py-1.5 px-3"
            >
              {isSubmitting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
