import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { SlashCommands } from "../editor/SlashCommands";
import { createMentionExtension } from "../editor/MentionExtension";
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
  onSubmit?: () => void;
  autoFocus?: boolean;
  onMentionSearch?: (query: string) => Promise<MentionUser[]>;
}

export function CommentEditor({ content, onChange, placeholder, onSubmit, autoFocus = false, onMentionSearch }: Props) {
  const mentionExtension = useMemo(() => {
    if (!onMentionSearch) return null;
    return createMentionExtension({ onSearch: onMentionSearch });
  }, [onMentionSearch]);

  const extensions = useMemo(() => {
    const exts = [
      StarterKit.configure({
        heading: false, // No headings in comments
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write a comment... (use '/' for formatting, '@' for mentions)",
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
    autofocus: autoFocus,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none min-h-[60px] p-3 focus:outline-none",
      },
      handleKeyDown: (view, event) => {
        // Submit on Cmd/Ctrl+Enter
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onSubmit?.();
          return true;
        }
        return false;
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-dark-border rounded-lg overflow-hidden">
      {/* Compact toolbar */}
      <div className="flex items-center gap-1 p-1.5 border-b border-dark-border bg-dark-bg">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h5a4 4 0 014 4 4 4 0 01-4 4H4a1 1 0 01-1-1V4zm1 1v4h4a2 2 0 100-4H4z" />
            <path d="M3 12a1 1 0 011-1h6a4 4 0 014 4 4 4 0 01-4 4H4a1 1 0 01-1-1v-6zm1 1v4h5a2 2 0 100-4H4z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8 3a1 1 0 011-1h5a1 1 0 110 2h-1.7l-3 12H11a1 1 0 110 2H6a1 1 0 110-2h1.7l3-12H9a1 1 0 01-1-1z" />
          </svg>
        </ToolbarButton>

        <div className="w-px h-3 bg-dark-border mx-0.5" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 100 2 1 1 0 000-2zm4 1a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm0 5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm0 5a1 1 0 011-1h9a1 1 0 110 2H8a1 1 0 01-1-1zm-4-5a1 1 0 100 2 1 1 0 000-2zm0 5a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.5 4a.5.5 0 01.5.5v3a.5.5 0 01-.5.5H2.707a.5.5 0 00-.354.146L1 9.5v5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-5a.5.5 0 00-.5-.5H4.5V4.5a.5.5 0 01.5-.5h1a.5.5 0 010 1H5V4.5A.5.5 0 014.5 4zm9 0a.5.5 0 01.5.5v3a.5.5 0 01-.5.5h-1.793a.5.5 0 00-.354.146L10 9.5v5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5v-5a.5.5 0 00-.5-.5h-1.5V4.5a.5.5 0 01.5-.5h1a.5.5 0 010 1h-.5V4.5a.5.5 0 01-.5-.5z" clipRule="evenodd" />
          </svg>
        </ToolbarButton>

        <span className="ml-auto text-xs text-dark-muted">
          Cmd+Enter to post
        </span>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} className="bg-dark-surface" />

      {/* Comment editor styles */}
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
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0.25em 0; }
        .ProseMirror li { margin: 0.15em 0; }
        .ProseMirror code { background: #2a2a2a; padding: 0.1em 0.3em; border-radius: 0.2em; font-size: 0.85em; }
        .ProseMirror pre { background: #2a2a2a; padding: 0.5em 0.75em; border-radius: 0.4em; margin: 0.25em 0; overflow-x: auto; font-size: 0.85em; }
        .ProseMirror pre code { background: none; padding: 0; }
        .ProseMirror blockquote { border-left: 2px solid #3b82f6; padding-left: 0.75em; margin: 0.25em 0; color: #888; }
        .ProseMirror p { margin: 0.25em 0; }

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
      type="button"
      className={clsx(
        "p-1 rounded transition-colors text-xs",
        active
          ? "bg-accent text-white"
          : "text-dark-muted hover:text-dark-text hover:bg-dark-hover"
      )}
    >
      {children}
    </button>
  );
}
