import { useState } from "react";
import { Button } from "@/components/ui/Button";
import clsx from "clsx";

interface SecretItemProps {
  name: string;
  value: string | null; // null when not decrypted
  visibility: "public" | "hidden";
  description?: string;
  group?: { _id: string; name: string; color?: string } | null;
  createdBy?: { name: string; email: string } | null;
  createdAt: number;
  isLocked: boolean;
  canManage: boolean;
  onReveal: () => Promise<string>;
  onCopy: (value: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SecretItem({
  name,
  value,
  visibility,
  description,
  group,
  createdBy,
  createdAt,
  isLocked,
  canManage,
  onReveal,
  onCopy,
  onEdit,
  onDelete,
}: SecretItemProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleReveal = async () => {
    if (isRevealed) {
      setIsRevealed(false);
      setRevealedValue(null);
      return;
    }

    setIsRevealing(true);
    try {
      const decrypted = await onReveal();
      setRevealedValue(decrypted);
      setIsRevealed(true);
    } catch (error) {
      console.error("Failed to reveal secret:", error);
    } finally {
      setIsRevealing(false);
    }
  };

  const handleCopy = async () => {
    let valueToCopy = revealedValue;
    if (!valueToCopy) {
      try {
        valueToCopy = await onReveal();
      } catch {
        return;
      }
    }
    onCopy(valueToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayValue = isRevealed && revealedValue ? revealedValue : "••••••••••••";
  const showByDefault = visibility === "public" && !isLocked && value;

  return (
    <tr className="group hover:bg-dark-hover/50 transition-colors">
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-dark-text">{name}</span>
          {visibility === "hidden" && (
            <span className="text-xs text-dark-muted bg-dark-surface px-1.5 py-0.5 rounded">
              hidden
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-dark-muted mt-0.5 truncate max-w-[200px]">{description}</p>
        )}
      </td>

      {/* Value */}
      <td className="px-4 py-3">
        {isLocked ? (
          <span className="text-dark-muted text-sm italic">Locked</span>
        ) : (
          <div className="flex items-center gap-2">
            <code
              className={clsx(
                "text-sm font-mono px-2 py-1 rounded bg-dark-bg max-w-[300px] truncate",
                isRevealed || showByDefault ? "text-dark-text" : "text-dark-muted"
              )}
            >
              {showByDefault ? value : displayValue}
            </code>
            {!showByDefault && (
              <button
                onClick={handleReveal}
                disabled={isRevealing}
                className="text-dark-muted hover:text-dark-text transition-colors p-1"
                title={isRevealed ? "Hide" : "Reveal"}
              >
                {isRevealing ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : isRevealed ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        )}
      </td>

      {/* Group (only shown in flat view when group prop is passed) */}
      {group !== undefined && (
        <td className="px-4 py-3">
          {group ? (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: group.color || "#6b7280" }}
              />
              <span className="text-dark-muted">{group.name}</span>
            </span>
          ) : (
            <span className="text-sm text-dark-muted/50">Ungrouped</span>
          )}
        </td>
      )}

      {/* Created By */}
      <td className="px-4 py-3">
        <span className="text-sm text-dark-muted" title={new Date(createdAt).toLocaleDateString()}>
          {createdBy?.name || "Unknown"}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isLocked && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? (
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </Button>
          )}
          {canManage && (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit} title="Edit">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} title="Delete">
                <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
