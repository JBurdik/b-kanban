import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY_PREFIX = "board_passphrase_";

interface PassphraseState {
  passphrase: string | null;
  isUnlocked: boolean;
  setPassphrase: (passphrase: string) => void;
  clearPassphrase: () => void;
}

/**
 * Hook to manage board passphrase state
 * Caches passphrase in sessionStorage for the browser session
 */
export function useBoardPassphrase(boardId: string): PassphraseState {
  const storageKey = `${STORAGE_KEY_PREFIX}${boardId}`;

  const [passphrase, setLocalPassphrase] = useState<string | null>(() => {
    // Check sessionStorage on mount
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(storageKey);
    }
    return null;
  });

  // Sync with sessionStorage when boardId changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(storageKey);
      setLocalPassphrase(stored);
    }
  }, [storageKey]);

  const setPassphrase = useCallback(
    (pass: string) => {
      sessionStorage.setItem(storageKey, pass);
      setLocalPassphrase(pass);
    },
    [storageKey]
  );

  const clearPassphrase = useCallback(() => {
    sessionStorage.removeItem(storageKey);
    setLocalPassphrase(null);
  }, [storageKey]);

  return {
    passphrase,
    isUnlocked: passphrase !== null,
    setPassphrase,
    clearPassphrase,
  };
}
