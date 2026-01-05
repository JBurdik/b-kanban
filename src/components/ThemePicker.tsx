import { useState, type ReactNode } from "react";
import {
  useTheme,
  type ThemeMode,
  type AccentColor,
} from "@/contexts/ThemeContext";

const ACCENT_COLORS: { value: AccentColor; label: string; color: string }[] = [
  { value: "amber", label: "Amber", color: "#f59e0b" },
  { value: "blue", label: "Blue", color: "#3b82f6" },
  { value: "green", label: "Green", color: "#22c55e" },
  { value: "purple", label: "Purple", color: "#a855f7" },
  { value: "pink", label: "Pink", color: "#ec4899" },
  { value: "red", label: "Red", color: "#ef4444" },
  { value: "teal", label: "Teal", color: "#14b8a6" },
];

const THEME_MODES: { value: ThemeMode; label: string; icon: ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    ),
  },
  {
    value: "system",
    label: "System",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>
    ),
  },
];

interface ThemePickerProps {
  onClose?: () => void;
}

export function ThemePicker({ onClose }: ThemePickerProps) {
  const { mode, accent, setMode, setAccent } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const currentAccent = ACCENT_COLORS.find((c) => c.value === accent);

  return (
    <div>
      {/* Toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between gap-3 w-full px-4 py-2 text-sm text-dark-text hover:bg-dark-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: currentAccent?.color }}
          />
          <span>Theme</span>
        </div>
        <svg
          className={`w-4 h-4 text-dark-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 border-t border-dark-border bg-dark-bg/50">
          {/* Mode selector */}
          <p className="text-xs text-dark-muted mb-2 font-medium">Mode</p>
          <div className="flex gap-1 mb-3">
            {THEME_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs transition-colors ${
                  mode === m.value
                    ? "bg-accent text-white"
                    : "bg-dark-surface text-dark-muted hover:text-dark-text hover:bg-dark-hover"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          {/* Accent color selector */}
          <p className="text-xs text-dark-muted mb-2 font-medium">Accent Color</p>
          <div className="flex gap-2 flex-wrap">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setAccent(c.value);
                  onClose?.();
                }}
                title={c.label}
                className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                  accent === c.value
                    ? "ring-2 ring-offset-2 ring-offset-dark-bg ring-white"
                    : ""
                }`}
                style={{ backgroundColor: c.color }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone theme toggle button for quick access
export function ThemeToggle() {
  const { mode, setMode, resolvedMode } = useTheme();

  const toggleMode = () => {
    if (mode === "system") {
      setMode(resolvedMode === "dark" ? "light" : "dark");
    } else {
      setMode(mode === "dark" ? "light" : "dark");
    }
  };

  return (
    <button
      onClick={toggleMode}
      className="p-2 rounded-lg hover:bg-dark-hover transition-colors text-dark-muted hover:text-dark-text"
      title={`Switch to ${resolvedMode === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedMode === "dark" ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}
