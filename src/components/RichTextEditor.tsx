import { useEditor, EditorContent, BubbleMenu, type AnyExtension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { SlashCommands } from "./editor/SlashCommands";
import { Callout } from "./editor/CalloutExtension";
import { createMentionExtension } from "./editor/MentionExtension";
import { LinkPopover, LinkPopoverContent } from "./editor/LinkPopover";
import { ImageUploadExtension, triggerImageUpload } from "./editor/ImageUploadExtension";
import { useMemo, useState, useEffect, useRef } from "react";
import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";

interface MentionUser {
  id: Id<"users">;
  name: string;
  email: string;
  image?: string;
}

interface Props {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  onMentionSearch?: (query: string) => Promise<MentionUser[]>;
  onImageUpload?: (file: File) => Promise<string | null>;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  readOnly = false,
  onMentionSearch,
  onImageUpload,
}: Props) {
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [showFloatingLinkPopover, setShowFloatingLinkPopover] = useState(false);
  const [floatingPopoverPos, setFloatingPopoverPos] = useState({ top: 0, left: 0 });

  const mentionExtension = useMemo(() => {
    if (!onMentionSearch) return null;
    return createMentionExtension({ onSearch: onMentionSearch });
  }, [onMentionSearch]);

  const imageExtension = useMemo(() => {
    if (!onImageUpload) return null;
    return ImageUploadExtension.configure({
      onUpload: onImageUpload,
    });
  }, [onImageUpload]);

  const extensions = useMemo(() => {
    const exts: AnyExtension[] = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          placeholder || "Type '/' for commands, '@' for mentions...",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      SlashCommands,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight.configure({
        multicolor: false,
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "editor-link",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Callout,
    ];
    if (mentionExtension) {
      exts.push(mentionExtension);
    }
    if (imageExtension) {
      exts.push(imageExtension);
    }
    return exts;
  }, [placeholder, mentionExtension, imageExtension]);

  // Track if content changes are from internal editing
  const isInternalChange = useRef(false);

  const editor = useEditor({
    extensions,
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      isInternalChange.current = true;
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none min-h-[200px] focus:outline-none",
      },
    },
  });

  // Sync content prop changes to editor (for external updates)
  useEffect(() => {
    if (!editor) return;

    // Skip if change was from internal editing
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    // Only update if content actually differs
    const currentHTML = editor.getHTML();
    if (content !== currentHTML) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  // Listen for custom event from slash commands to open link popover
  useEffect(() => {
    const handleOpenLinkPopover = () => {
      if (!editor) return;

      // Get cursor position in the editor
      const { view } = editor;
      const { from } = view.state.selection;
      const coords = view.coordsAtPos(from);

      setFloatingPopoverPos({
        top: coords.bottom + 8,
        left: coords.left,
      });
      setShowFloatingLinkPopover(true);
    };
    window.addEventListener("editor:open-link-popover", handleOpenLinkPopover);
    return () => window.removeEventListener("editor:open-link-popover", handleOpenLinkPopover);
  }, [editor]);

  // Listen for custom event from slash commands to trigger image upload
  useEffect(() => {
    const handleOpenImageUpload = () => {
      if (!editor || !onImageUpload) return;
      triggerImageUpload(editor, onImageUpload);
    };
    window.addEventListener("editor:open-image-upload", handleOpenImageUpload);
    return () => window.removeEventListener("editor:open-image-upload", handleOpenImageUpload);
  }, [editor, onImageUpload]);

  if (!editor) return null;

  return (
    <div className="w-full">
      {/* Floating Bubble Menu - appears on text selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100 }}
        className="flex items-center gap-0.5 px-1 py-1 bg-dark-surface border border-dark-border rounded-lg shadow-xl"
      >
        <BubbleButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h5a4 4 0 014 4 4 4 0 01-4 4H4a1 1 0 01-1-1V4zm1 1v4h4a2 2 0 100-4H4z" />
            <path d="M3 12a1 1 0 011-1h6a4 4 0 014 4 4 4 0 01-4 4H4a1 1 0 01-1-1v-6zm1 1v4h5a2 2 0 100-4H4z" />
          </svg>
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 3a1 1 0 011-1h5a1 1 0 110 2h-1.7l-3 12H11a1 1 0 110 2H6a1 1 0 110-2h1.7l3-12H9a1 1 0 01-1-1z" />
          </svg>
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3a7 7 0 100 14 7 7 0 000-14zM3 10a7 7 0 0114 0H3z" />
          </svg>
        </BubbleButton>

        <BubbleButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline Code"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </BubbleButton>

        <div className="w-px h-4 bg-dark-border mx-0.5" />

        <BubbleButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")}
          title="Highlight"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </BubbleButton>

        <div className="relative">
          <BubbleButton
            onClick={() => setShowLinkPopover(!showLinkPopover)}
            active={editor.isActive("link") || showLinkPopover}
            title="Add Link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </BubbleButton>

          {showLinkPopover && (
            <LinkPopover
              editor={editor}
              onClose={() => setShowLinkPopover(false)}
            />
          )}
        </div>

        {editor.isActive("link") && (
          <BubbleButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            active={false}
            title="Remove Link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </BubbleButton>
        )}
      </BubbleMenu>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Floating Link Popover - triggered by slash command */}
      {showFloatingLinkPopover && (
        <>
          {/* Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowFloatingLinkPopover(false)}
          />
          <div
            className="fixed z-50"
            style={{ top: floatingPopoverPos.top, left: floatingPopoverPos.left }}
          >
            <div className="p-3 bg-dark-surface border border-dark-border rounded-lg shadow-xl min-w-[280px]">
              <LinkPopoverContent
                editor={editor}
                onClose={() => setShowFloatingLinkPopover(false)}
              />
            </div>
          </div>
        </>
      )}

      {/* Editor styles */}
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #666;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror h1 { font-size: 2em; font-weight: bold; margin: 0.67em 0; }
        .ProseMirror h2 { font-size: 1.5em; font-weight: bold; margin: 0.75em 0; }
        .ProseMirror h3 { font-size: 1.17em; font-weight: bold; margin: 0.83em 0; }
        .ProseMirror p { margin: 0.5em 0; }

        /* Better bullet list alignment */
        .ProseMirror ul:not([data-type="taskList"]) {
          padding-left: 1.5em;
          margin: 0.5em 0;
          list-style-type: disc;
        }
        .ProseMirror ul:not([data-type="taskList"]) li {
          margin: 0.25em 0;
          padding-left: 0.25em;
        }
        .ProseMirror ul:not([data-type="taskList"]) li::marker {
          color: #f59e0b;
        }

        .ProseMirror ol {
          padding-left: 1.5em;
          margin: 0.5em 0;
          list-style-type: decimal;
        }
        .ProseMirror ol li {
          margin: 0.25em 0;
          padding-left: 0.25em;
        }

        .ProseMirror code { background: #2a2a2a; padding: 0.2em 0.4em; border-radius: 0.25em; font-size: 0.9em; }
        .ProseMirror pre { background: #2a2a2a; padding: 0.75em 1em; border-radius: 0.5em; margin: 0.5em 0; overflow-x: auto; }
        .ProseMirror pre code { background: none; padding: 0; }
        .ProseMirror blockquote { border-left: 3px solid #3b82f6; padding-left: 1em; margin: 0.5em 0; color: #888; }
        .ProseMirror hr { border: none; border-top: 1px solid #2a2a2a; margin: 1em 0; }

        /* Task list styles */
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5em;
        }
        .ProseMirror ul[data-type="taskList"] li > label {
          flex-shrink: 0;
          user-select: none;
        }
        .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
          accent-color: #f59e0b;
          width: 1.1em;
          height: 1.1em;
          margin-top: 0.2em;
          cursor: pointer;
        }
        .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
          text-decoration: line-through;
          opacity: 0.6;
        }

        /* Mention styles */
        .ProseMirror .mention {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
          padding: 0.1em 0.3em;
          border-radius: 0.25em;
          font-weight: 500;
        }

        /* Highlight styles */
        .ProseMirror mark {
          background: rgba(245, 158, 11, 0.3);
          padding: 0.1em 0.2em;
          border-radius: 0.2em;
        }

        /* Table styles */
        .ProseMirror table {
          border-collapse: collapse;
          margin: 1em 0;
          width: 100%;
          overflow: hidden;
        }
        .ProseMirror th,
        .ProseMirror td {
          border: 1px solid #2a2a2a;
          padding: 0.5em 0.75em;
          text-align: left;
          min-width: 100px;
          vertical-align: top;
        }
        .ProseMirror th {
          background: #1a1a1a;
          font-weight: 600;
        }
        .ProseMirror .tableWrapper {
          overflow-x: auto;
        }
        .ProseMirror .selectedCell {
          background: rgba(245, 158, 11, 0.1);
        }

        /* Link styles */
        .ProseMirror a,
        .ProseMirror .editor-link {
          color: #f59e0b;
          text-decoration: underline;
          cursor: pointer;
          transition: color 0.15s;
        }
        .ProseMirror a:hover,
        .ProseMirror .editor-link:hover {
          color: #d97706;
        }

        /* Image styles */
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5em;
          margin: 0.5em 0;
          cursor: pointer;
        }
        .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #f59e0b;
          outline-offset: 2px;
        }

        /* Callout styles */
        .ProseMirror .callout {
          padding: 1em;
          border-radius: 0.5em;
          margin: 0.5em 0;
        }
      `}</style>
    </div>
  );
}

function BubbleButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={clsx(
        "p-1.5 rounded transition-colors text-sm",
        active
          ? "bg-accent text-white"
          : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
      )}
    >
      {children}
    </button>
  );
}
