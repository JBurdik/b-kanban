# Infinite Canvas (Excalidraw) — Design

Date: 2026-07-08

## Goal

Board-level infinite canvases: freehand drawing, text, shapes, images. Multiple canvases per board, listed and opened like existing Documents.

## Non-goals (v1)

- Multiplayer cursors / live presence on canvas
- Per-element conflict merge (CRDT or Excalidraw reconciler)
- Version history
- Embedding a canvas in a card
- Export to PNG/SVG beyond what Excalidraw ships out of the box

## Dependency

`@excalidraw/excalidraw` (MIT). Used as-is. No fork, no custom canvas engine.

## Schema (`convex/schema.ts`)

```ts
canvases: defineTable({
  boardId: v.id("boards"),
  name: v.string(),
  elements: v.string(),   // JSON.stringify(ExcalidrawElement[])
  appState: v.string(),   // JSON.stringify(subset: viewBackgroundColor, gridSize, ...)
  createdBy: v.id("users"),
  updatedAt: v.number(),
}).index("by_board", ["boardId"]),

canvasFiles: defineTable({
  canvasId: v.id("canvases"),
  fileId: v.string(),     // Excalidraw BinaryFileData.id
  storageId: v.id("_storage"),
  mimeType: v.string(),
}).index("by_canvas", ["canvasId"])
  .index("by_canvas_file", ["canvasId", "fileId"]),
```

`elements` is stored as a single JSON string in one document.

**Known ceiling:** Convex caps a document at 1MB, so a canvas holds roughly a few
thousand elements. Upgrade path if that is ever hit: move elements to one row per
element keyed by `(canvasId, elementId)` and reconcile with Excalidraw's
`version`/`versionNonce` fields.

Images are never stored inline — only their Excalidraw file id lives in the
elements JSON; the bytes live in Convex file storage via `canvasFiles`.

## Backend (`convex/canvases.ts`)

Modeled directly on `convex/documents.ts`.

| Function | Kind | Notes |
|---|---|---|
| `list({ boardId })` | query | canvases for board, newest first |
| `get({ canvasId })` | query | canvas + resolved file URLs |
| `create({ boardId, name })` | mutation | empty elements/appState |
| `rename({ canvasId, name })` | mutation | |
| `remove({ canvasId })` | mutation | deletes `canvasFiles` rows + storage blobs |
| `save({ canvasId, elements, appState })` | mutation | full overwrite, sets `updatedAt` |
| `generateUploadUrl()` | mutation | standard Convex upload URL |
| `addFile({ canvasId, fileId, storageId, mimeType })` | mutation | idempotent on `(canvasId, fileId)` |

Access control: every function resolves the owning board and calls
`requireBoardAccess(ctx, boardId, "member")` from `convex/lib/rbac.ts`. Read-only
functions use the same `member` floor since board membership already gates reads.

Per the project's auth rule, all of these are public functions that derive
identity from `requireAuth` — none accept a caller-supplied user id or email.

## Frontend

Routes mirror the `docs` routes:

- `src/routes/boards.$boardId.canvas.tsx` — layout + canvas list sidebar
- `src/routes/boards.$boardId.canvas.index.tsx` — empty state / picker
- `src/routes/boards.$boardId.canvas.$canvasId.tsx` — editor route

- `src/components/canvas/CanvasEditor.tsx` — wraps `<Excalidraw>`
- Sidebar nav entry next to Docs in `src/components/layout/`

Excalidraw ships its own CSS and expects a sized container; the editor route
gives it a full-height flex child.

## Data flow

**Load**
1. `useQuery(api.canvases.get, { canvasId })`
2. Parse `elements` / `appState`; build `files` map from returned storage URLs
   (fetch each URL → dataURL, or hand Excalidraw the URL via `BinaryFileData`).
3. Pass as `initialData`. Keep `excalidrawAPI` in a ref.

**Save**
1. `onChange(elements, appState, files)` fires constantly (including on pure
   pointer/selection movement).
2. Skip when nothing structural changed: compare a cheap signature of
   `elements` (length + last `versionNonce` sum) against the last saved one.
3. Otherwise debounce 1000ms and call `save`.
4. Record the `updatedAt` we just wrote in a ref (`lastLocalWrite`).

**Remote updates (last-write-wins)**
- The reactive `get` query re-fires on any change.
- If the incoming `updatedAt` equals `lastLocalWrite`, it is the echo of our own
  mutation — ignore it.
- Otherwise it is another user's write: call `excalidrawAPI.updateScene({ elements })`.
- Concurrent edits: the later `save` wins wholesale. Accepted for v1.

**Images**
1. `onChange` hands us the full `files` map.
2. `diffNewFiles(files, uploadedIds)` returns entries whose id we have not
   uploaded yet — a pure function, unit-checked.
3. For each: decode dataURL → `POST` to `generateUploadUrl()` result → `addFile`.
4. Add the id to `uploadedIds`.
5. Before persisting `elements`, nothing needs stripping — image elements only
   reference `fileId`.

## Error handling

- `save` mutation rejects → toast, do **not** clear the debounce state; the
  in-memory Excalidraw scene remains the source of truth and the next change
  retries the write. No data is lost unless the tab closes.
- Document exceeds Convex's 1MB limit → the mutation throws; surface an explicit
  "This canvas is too large to save" toast rather than a generic error, so the
  cause is legible.
- Image upload fails → toast; the image element stays in the scene but renders as
  a missing-file placeholder on reload. Retry happens on the next `onChange`
  because the id never entered `uploadedIds`.
- Deleting a canvas removes its storage blobs; orphaned blobs on partial failure
  are acceptable (storage is cheap, no correctness impact).

## Testing

The repo has no test runner. One runnable check is added for the only non-trivial
pure logic:

`src/components/canvas/diffNewFiles.ts` exports `diffNewFiles(files, uploadedIds)`.
A sibling `diffNewFiles.check.ts` asserts: empty input → empty output; a known id
is skipped; an unknown id is returned; re-running after marking uploaded returns
empty. Run with `npx tsx`. Everything else is verified manually in the app.

## Deferred

Multiplayer cursors, per-element merge, version history, canvas-on-card. Add when
two users actually collide on one canvas.
