import { useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutEntry {
  label: string;
  keys: string[];
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const sections: ShortcutSection[] = [
  {
    title: "Board Navigation",
    shortcuts: [
      { label: "Move up / down between cards", keys: ["\u2191", "\u2193"] },
      { label: "Move left / right between columns", keys: ["\u2190", "\u2192"] },
      { label: "Open selected card", keys: ["Enter"] },
      { label: "Clear selection", keys: ["Escape"] },
    ],
  },
  {
    title: "Board Actions",
    shortcuts: [
      { label: "New card in current column", keys: ["N"] },
      { label: "Edit selected card", keys: ["E"] },
      { label: "Archive selected card", keys: ["A"] },
    ],
  },
  {
    title: "Card Detail",
    shortcuts: [
      { label: "Set priority: Low", keys: ["1"] },
      { label: "Set priority: Medium", keys: ["2"] },
      { label: "Set priority: High", keys: ["3"] },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { label: "Go to boards", keys: ["B"] },
      { label: "Show keyboard shortcuts", keys: ["?"] },
      { label: "Open spotlight search", keys: ["\u2318K"] },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-dark-surface border border-dark-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold text-dark-text">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-dark-text transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-medium text-dark-muted uppercase tracking-wide mb-3">
                {section.title}
              </h3>
              <div className="space-y-2">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-dark-text">
                      {shortcut.label}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="px-2 py-0.5 text-xs font-mono bg-dark-hover border border-dark-border rounded text-dark-text"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
