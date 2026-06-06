import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { Label } from "@/lib/types";
import { LabelBadge } from "@/components/ui/LabelBadge";
import { SelectPopover } from "@/components/ui/SelectPopover";
import { useIsMobile } from "@/hooks/useIsMobile";

interface Props {
  boardId: Id<"boards">;
  cardId: Id<"cards">;
  currentLabels: Label[];
  userEmail?: string;
  onOpenManager?: () => void;
}

export function LabelSelector({ boardId, cardId, currentLabels, userEmail, onOpenManager }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const allLabels = useQuery(api.labels.list, { boardId, userEmail });
  const addLabel = useMutation(api.labels.addToCard);
  const removeLabel = useMutation(api.labels.removeFromCard);

  // Close dropdown when clicking outside (skip on mobile — the sheet owns dismissal)
  useEffect(() => {
    if (isMobile) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  const currentLabelIds = new Set(currentLabels.map((l) => l._id));

  const handleToggleLabel = async (labelId: Id<"labels">) => {
    if (!userEmail) return;
    if (currentLabelIds.has(labelId)) {
      await removeLabel({ cardId, labelId, userEmail });
    } else {
      await addLabel({ cardId, labelId, userEmail });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors w-full"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        Labels
        {currentLabels.length > 0 && (
          <span className="ml-auto bg-dark-border text-dark-text px-1.5 py-0.5 rounded text-xs">
            {currentLabels.length}
          </span>
        )}
      </button>

      {/* Current labels display */}
      {currentLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 px-3">
          {currentLabels.map((label) => (
            <LabelBadge
              key={label._id}
              label={label}
              size="sm"
              onRemove={userEmail ? () => removeLabel({ cardId, labelId: label._id, userEmail }) : undefined}
            />
          ))}
        </div>
      )}

      {/* Dropdown / mobile bottom sheet */}
      <SelectPopover
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title="Labels"
        desktopClassName="absolute z-50 left-0 mt-1 w-64 bg-dark-surface border border-dark-border rounded-lg shadow-xl overflow-hidden"
      >
          <div className="p-2 border-b border-dark-border">
            <span className="text-xs font-medium text-dark-muted uppercase tracking-wide">
              Labels
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto p-2 space-y-1">
            {!allLabels || allLabels.length === 0 ? (
              <p className="text-sm text-dark-muted text-center py-4">
                No labels yet
              </p>
            ) : (
              allLabels.map((label) => {
                const isSelected = currentLabelIds.has(label._id);
                return (
                  <button
                    key={label._id}
                    onClick={() => handleToggleLabel(label._id)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-dark-hover transition-colors"
                  >
                    <span
                      className={`flex-1 px-3 py-1.5 rounded text-sm font-medium ${label.color} ${label.textColor}`}
                    >
                      {label.name}
                    </span>
                    {isSelected && (
                      <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {onOpenManager && (
            <div className="p-2 border-t border-dark-border">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenManager();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Manage labels
              </button>
            </div>
          )}
      </SelectPopover>
    </div>
  );
}
