import { useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

const CURSOR_THROTTLE_MS = 50; // ~20 Hz, matches useBoardCursors

export interface CanvasCursor {
  userId: Id<"users">;
  x: number; // Excalidraw scene coords
  y: number;
}

/**
 * Report this user's pointer (in scene coords) and subscribe to peers' cursors
 * on the same canvas. Throttle mirrors useBoardCursors: send on leading edge,
 * schedule a trailing send otherwise.
 */
export function useCanvasCursors(boardId: Id<"boards">, canvasId: Id<"canvases">) {
  const updateCursor = useMutation(api.presence.updateCursor);
  const rawCursors = useQuery(api.presence.listCursors, { boardId, canvasId });

  const lastSentRef = useRef<{ x: number; y: number; t: number }>({ x: -1, y: -1, t: 0 });
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    timerRef.current = null;
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    lastSentRef.current = { x: p.x, y: p.y, t: Date.now() };
    updateCursor({ boardId, canvasId, x: p.x, y: p.y });
  }, [boardId, canvasId, updateCursor]);

  const report = useCallback(
    (x: number, y: number) => {
      const last = lastSentRef.current;
      if (Math.abs(x - last.x) < 1 && Math.abs(y - last.y) < 1) return;

      pendingRef.current = { x, y };
      const elapsed = Date.now() - last.t;

      if (elapsed >= CURSOR_THROTTLE_MS) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        flush();
      } else if (!timerRef.current) {
        timerRef.current = setTimeout(flush, CURSOR_THROTTLE_MS - elapsed);
      }
    },
    [flush]
  );

  return { cursors: (rawCursors ?? []) as CanvasCursor[], report };
}
