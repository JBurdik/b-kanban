import { type ReactNode, useEffect } from "react";
import clsx from "clsx";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when the modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal description */
  description?: string;
  /** Modal content */
  children: ReactNode;
  /** Modal size */
  size?: "sm" | "md" | "lg" | "xl" | "full";
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Whether clicking backdrop closes modal */
  closeOnBackdropClick?: boolean;
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-none w-full h-full m-0 rounded-none",
};

/**
 * Modal dialog component.
 *
 * @example
 * ```tsx
 * <Modal
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Confirm Action"
 *   size="sm"
 * >
 *   <p>Are you sure you want to proceed?</p>
 *   <ModalFooter>
 *     <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
 *     <Button onClick={handleConfirm}>Confirm</Button>
 *   </ModalFooter>
 * </Modal>
 * ```
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  showCloseButton = true,
  closeOnBackdropClick = true,
}: ModalProps) {
  // Handle escape key
  useEscapeKey(onClose, open);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={closeOnBackdropClick ? onClose : undefined}
      />

      {/* Modal container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className={clsx(
            "relative w-full bg-dark-surface border border-dark-border rounded-xl shadow-xl",
            "animate-fade-in",
            sizeStyles[size],
            size === "full" ? "h-full" : ""
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between p-4 border-b border-dark-border">
              <div className="flex-1">
                {title && (
                  <h2 className="text-lg font-semibold text-dark-text">{title}</h2>
                )}
                {description && (
                  <p className="text-sm text-dark-muted mt-1">{description}</p>
                )}
              </div>
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className={clsx(
                    "p-1 rounded-lg text-dark-muted",
                    "hover:text-dark-text hover:bg-dark-hover",
                    "focus:outline-none focus:ring-2 focus:ring-accent",
                    "transition-colors"
                  )}
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
              )}
            </div>
          )}

          {/* Content */}
          <div
            className={clsx(
              "p-4",
              size === "full" && "h-[calc(100%-4rem)] overflow-y-auto"
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Footer for modal with action buttons
 */
export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-end gap-2 pt-4 mt-4 border-t border-dark-border",
        className
      )}
    >
      {children}
    </div>
  );
}
