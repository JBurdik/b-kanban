import { useEffect, useRef, useState, useCallback } from "react";
import { AUTO_SAVE_DELAY } from "@/lib/constants";

interface UseAutoSaveOptions<T> {
  /** Current data to save */
  data: T;
  /** Original data to compare against */
  originalData: T;
  /** Function to call when saving */
  onSave: (data: T) => Promise<void>;
  /** Delay in ms before saving (default: 500) */
  delay?: number;
  /** Custom comparison function (default: JSON.stringify comparison) */
  compare?: (a: T, b: T) => boolean;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  /** Whether a save is currently in progress */
  isSaving: boolean;
  /** Whether there are unsaved changes */
  hasChanges: boolean;
  /** Manually trigger a save */
  saveNow: () => Promise<void>;
}

/**
 * Hook for auto-saving data with debounce.
 * Automatically saves when data changes after a delay.
 *
 * @example
 * ```tsx
 * function Editor({ card }) {
 *   const [title, setTitle] = useState(card.title);
 *   const [content, setContent] = useState(card.content);
 *
 *   const { isSaving, hasChanges } = useAutoSave({
 *     data: { title, content },
 *     originalData: { title: card.title, content: card.content },
 *     onSave: async (data) => {
 *       await updateCard({ ...data, cardId: card._id });
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       {isSaving && <span>Saving...</span>}
 *       {hasChanges && !isSaving && <span>Unsaved changes</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAutoSave<T>({
  data,
  originalData,
  onSave,
  delay = AUTO_SAVE_DELAY,
  compare = (a, b) => JSON.stringify(a) === JSON.stringify(b),
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef(data);

  // Keep track of the latest data for manual save
  latestDataRef.current = data;

  const hasChanges = !compare(data, originalData);

  const saveNow = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (!compare(latestDataRef.current, originalData)) {
      setIsSaving(true);
      try {
        await onSave(latestDataRef.current);
      } finally {
        setIsSaving(false);
      }
    }
  }, [onSave, originalData, compare]);

  useEffect(() => {
    if (!enabled || compare(data, originalData)) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await onSave(data);
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, originalData, onSave, delay, compare, enabled]);

  return { isSaving, hasChanges, saveNow };
}
