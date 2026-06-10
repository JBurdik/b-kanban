import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useSessionToken } from "@/hooks/useSessionToken";

const EMOJI_OPTIONS = ["👍", "👎", "❤️", "😄", "🎉", "👀", "✅"];

interface Props {
  commentId: Id<"comments">;
  currentUserId: Id<"users"> | undefined;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

export function CommentReactions({ commentId, currentUserId }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const sessionToken = useSessionToken();
  const reactions = useQuery(api.commentReactions.listByComment, { commentId });
  const toggleReaction = useMutation(api.commentReactions.toggle);

  // Close picker on click outside
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  if (!reactions) return null;

  // Group reactions by emoji
  const grouped: GroupedReaction[] = [];
  const emojiMap = new Map<string, { users: string[]; hasReacted: boolean }>();

  for (const r of reactions) {
    const entry = emojiMap.get(r.emoji);
    if (entry) {
      entry.users.push(r.userName);
      if (currentUserId && r.userId === currentUserId) {
        entry.hasReacted = true;
      }
    } else {
      emojiMap.set(r.emoji, {
        users: [r.userName],
        hasReacted: !!(currentUserId && r.userId === currentUserId),
      });
    }
  }

  for (const [emoji, data] of emojiMap) {
    grouped.push({
      emoji,
      count: data.users.length,
      users: data.users,
      hasReacted: data.hasReacted,
    });
  }

  const handleToggle = (emoji: string) => {
    if (!currentUserId) return;
    toggleReaction({ commentId, emoji, sessionToken });
    setPickerOpen(false);
  };

  if (grouped.length === 0 && !currentUserId) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5 relative">
      {grouped.map((g) => (
        <button
          key={g.emoji}
          onClick={() => handleToggle(g.emoji)}
          title={g.users.join(", ")}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors
            ${
              g.hasReacted
                ? "border border-accent bg-accent/10 text-dark-text"
                : "border border-dark-border bg-dark-surface text-dark-muted hover:bg-dark-hover"
            }`}
        >
          <span>{g.emoji}</span>
          <span>{g.count}</span>
        </button>
      ))}

      {currentUserId && (
        <div ref={pickerRef} className="relative">
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-dark-border bg-dark-surface text-dark-muted hover:bg-dark-hover text-xs transition-colors"
            title="Add reaction"
          >
            +
          </button>

          {pickerOpen && (
            <div className="absolute bottom-full mb-1 left-0 flex items-center gap-0.5 bg-dark-surface border border-dark-border rounded-lg px-1.5 py-1 shadow-lg z-50">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleToggle(emoji)}
                  className="hover:bg-dark-hover rounded p-1 text-sm transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
