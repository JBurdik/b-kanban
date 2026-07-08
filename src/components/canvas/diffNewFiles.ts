import type { BinaryFileData, BinaryFiles } from "@excalidraw/excalidraw/types";

/**
 * Return the files Excalidraw is holding that we have not persisted yet.
 *
 * Excalidraw hands us the complete `files` map on every change, so this runs
 * often. Callers add an id to `uploadedIds` only after `addFile` succeeds, which
 * is what makes a failed upload retry on the next change instead of vanishing.
 */
export function diffNewFiles(
  files: BinaryFiles,
  uploadedIds: ReadonlySet<string>
): BinaryFileData[] {
  return Object.values(files).filter((file) => !uploadedIds.has(file.id));
}

/**
 * Decode Excalidraw's `data:<mime>;base64,<payload>` into bytes for upload.
 * Throws on anything that isn't a base64 data URL — Excalidraw only ever
 * produces those, so a non-match means something upstream changed.
 */
export function dataUrlToBlob(dataURL: string): Blob {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataURL);
  if (!match) throw new Error("Unsupported dataURL format");

  const [, mimeType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
