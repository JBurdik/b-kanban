import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

const HEARTBEAT_INTERVAL = 15_000;

export function usePresence(boardId: Id<"boards">, activeCardId?: Id<"cards">) {
  const heartbeat = useMutation(api.presence.heartbeat);
  const leave = useMutation(api.presence.leave);
  const onlineUsers = useQuery(api.presence.list, { boardId });
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    heartbeat({ boardId, activeCardId });
    intervalRef.current = setInterval(() => {
      heartbeat({ boardId, activeCardId });
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      leave({ boardId });
    };
  }, [boardId]); // Only re-run on boardId change

  // Update activeCardId without resetting interval
  useEffect(() => {
    heartbeat({ boardId, activeCardId });
  }, [activeCardId]); // eslint-disable-line

  return { onlineUsers: onlineUsers || [] };
}
