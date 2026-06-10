import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useSessionToken } from "@/hooks/useSessionToken";

const HEARTBEAT_INTERVAL = 15_000;

export function usePresence(boardId: Id<"boards">, activeCardId?: Id<"cards">) {
  const sessionToken = useSessionToken();
  const heartbeat = useMutation(api.presence.heartbeat);
  const leave = useMutation(api.presence.leave);
  const onlineUsers = useQuery(api.presence.list, { boardId });
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    heartbeat({ boardId, activeCardId, sessionToken });
    intervalRef.current = setInterval(() => {
      heartbeat({ boardId, activeCardId, sessionToken });
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      leave({ boardId, sessionToken });
    };
  }, [boardId, sessionToken]); // Only re-run on boardId change

  // Update activeCardId without resetting interval
  useEffect(() => {
    heartbeat({ boardId, activeCardId, sessionToken });
  }, [activeCardId]); // eslint-disable-line

  return { onlineUsers: onlineUsers || [] };
}
