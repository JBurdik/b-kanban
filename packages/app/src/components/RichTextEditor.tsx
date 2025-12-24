import { useEditor, EditorContent, type AnyExtension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { SlashCommands } from "./editor/SlashCommands";
import { createMentionExtension } from "./editor/MentionExtension";
import { useMemo } from "react";
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
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  readOnly = false,
  onMentionSearch,
}: Props) {
  const mentionExtension = useMemo(() => {
    if (!onMentionSearch) return null;
    return createMentionExtension({ onSearch: onMentionSearch });
  }, [onMentionSearch]);

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
    ];
    if (mentionExtension) {
      exts.push(mentionExtension);
    }
    return exts;
  }, [placeholder, mentionExtension]);

  const editor = useEditor({
    extensions,
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none min-h-[150px] p-3 focus:outline-none",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-dark-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-dark-border bg-dark-bg">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h5a4 4 0 014 4 4 4 0 01-4 4H4a1 1 0 01-1-1V4zm1 1v4h4a2 2 0 100-4H4z" />
            <path d="M3 12a1 1 0 011-1h6a4 4 0 014 4 4 4 0 01-4 4H4a1 1 0 01-1-1v-6zm1 1v4h5a2 2 0 100-4H4z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 3a1 1 0 011-1h5a1 1 0 110 2h-1.7l-3 12H11a1 1 0 110 2H6a1 1 0 110-2h1.7l3-12H9a1 1 0 01-1-1z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3a7 7 0 100 14 7 7 0 000-14zM3 10a7 7 0 0114 0H3z" />
          </svg>
        </ToolbarButton>

        <div className="w-px h-4 bg-dark-border mx-1" />

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          H1
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>

        <div className="w-px h-4 bg-dark-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 4a1 1 0 100 2 1 1 0 000-2zm4 1a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm0 5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm0 5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4-5a1 1 0 100 2 1 1 0 000-2zm0 5a1 1 0 100 2 1 1 0 000-2z"
              clipRule="evenodd"
            />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 4a1 1 0 011-1h.5a.5.5 0 01.5.5v2a.5.5 0 01-.5.5H4a1 1 0 01-1-1V4zm4 1a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm0 5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm0 5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zM3.5 9a.5.5 0 00-.5.5v1a.5.5 0 00.5.5H4a.5.5 0 00.5-.5v-1A.5.5 0 004 9h-.5zm0 5a.5.5 0 00-.5.5v1a.5.5 0 00.5.5H4a.5.5 0 00.5-.5v-1a.5.5 0 00-.5-.5h-.5z"
              clipRule="evenodd"
            />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.5 4a.5.5 0 01.5.5v3a.5.5 0 01-.5.5H2.707a.5.5 0 00-.354.146L1 9.5v5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-5a.5.5 0 00-.5-.5H4.5V4.5a.5.5 0 01.5-.5h1a.5.5 0 010 1H5V4.5A.5.5 0 014.5 4zm9 0a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-1.793a.5.5 0 00-.354.146L10 9.5v5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-5a.5.5 0 00-.5-.5h-1.5V4.5a.5.5 0 01.5-.5h1a.5.5 0 010 1h-.5V4.5a.5.5 0 01-.5-.5z"
              clipRule="evenodd"
            />
          </svg>
        </ToolbarButton>

        <div className="w-px h-4 bg-dark-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive("taskList")}
          title="Task List"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M6 4.5a2 2 0 11-4 0 2 2 0 014 0zm8 0a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1zm-8 5a2 2 0 11-4 0 2 2 0 014 0zm8 0a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1zm-8 5a2 2 0 11-4 0 2 2 0 014 0zm8 0a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          active={false}
          title="Divider"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} className="bg-dark-surface" />

      {/* Editor styles */}
      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #888;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror h1 { font-size: 1.5em; font-weight: bold; margin: 0.5em 0; }
        .ProseMirror h2 { font-size: 1.25em; font-weight: bold; margin: 0.5em 0; }
        .ProseMirror h3 { font-size: 1.1em; font-weight: bold; margin: 0.5em 0; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0.5em 0; }
        .ProseMirror li { margin: 0.25em 0; }
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
          accent-color: #3b82f6;
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
      `}</style>
    </div>
  );
}

function ToolbarButton({
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
          : "text-dark-muted hover:text-dark-text hover:bg-dark-hover",
      )}
    >
      {children}
    </button>
  );
}
