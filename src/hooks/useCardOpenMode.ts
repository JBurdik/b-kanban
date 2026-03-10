import { useState, useCallback } from "react";

export type CardOpenMode = "sidebar" | "fullscreen";

const STORAGE_KEY = "card-open-mode";

function getStoredMode(): CardOpenMode {
  if (typeof window === "undefined") return "sidebar";
  return (localStorage.getItem(STORAGE_KEY) as CardOpenMode) || "sidebar";
}

export function useCardOpenMode() {
  const [mode, setModeState] = useState<CardOpenMode>(getStoredMode);

  const setMode = useCallback((newMode: CardOpenMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  }, []);

  return { mode, setMode };
}
