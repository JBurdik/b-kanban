import Image from "@tiptap/extension-image";
import type { NodeViewRenderer } from "@tiptap/core";

/**
 * Image extension with width persisted as an inline style (survives
 * getHTML()/dangerouslySetInnerHTML round-trip without a custom renderer).
 * Drag handle added via a vanilla NodeView (no ReactNodeViewRenderer needed).
 */
export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        renderHTML: (attrs: { width: string | null }) => {
          if (!attrs.width) return {};
          return { style: `width: ${attrs.width}px` };
        },
        parseHTML: (element: HTMLElement) => {
          const style = element.style.width;
          if (style) return parseInt(style, 10);
          const attr = element.getAttribute("width");
          return attr ? parseInt(attr, 10) : null;
        },
      },
    };
  },

  addNodeView(): NodeViewRenderer {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement("span");
      wrapper.className = "resizable-image-wrapper";
      wrapper.style.display = "inline-block";
      wrapper.style.position = "relative";
      wrapper.style.maxWidth = "100%";

      const img = document.createElement("img");
      const syncAttrs = () => {
        img.src = node.attrs.src;
        if (node.attrs.alt) img.alt = node.attrs.alt;
        if (node.attrs.title) img.title = node.attrs.title;
        img.style.width = node.attrs.width ? `${node.attrs.width}px` : "";
        img.style.display = "block";
        img.style.maxWidth = "100%";
      };
      syncAttrs();
      wrapper.appendChild(img);

      const handle = document.createElement("span");
      handle.className = "resizable-image-handle";
      handle.contentEditable = "false";
      wrapper.appendChild(handle);

      let startX = 0;
      let startWidth = 0;

      const onPointerMove = (e: PointerEvent) => {
        const delta = e.clientX - startX;
        const newWidth = Math.max(50, Math.round(startWidth + delta));
        img.style.width = `${newWidth}px`;
      };

      const onPointerUp = (e: PointerEvent) => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        const delta = e.clientX - startX;
        const newWidth = Math.max(50, Math.round(startWidth + delta));
        if (typeof getPos === "function") {
          const pos = getPos();
          editor
            .chain()
            .setNodeSelection(pos)
            .updateAttributes("image", { width: newWidth })
            .run();
        }
      };

      handle.addEventListener("pointerdown", (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        startWidth = img.getBoundingClientRect().width;
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      });

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type.name !== "image") return false;
          node = updatedNode;
          syncAttrs();
          return true;
        },
        selectNode() {
          wrapper.classList.add("ProseMirror-selectednode");
        },
        deselectNode() {
          wrapper.classList.remove("ProseMirror-selectednode");
        },
      };
    };
  },
});
