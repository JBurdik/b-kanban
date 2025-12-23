import { type ReactNode } from "react";
import * as Dialog from "@base-ui-components/react/dialog";
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
 * Modal dialog component built on base-ui Dialog.
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
 *   <div className="flex gap-2 mt-4">
 *     <Button onClick={() => setIsOpen(false)}>Cancel</Button>
 *     <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
 *   </div>
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
  // Use escape key hook for consistent behavior
  useEscapeKey(onClose, open);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={clsx(
            "fixed inset-0 bg-black/60 backdrop-blur-sm z-50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
          onClick={closeOnBackdropClick ? onClose : undefined}
        />
        <Dialog.Popup
          className={clsx(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full p-4",
            sizeStyles[size]
          )}
        >
          <div
            className={clsx(
              "bg-dark-surface border border-dark-border rounded-xl shadow-xl",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              size === "full" ? "h-full" : ""
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between p-4 border-b border-dark-border">
                <div className="flex-1">
                  {title && (
                    <Dialog.Title className="text-lg font-semibold text-dark-text">
                      {title}
                    </Dialog.Title>
                  )}
                  {description && (
                    <Dialog.Description className="text-sm text-dark-muted mt-1">
                      {description}
                    </Dialog.Description>
                  )}
                </div>
                {showCloseButton && (
                  <Dialog.Close
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
                  </Dialog.Close>
                )}
              </div>
            )}

            {/* Content */}
            <div className={clsx("p-4", size === "full" && "h-[calc(100%-4rem)] overflow-y-auto")}>
              {children}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Simple modal footer with action buttons
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
