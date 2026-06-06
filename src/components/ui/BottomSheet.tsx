import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Mobile slide-up bottom sheet. Hidden on >= sm (desktop uses inline UI).
 * Respects the iOS home-indicator inset via pb-safe.
 */
export function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] sm:hidden">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 bg-dark-surface rounded-t-2xl border-t border-dark-border shadow-2xl pb-safe animate-slide-up max-h-[80vh] overflow-y-auto">
        {/* Grab handle */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-dark-border" />
        </div>
        {title && (
          <h3 className="px-4 pt-1 pb-2 text-sm font-semibold text-dark-muted">
            {title}
          </h3>
        )}
        <div className="px-2 pb-2">{children}</div>
      </div>
    </div>,
    document.body
  );
}
