/**
 * Runnable check for the canvas pure helpers: `npx tsx src/components/canvas/diffNewFiles.check.ts`
 * No test runner is configured in this repo; this is the smallest thing that
 * fails if the upload-diff logic breaks.
 */
import assert from "node:assert/strict";
import { diffNewFiles } from "./diffNewFiles";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

const file = (id: string) =>
  ({ id, dataURL: "data:image/png;base64,AA==", mimeType: "image/png", created: 0 }) as never;

// diffNewFiles
{
  assert.deepEqual(diffNewFiles({} as BinaryFiles, new Set()), [], "empty in, empty out");

  const files = { a: file("a"), b: file("b") } as unknown as BinaryFiles;

  assert.deepEqual(
    diffNewFiles(files, new Set(["a"])).map((f) => f.id),
    ["b"],
    "known id skipped, unknown id returned"
  );

  assert.deepEqual(
    diffNewFiles(files, new Set(["a", "b"])).map((f) => f.id),
    [],
    "re-running after marking uploaded returns empty"
  );
}

console.log("ok");
