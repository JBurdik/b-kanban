import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";

interface Props {
  editor: Editor;
  onClose: () => void;
}

// Content-only component for use in different containers
export function LinkPopoverContent({ editor, onClose }: Props) {
  const { from, to } = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(from, to, " ");
  const hasSelection = selectedText.length > 0;

  const previousUrl = editor.getAttributes("link").href || "";

  const [url, setUrl] = useState(previousUrl || "https://");
  const [label, setLabel] = useState("");
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
    urlInputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url || url === "https://") {
      // Remove link if URL is empty
      editor.chain().focus().unsetLink().run();
      onClose();
      return;
    }

    if (hasSelection) {
      // Text is selected - just apply link to selection
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else if (label) {
      // No selection but has label - insert new link with label
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${url}">${label}</a>`)
        .run();
    } else {
      // No selection, no label - insert URL as both
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${url}">${url}</a>`)
        .run();
    }

    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-3">
      {/* URL Input */}
      <div>
        <label className="block text-xs text-dark-muted mb-1">URL</label>
        <input
          ref={urlInputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full px-2.5 py-1.5 text-sm bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Label Input - only show when no text is selected */}
      {!hasSelection && (
        <div>
          <label className="block text-xs text-dark-muted mb-1">
            Label <span className="text-dark-muted/60">(optional)</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Link text"
            className="w-full px-2.5 py-1.5 text-sm bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {/* Selected text preview */}
      {hasSelection && (
        <div className="text-xs text-dark-muted">
          Link text: <span className="text-dark-text">"{selectedText}"</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().unsetLink().run();
            onClose();
          }}
          className="text-xs text-dark-muted hover:text-red-500 transition-colors"
        >
          Remove link
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-dark-muted hover:text-dark-text transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </form>
  );
}

// Wrapper with absolute positioning for use in BubbleMenu
export function LinkPopover({ editor, onClose }: Props) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute top-full left-0 mt-2 p-3 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50 min-w-[280px]"
    >
      <LinkPopoverContent editor={editor} onClose={onClose} />
    </div>
  );
}
