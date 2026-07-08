import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Excalidraw, CaptureUpdateAction, hashElementsVersion } from "@excalidraw/excalidraw";
import type {
  BinaryFileData,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useTheme } from "@/contexts/ThemeContext";
import { useConvexUser } from "@/hooks/useConvexUser";
import { usePresence } from "@/hooks/usePresence";
import { useCanvasCursors } from "@/hooks/useCanvasCursors";
import { diffNewFiles, dataUrlToBlob } from "./diffNewFiles";
import "@excalidraw/excalidraw/index.css";

const SAVE_DEBOUNCE_MS = 1000;

/** Deterministic, well-spread cursor color per user (Excalidraw wants bg+stroke). */
function colorForUser(userId: string): { background: string; stroke: string } {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return { background: `hsl(${hue} 70% 55%)`, stroke: `hsl(${hue} 70% 35%)` };
}

/** appState is huge and mostly ephemeral; only these survive a reload. */
type PersistedAppState = Pick<AppState, "viewBackgroundColor" | "gridSize">;

export type CanvasData = {
  _id: Id<"canvases">;
  boardId: Id<"boards">;
  elements: string;
  appState: string;
  updatedAt: number;
  files: { fileId: string; mimeType: string; url: string | null }[];
};

type SaveStatus = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

/** Convex rejects documents over 1MB; say so plainly instead of leaking the raw error. */
function describeSaveError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/too large|exceeds|1 ?MB/i.test(message)) {
    return "This canvas is too large to save. Delete some elements.";
  }
  return "Could not save. Retrying on your next change.";
}

async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function CanvasEditor({ canvas }: { canvas: CanvasData }) {
  const { resolvedMode } = useTheme();
  const save = useMutation(api.canvases.save);
  const generateUploadUrl = useMutation(api.canvases.generateUploadUrl);
  const addFile = useMutation(api.canvases.addFile);

  const { user } = useConvexUser();
  const { onlineUsers } = usePresence(canvas.boardId);
  const { cursors, report } = useCanvasCursors(canvas.boardId, canvas._id);

  const [api_, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Version of the scene we last persisted; skips saves from cursor/selection moves. */
  const savedVersionRef = useRef<number | null>(null);
  /** Version the currently-armed timer will write. Excalidraw fires `onChange`
   * continuously, so re-arming on every call would postpone the save forever. */
  const pendingVersionRef = useRef<number | null>(null);
  /** Latest scene, read when the timer fires rather than captured per-change. */
  const latestRef = useRef<{ elements: readonly OrderedExcalidrawElement[]; appState: AppState } | null>(null);
  /** `updatedAt` values we produced, so a reactive echo isn't mistaken for a peer's edit. */
  const ownWritesRef = useRef(new Set<number>());
  const uploadedIdsRef = useRef(new Set<string>());
  const uploadingIdsRef = useRef(new Set<string>());

  // The canvas doc is loaded once; later versions arrive through the remote-sync
  // effect below rather than by remounting Excalidraw.
  const initialData = useMemo(() => {
    const elements = JSON.parse(canvas.elements) as OrderedExcalidrawElement[];
    savedVersionRef.current = hashElementsVersion(elements);
    return {
      elements,
      appState: JSON.parse(canvas.appState) as Partial<PersistedAppState>,
      scrollToContent: true,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas._id]);

  // Load persisted images once the API exists. Excalidraw's renderer reads
  // BinaryFileData.dataURL, so remote URLs have to be inlined first.
  useEffect(() => {
    if (!api_) return;
    let cancelled = false;

    const pending = canvas.files.filter(
      (file) => file.url && !uploadedIdsRef.current.has(file.fileId)
    );
    if (pending.length === 0) return;

    void (async () => {
      const loaded = await Promise.all(
        pending.map(async (file) => {
          try {
            return {
              id: file.fileId,
              mimeType: file.mimeType,
              dataURL: await urlToDataUrl(file.url!),
              created: Date.now(),
            } as BinaryFileData;
          } catch {
            return null; // renders as a missing-image placeholder
          }
        })
      );
      if (cancelled) return;

      const ok = loaded.filter((file): file is BinaryFileData => file !== null);
      for (const file of ok) uploadedIdsRef.current.add(file.id);
      if (ok.length > 0) api_.addFiles(ok);
    })();

    return () => {
      cancelled = true;
    };
  }, [api_, canvas.files]);

  // Remote edits: last write wins. Our own writes come back through this same
  // query, so drop the ones we authored.
  useEffect(() => {
    if (!api_) return;

    if (ownWritesRef.current.has(canvas.updatedAt)) {
      ownWritesRef.current.delete(canvas.updatedAt);
      return;
    }

    const elements = JSON.parse(canvas.elements) as OrderedExcalidrawElement[];
    if (hashElementsVersion(elements) === savedVersionRef.current) return;

    savedVersionRef.current = hashElementsVersion(elements);
    api_.updateScene({
      elements,
      // Remote updates must not enter this user's undo stack.
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }, [api_, canvas.updatedAt, canvas.elements]);

  const uploadNewFiles = useCallback(
    async (files: BinaryFiles) => {
      const fresh = diffNewFiles(files, uploadedIdsRef.current).filter(
        (file) => !uploadingIdsRef.current.has(file.id)
      );

      for (const file of fresh) {
        uploadingIdsRef.current.add(file.id);
        try {
          const uploadUrl = await generateUploadUrl();
          const blob = dataUrlToBlob(file.dataURL);
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
          });
          if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

          const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
          await addFile({
            canvasId: canvas._id,
            fileId: file.id,
            storageId,
            mimeType: blob.type,
          });
          // Only now is it durable — a throw above leaves the id unmarked so the
          // next onChange retries it.
          uploadedIdsRef.current.add(file.id);
        } catch (error) {
          setStatus({ kind: "error", message: describeSaveError(error) });
        } finally {
          uploadingIdsRef.current.delete(file.id);
        }
      }
    },
    [addFile, canvas._id, generateUploadUrl]
  );

  const handleChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
      void uploadNewFiles(files);
      latestRef.current = { elements, appState };

      const version = hashElementsVersion(elements);
      if (version === savedVersionRef.current || version === pendingVersionRef.current) return;

      // The scene moved on from whatever the armed timer was going to write.
      if (timerRef.current) clearTimeout(timerRef.current);
      pendingVersionRef.current = version;

      timerRef.current = setTimeout(() => {
        const latest = latestRef.current;
        if (!latest) return;

        // Recompute: an undo could have returned the scene to the saved state
        // after this timer was armed, so `version` may be stale.
        const writtenVersion = hashElementsVersion(latest.elements);

        setStatus({ kind: "saving" });
        const persisted: PersistedAppState = {
          viewBackgroundColor: latest.appState.viewBackgroundColor,
          gridSize: latest.appState.gridSize,
        };

        save({
          canvasId: canvas._id,
          elements: JSON.stringify(latest.elements),
          appState: JSON.stringify(persisted),
        })
          .then((updatedAt) => {
            ownWritesRef.current.add(updatedAt);
            savedVersionRef.current = writtenVersion;
            setStatus({ kind: "saved" });
          })
          .catch((error: unknown) => {
            // Leave savedVersionRef alone: the scene stays dirty and the next
            // change retries the write.
            setStatus({ kind: "error", message: describeSaveError(error) });
          })
          .finally(() => {
            pendingVersionRef.current = null;
          });
      }, SAVE_DEBOUNCE_MS);
    },
    [canvas._id, save, uploadNewFiles]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  // Feed peers' cursors to Excalidraw's built-in collaborator rendering, which
  // handles scene→viewport projection (pan/zoom) for us.
  useEffect(() => {
    if (!api_) return;

    const names = new Map(onlineUsers.map((u) => [u.userId as string, u]));
    const collaborators = new Map();
    for (const cursor of cursors) {
      const id = cursor.userId as string;
      if (id === user?.id) continue; // don't render our own cursor
      const info = names.get(id);
      collaborators.set(id, {
        id,
        username: info?.userName ?? "",
        avatarUrl: info?.userImage,
        pointer: { x: cursor.x, y: cursor.y, tool: "pointer" as const },
        color: colorForUser(id),
      });
    }

    // Cast: Excalidraw keys by branded SocketId, but any stable string works.
    api_.updateScene({ collaborators: collaborators as never });
  }, [api_, cursors, onlineUsers, user?.id]);

  return (
    <div className="relative h-full w-full">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        onChange={handleChange}
        onPointerUpdate={(payload) => report(payload.pointer.x, payload.pointer.y)}
        theme={resolvedMode}
      />
      <SaveIndicator status={status} />
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status.kind === "idle") return null;

  const isError = status.kind === "error";
  return (
    <div
      role="status"
      className={`pointer-events-none absolute bottom-3 right-3 z-10 rounded-md px-2.5 py-1.5 text-xs shadow-sm ${
        isError
          ? "bg-red-500/90 text-white"
          : "bg-neutral-900/70 text-neutral-100 dark:bg-neutral-100/80 dark:text-neutral-900"
      }`}
    >
      {isError ? status.message : status.kind === "saving" ? "Saving…" : "Saved"}
    </div>
  );
}
