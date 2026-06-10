import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useSessionToken } from "@/hooks/useSessionToken";

export function useActiveTimer() {
  const sessionToken = useSessionToken();
  const activeTimer = useQuery(
    api.timeTracking.getActiveTimer,
    sessionToken ? { sessionToken } : "skip"
  );

  const startTimerMutation = useMutation(api.timeTracking.startTimer);
  const stopTimerMutation = useMutation(api.timeTracking.stopTimer);
  const discardTimerMutation = useMutation(api.timeTracking.discardTimer);
  const updateTimerMutation = useMutation(api.timeTracking.updateTimer);

  // Local state for elapsed time display (updated every second)
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!activeTimer) {
      setElapsedMs(0);
      return;
    }

    // Calculate initial elapsed time
    setElapsedMs(Date.now() - activeTimer.startedAt);

    // Update every second
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - activeTimer.startedAt);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  const start = async (description: string, cardId?: Id<"cards">) => {
    await startTimerMutation({ description, cardId, sessionToken });
  };

  const stop = async () => {
    await stopTimerMutation({ sessionToken });
  };

  const discard = async () => {
    await discardTimerMutation({ sessionToken });
  };

  const updateDescription = async (description: string) => {
    await updateTimerMutation({ description, sessionToken });
  };

  const updateCard = async (cardId: Id<"cards"> | undefined) => {
    await updateTimerMutation({ cardId, sessionToken });
  };

  return {
    activeTimer,
    elapsedMs,
    isRunning: !!activeTimer,
    isLoading: activeTimer === undefined,
    start,
    stop,
    discard,
    updateDescription,
    updateCard,
  };
}
