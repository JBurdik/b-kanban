import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { BoardIcon } from "./BoardIcon";
import { useSessionToken } from "@/hooks/useSessionToken";

// Popular emojis for board icons
const EMOJI_OPTIONS = [
  // Objects & Work
  "📋", "📁", "📂", "📊", "📈", "💼", "🗂️", "📝",
  // Tech
  "💻", "🖥️", "⚙️", "🔧", "🛠️", "🔌", "💾", "🌐",
  // Creative
  "🎨", "✏️", "🖌️", "📐", "🎬", "🎮", "🎯", "💡",
  // Communication
  "📧", "💬", "📢", "📣", "🔔", "📞", "📱", "✉️",
  // Nature & Space
  "🌟", "⭐", "🚀", "🌙", "☀️", "🌈", "🔥", "⚡",
  // Symbols
  "✅", "❤️", "💎", "🏆", "🎖️", "🏅", "👑", "🎁",
];

interface BoardIconPickerProps {
  boardId: Id<"boards">;
  currentIcon?: {
    type?: "emoji" | "image";
    emoji?: string;
    url?: string | null;
  };
  boardName: string;
  onClose: () => void;
}

export function BoardIconPicker({
  boardId,
  currentIcon,
  boardName,
  onClose,
}: BoardIconPickerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const sessionToken = useSessionToken();
  const generateUploadUrl = useMutation(api.boards.generateIconUploadUrl);
  const saveIcon = useMutation(api.boards.saveIcon);
  const setEmojiIcon = useMutation(api.boards.setEmojiIcon);
  const removeIcon = useMutation(api.boards.removeIcon);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleEmojiSelect = async (emoji: string) => {
    try {
      await setEmojiIcon({ boardId, emoji, sessionToken });
      onClose();
    } catch (error) {
      console.error("Failed to set emoji icon:", error);
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be less than 2MB");
      return;
    }

    setIsUploading(true);

    try {
      // Get upload URL
      const uploadUrl = await generateUploadUrl({ boardId, sessionToken });

      // Upload file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();

      // Save icon
      await saveIcon({ boardId, storageId, sessionToken });

      onClose();
    } catch (error) {
      console.error("Failed to upload icon:", error);
      alert("Failed to upload icon. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveIcon = async () => {
    try {
      await removeIcon({ boardId, sessionToken });
      onClose();
    } catch (error) {
      console.error("Failed to remove icon:", error);
    }
  };

  const hasIcon = currentIcon?.type === "emoji" || currentIcon?.type === "image";

  return (
    <div
      ref={popoverRef}
      className="absolute left-0 top-full mt-2 w-72 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden"
    >
      {/* Current icon preview */}
      <div className="p-3 border-b border-dark-border flex items-center gap-3">
        <BoardIcon
          board={{
            name: boardName,
            iconType: currentIcon?.type,
            iconEmoji: currentIcon?.emoji,
            iconUrl: currentIcon?.url,
          }}
          size="lg"
        />
        <div className="flex-1">
          <p className="text-sm text-dark-text font-medium">Board Icon</p>
          <p className="text-xs text-dark-muted">
            {hasIcon ? "Click to change" : "Add an icon"}
          </p>
        </div>
        {hasIcon && (
          <button
            onClick={handleRemoveIcon}
            className="text-xs text-dark-muted hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {/* Upload section */}
      <div className="p-3 border-b border-dark-border">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-dark-bg hover:bg-dark-hover text-dark-text text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              Upload image
            </>
          )}
        </button>
        <p className="text-xs text-dark-muted mt-1 text-center">
          Max 2MB, JPG/PNG/GIF
        </p>
      </div>

      {/* Emoji grid */}
      <div className="p-3">
        <p className="text-xs text-dark-muted mb-2 font-medium">Or pick an emoji</p>
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleEmojiSelect(emoji)}
              className={`w-7 h-7 flex items-center justify-center text-lg rounded hover:bg-dark-hover transition-colors ${
                currentIcon?.emoji === emoji
                  ? "bg-accent/20 ring-1 ring-accent"
                  : ""
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
