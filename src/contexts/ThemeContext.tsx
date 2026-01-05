import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor =
  | "amber"
  | "blue"
  | "green"
  | "purple"
  | "pink"
  | "red"
  | "teal";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentColor;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  resolvedMode: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY_MODE = "theme-mode";
const STORAGE_KEY_ACCENT = "theme-accent";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem(STORAGE_KEY_MODE);
    return (stored as ThemeMode) || "system";
  });

  const [accent, setAccentState] = useState<AccentColor>(() => {
    if (typeof window === "undefined") return "amber";
    const stored = localStorage.getItem(STORAGE_KEY_ACCENT);
    return (stored as AccentColor) || "amber";
  });

  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    if (mode === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return mode;
  });

  // Handle mode changes and system preference
  useEffect(() => {
    const root = document.documentElement;

    const applyMode = (isDark: boolean) => {
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      setResolvedMode(isDark ? "dark" : "light");
    };

    if (mode === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyMode(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => applyMode(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      applyMode(mode === "dark");
    }
  }, [mode]);

  // Handle accent changes
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
  }, [accent]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY_MODE, newMode);
  };

  const setAccent = (newAccent: AccentColor) => {
    setAccentState(newAccent);
    localStorage.setItem(STORAGE_KEY_ACCENT, newAccent);
  };

  return (
    <ThemeContext.Provider
      value={{ mode, accent, setMode, setAccent, resolvedMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
