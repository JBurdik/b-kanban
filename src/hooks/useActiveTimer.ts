import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export function useActiveTimer(userEmail: string | undefined) {
  const activeTimer = useQuery(
    api.timeTracking.getActiveTimer,
    userEmail ? { userEmail } : "skip"
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
    if (!userEmail) return;
    await startTimerMutation({ userEmail, description, cardId });
  };

  const stop = async () => {
    if (!userEmail) return;
    await stopTimerMutation({ userEmail });
  };

  const discard = async () => {
    if (!userEmail) return;
    await discardTimerMutation({ userEmail });
  };

  const updateDescription = async (description: string) => {
    if (!userEmail) return;
    await updateTimerMutation({ userEmail, description });
  };

  const updateCard = async (cardId: Id<"cards"> | undefined) => {
    if (!userEmail) return;
    await updateTimerMutation({ userEmail, cardId });
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
