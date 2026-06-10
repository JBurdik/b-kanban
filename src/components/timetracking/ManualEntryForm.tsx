import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { TaskSelector } from "./TaskSelector";
import type { Id } from "convex/_generated/dataModel";

interface ManualEntryFormProps {
  userEmail: string;
  onSuccess?: () => void;
}

export function ManualEntryForm({ userEmail, onSuccess }: ManualEntryFormProps) {
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<Id<"cards"> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addEntry = useMutation(api.timeTracking.addManualEntry);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hoursNum = parseInt(hours) || 0;
    const minutesNum = parseInt(minutes) || 0;

    if (!description.trim()) return;
    if (hoursNum === 0 && minutesNum === 0) return;

    setIsSubmitting(true);
    try {
      await addEntry({
        userEmail,
        description: description.trim(),
        hours: hoursNum,
        minutes: minutesNum,
        cardId: selectedCardId ?? undefined,
      });

      // Reset form
      setDescription("");
      setHours("");
      setMinutes("");
      setSelectedCardId(null);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to add entry:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid =
    description.trim() && (parseInt(hours) > 0 || parseInt(minutes) > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Description */}
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What did you work on?"
        className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
      />

      {/* Time inputs */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-dark-muted mb-1">Hours</label>
          <input
            type="number"
            min="0"
            max="99"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-center"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-dark-muted mb-1">Minutes</label>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-center"
          />
        </div>
      </div>

      {/* Task selector */}
      <TaskSelector
        userEmail={userEmail}
        value={selectedCardId}
        onChange={setSelectedCardId}
      />

      {/* Submit button */}
      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 disabled:bg-dark-hover disabled:text-dark-muted text-white rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        {isSubmitting ? "Adding..." : "Add Entry"}
      </button>
    </form>
  );
}
