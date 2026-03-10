import { useState, useCallback, useEffect, useRef } from "react";
import type { Id } from "convex/_generated/dataModel";
import type { Priority, CardType } from "@/lib/types";

export interface CardFormData {
  title: string;
  content: string;
  priority?: Priority;
  type?: CardType;
  columnId: Id<"columns">;
  assigneeId?: Id<"users">;
  effort?: number;
}

type FieldKey = keyof CardFormData;

interface UseCardFormStateOptions {
  /** The card data from the server (real-time) */
  serverData: CardFormData;
}

interface UseCardFormStateReturn {
  /** Current form values */
  values: CardFormData;
  /** Set a specific field value (marks it as dirty) */
  setField: <K extends FieldKey>(field: K, value: CardFormData[K]) => void;
  /** Get only the fields that have been modified */
  getDirtyFields: () => Partial<CardFormData>;
  /** Check if there are any unsaved changes */
  hasChanges: boolean;
  /** Reset dirty state (call after successful save) */
  markSaved: () => void;
}

/**
 * Hook for managing card form state with proper concurrency handling.
 *
 * Solves the multi-user editing problem by:
 * 1. Tracking which fields the current user has modified (dirty fields)
 * 2. Syncing unmodified fields when server data changes (from other users)
 * 3. Only sending dirty fields when saving (prevents overwriting other users' changes)
 *
 * @example
 * ```tsx
 * const { values, setField, getDirtyFields, hasChanges } = useCardFormState({
 *   serverData: {
 *     title: card.title,
 *     content: card.content || "",
 *     priority: card.priority,
 *     columnId: card.columnId,
 *     assigneeId: card.assignee?.id,
 *     effort: card.effort,
 *   },
 * });
 *
 * // Use values.title, values.content, etc. for display
 * // Use setField("title", newValue) to update
 * // Use getDirtyFields() when saving to only send changed fields
 * ```
 */
export function useCardFormState({
  serverData,
}: UseCardFormStateOptions): UseCardFormStateReturn {
  // Track dirty fields - fields that the user has modified
  const [dirtyFields, setDirtyFields] = useState<Set<FieldKey>>(new Set());

  // Local form values
  const [localValues, setLocalValues] = useState<CardFormData>(serverData);

  // Track server data for comparison
  const prevServerDataRef = useRef<CardFormData>(serverData);

  // Sync unmodified fields when server data changes
  useEffect(() => {
    const prevData = prevServerDataRef.current;

    // Check if server data has actually changed
    if (JSON.stringify(prevData) === JSON.stringify(serverData)) {
      return;
    }

    // Update local values for fields that aren't dirty
    setLocalValues((current) => {
      const updated = { ...current };

      (Object.keys(serverData) as FieldKey[]).forEach((key) => {
        if (!dirtyFields.has(key)) {
          // This field hasn't been modified by user, sync with server
          (updated as Record<string, unknown>)[key] = serverData[key];
        }
      });

      return updated;
    });

    prevServerDataRef.current = serverData;
  }, [serverData, dirtyFields]);

  // Set a field value and mark it as dirty
  const setField = useCallback(<K extends FieldKey>(
    field: K,
    value: CardFormData[K]
  ) => {
    setLocalValues((current) => ({
      ...current,
      [field]: value,
    }));

    setDirtyFields((current) => {
      const updated = new Set(current);
      updated.add(field);
      return updated;
    });
  }, []);

  // Get only the dirty fields for saving
  const getDirtyFields = useCallback((): Partial<CardFormData> => {
    const result: Partial<CardFormData> = {};

    dirtyFields.forEach((field) => {
      (result as Record<string, unknown>)[field] = localValues[field];
    });

    return result;
  }, [dirtyFields, localValues]);

  // Check if there are unsaved changes
  const hasChanges = dirtyFields.size > 0 &&
    Array.from(dirtyFields).some((field) => {
      return JSON.stringify(localValues[field]) !== JSON.stringify(serverData[field]);
    });

  // Mark all dirty fields as saved
  const markSaved = useCallback(() => {
    // Update the reference to current server data
    prevServerDataRef.current = serverData;
    // Clear dirty tracking
    setDirtyFields(new Set());
  }, [serverData]);

  return {
    values: localValues,
    setField,
    getDirtyFields,
    hasChanges,
    markSaved,
  };
}
