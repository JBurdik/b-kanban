// Floating action button (bottom-right) that opens the Codex assistant.

import { useAssistant } from "@/contexts/AssistantContext";

export function AssistantButton() {
  const { available, open, isOpen } = useAssistant();
  if (!available || isOpen) return null;

  return (
    <button
      onClick={open}
      title="Assistant"
      className="fixed bottom-5 right-5 z-[60] w-12 h-12 flex items-center justify-center rounded-full bg-accent text-white shadow-lg hover:opacity-90 hover:scale-105 active:scale-95 transition-all mb-safe"
    >
      {/* sparkle icon */}
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L23 12l-6.714 2.143L14 21l-2.286-6.857L5 12l6.714-2.143L14 3z"
        />
      </svg>
    </button>
  );
}
