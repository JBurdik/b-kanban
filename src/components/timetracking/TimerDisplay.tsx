import { useState } from "react";
import { formatTimerDisplay } from "@/lib/timeUtils";
import { TaskSelector } from "./TaskSelector";
import type { Id } from "convex/_generated/dataModel";

interface TimerDisplayProps {
  userEmail: string;
  isRunning: boolean;
  elapsedMs: number;
  description?: string;
  cardInfo?: { slug: string; title: string } | null;
  onStart: (description: string, cardId?: Id<"cards">) => void;
  onStop: () => void;
  onDiscard: () => void;
}

export function TimerDisplay({
  userEmail,
  isRunning,
  elapsedMs,
  description,
  cardInfo,
  onStart,
  onStop,
  onDiscard,
}: TimerDisplayProps) {
  const [inputDescription, setInputDescription] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<Id<"cards"> | null>(null);

  const handleStart = () => {
    if (inputDescription.trim()) {
      onStart(inputDescription.trim(), selectedCardId ?? undefined);
      setInputDescription("");
      setSelectedCardId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isRunning) {
      handleStart();
    }
  };

  if (isRunning) {
    return (
      <div className="space-y-4">
        {/* Timer display */}
        <div className="text-center">
          <div className="text-4xl font-mono font-bold text-accent mb-2">
            {formatTimerDisplay(elapsedMs)}
          </div>
          <p className="text-dark-muted text-sm truncate">
            {description || "Working..."}
          </p>
          {cardInfo && (
            <p className="text-xs text-dark-muted mt-1">
              <span className="font-mono">{cardInfo.slug}</span> - {cardInfo.title}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={onStop}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
            Stop
          </button>
          <button
            onClick={onDiscard}
            className="px-4 py-2 bg-dark-hover hover:bg-dark-border text-dark-muted rounded-lg transition-colors"
            title="Discard timer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Description input */}
      <input
        type="text"
        value={inputDescription}
        onChange={(e) => setInputDescription(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What are you working on?"
        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
      />

      {/* Task selector */}
      <TaskSelector
        userEmail={userEmail}
        value={selectedCardId}
        onChange={setSelectedCardId}
      />

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!inputDescription.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 disabled:bg-dark-hover disabled:text-dark-muted text-white rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
        Start Timer
      </button>
    </div>
  );
}
