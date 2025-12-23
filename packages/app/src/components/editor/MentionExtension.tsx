import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance } from "tippy.js";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Avatar } from "@/components/Avatar";
import clsx from "clsx";
import type { Id } from "convex/_generated/dataModel";

interface MentionUser {
  id: Id<"users">;
  name: string;
  email: string;
  image?: string;
}

interface MentionListProps {
  items: MentionUser[];
  command: (item: { id: string; label: string }) => void;
}

interface MentionListRef {
  onKeyDown: (event: { event: KeyboardEvent }) => boolean;
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) {
        command({ id: item.id, label: item.name });
      }
    };

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-dark-surface border border-dark-border rounded-lg shadow-xl p-3 w-64">
          <p className="text-dark-muted text-sm">No members found</p>
        </div>
      );
    }

    return (
      <div className="bg-dark-surface border border-dark-border rounded-lg shadow-xl overflow-hidden w-64">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            className={clsx(
              "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
              index === selectedIndex
                ? "bg-accent/20 text-accent"
                : "hover:bg-dark-hover text-dark-text"
            )}
          >
            <Avatar name={item.name} id={item.id} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-xs text-dark-muted truncate">{item.email}</p>
            </div>
          </button>
        ))}
      </div>
    );
  }
);

MentionList.displayName = "MentionList";

export interface MentionExtensionOptions {
  onSearch: (query: string) => Promise<MentionUser[]>;
}

export function createMentionExtension(options: MentionExtensionOptions) {
  return Mention.configure({
    HTMLAttributes: {
      class: "mention",
    },
    renderLabel({ node }) {
      return `@${node.attrs.label}`;
    },
    suggestion: {
      char: "@",
      items: async ({ query }) => {
        return await options.onSearch(query);
      },
      render: () => {
        let component: ReactRenderer | null = null;
        let popup: Instance[] | null = null;

        return {
          onStart: (props: any) => {
            component = new ReactRenderer(MentionList, {
              props,
              editor: props.editor,
            });

            if (!props.clientRect) {
              return;
            }

            popup = tippy("body", {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: "manual",
              placement: "bottom-start",
            });
          },

          onUpdate: (props: any) => {
            component?.updateProps(props);

            if (!props.clientRect) {
              return;
            }

            popup?.[0]?.setProps({
              getReferenceClientRect: props.clientRect,
            });
          },

          onKeyDown: (props: any) => {
            if (props.event.key === "Escape") {
              popup?.[0]?.hide();
              return true;
            }

            return (component?.ref as any)?.onKeyDown(props) ?? false;
          },

          onExit: () => {
            popup?.[0]?.destroy();
            component?.destroy();
          },
        };
      },
    },
  });
}
