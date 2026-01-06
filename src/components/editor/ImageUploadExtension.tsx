import Image from "@tiptap/extension-image";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";

export interface ImageUploadOptions {
  onUpload?: (file: File) => Promise<string | null>;
}

/**
 * Custom Image extension that handles:
 * - Clipboard paste for images
 * - Drag and drop for images
 * - File input upload
 */
export const ImageUploadExtension = Image.extend<ImageUploadOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      onUpload: undefined,
    };
  },

  addProseMirrorPlugins() {
    const onUpload = this.options.onUpload;
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey("imageUpload"),
        props: {
          handlePaste(_view, event) {
            if (!onUpload) return false;

            const items = Array.from(event.clipboardData?.items || []);
            const imageItem = items.find((item) => item.type.startsWith("image/"));

            if (!imageItem) return false;

            event.preventDefault();
            const file = imageItem.getAsFile();
            if (!file) return false;

            handleImageUpload(file, editor, onUpload);
            return true;
          },

          handleDrop(_view, event) {
            if (!onUpload) return false;

            const files = Array.from(event.dataTransfer?.files || []);
            const imageFile = files.find((file) => file.type.startsWith("image/"));

            if (!imageFile) return false;

            event.preventDefault();
            handleImageUpload(imageFile, editor, onUpload);
            return true;
          },
        },
      }),
    ];
  },
});

async function handleImageUpload(
  file: File,
  editor: Editor,
  onUpload: (file: File) => Promise<string | null>
) {
  try {
    const url = await onUpload(file);

    if (url) {
      // Insert the image using insertContent
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: {
            src: url,
            alt: file.name,
          },
        })
        .run();
    }
  } catch (error) {
    console.error("Failed to upload image:", error);
  }
}

/**
 * Trigger file input for image upload
 */
export function triggerImageUpload(
  editor: Editor,
  onUpload: (file: File) => Promise<string | null>
) {
  // Create a hidden file input
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.position = "fixed";
  input.style.top = "-9999px";
  input.style.left = "-9999px";
  document.body.appendChild(input);

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      await handleImageUpload(file, editor, onUpload);
    }
    // Clean up
    document.body.removeChild(input);
  };

  // Also clean up if cancelled
  input.addEventListener("cancel", () => {
    document.body.removeChild(input);
  });

  // Small delay to ensure the input is in the DOM
  setTimeout(() => {
    input.click();
  }, 10);
}
