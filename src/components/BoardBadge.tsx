import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useSessionToken } from "@/hooks/useSessionToken";

// Badge color palette: key -> tailwind classes
export const BADGE_COLORS: Record<string, string> = {
  gray: "bg-gray-500/20 text-gray-300 ring-1 ring-gray-500/40",
  red: "bg-red-500/20 text-red-300 ring-1 ring-red-500/40",
  orange: "bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/40",
  amber: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40",
  green: "bg-green-500/20 text-green-300 ring-1 ring-green-500/40",
  teal: "bg-teal-500/20 text-teal-300 ring-1 ring-teal-500/40",
  blue: "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40",
  indigo: "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40",
  purple: "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40",
  pink: "bg-pink-500/20 text-pink-300 ring-1 ring-pink-500/40",
};

const DEFAULT_COLOR = "gray";

export function BoardBadge({
  text,
  color,
}: {
  text?: string;
  color?: string;
}) {
  if (!text) return null;
  const classes = BADGE_COLORS[color ?? DEFAULT_COLOR] ?? BADGE_COLORS[DEFAULT_COLOR];
  return (
    <span
      className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${classes}`}
    >
      {text}
    </span>
  );
}

interface BoardBadgeEditorProps {
  boardId: Id<"boards">;
  currentText?: string;
  currentColor?: string;
  onClose: () => void;
}

export function BoardBadgeEditor({
  boardId,
  currentText,
  currentColor,
  onClose,
}: BoardBadgeEditorProps) {
  const sessionToken = useSessionToken();
  const setBadge = useMutation(api.boards.setBadge);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState(currentText ?? "");
  const [color, setColor] = useState(currentColor ?? DEFAULT_COLOR);
  const [saving, setSaving] = useState(false);

  // Desktop popover click-outside. Ignore clicks inside any badge editor surface
  // (the popover itself or the mobile bottom sheet, which is portaled elsewhere).
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if ((event.target as HTMLElement)?.closest?.("[data-badge-editor]")) {
        return;
      }
      onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setBadge({
        boardId,
        text: text.trim() || undefined,
        color,
        sessionToken,
      });
      onClose();
    } catch (error) {
      console.error("Failed to set badge:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await setBadge({ boardId, text: undefined, sessionToken });
      onClose();
    } catch (error) {
      console.error("Failed to clear badge:", error);
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <>
      <div className="p-3 border-b border-dark-border">
        <p className="text-sm text-dark-text font-medium mb-2">Board badge</p>
        <input
          type="text"
          value={text}
          maxLength={24}
          autoFocus
          placeholder="e.g. Beta, Internal"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          className="w-full bg-dark-bg border border-dark-border rounded px-2 py-2 text-sm text-dark-text focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {/* Preview */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-dark-muted">Preview:</span>
          <BoardBadge text={text.trim() || "Badge"} color={color} />
        </div>
      </div>

      {/* Color palette */}
      <div className="p-3 border-b border-dark-border">
        <p className="text-xs text-dark-muted mb-2 font-medium">Color</p>
        <div className="grid grid-cols-5 gap-2">
          {Object.entries(BADGE_COLORS).map(([key, classes]) => (
            <button
              key={key}
              onClick={() => setColor(key)}
              title={key}
              className={`h-8 rounded ${classes} ${
                color === key ? "ring-2 ring-accent ring-offset-1 ring-offset-dark-surface" : ""
              }`}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 flex items-center justify-between gap-2">
        {currentText ? (
          <button
            onClick={handleClear}
            disabled={saving}
            className="text-xs text-dark-muted hover:text-red-400 transition-colors disabled:opacity-50"
          >
            Remove badge
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: inline popover */}
      <div
        ref={popoverRef}
        data-badge-editor
        className="hidden sm:block absolute left-0 top-full mt-2 w-64 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50 overflow-hidden"
      >
        {form}
      </div>

      {/* Mobile: bottom sheet (portaled to body) */}
      <BottomSheet open onClose={onClose}>
        <div data-badge-editor>{form}</div>
      </BottomSheet>
    </>
  );
}
