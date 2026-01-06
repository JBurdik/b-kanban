import { Modal, ModalFooter } from "./Modal";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog closes (cancel or backdrop click) */
  onClose: () => void;
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Dialog title */
  title: string;
  /** Dialog message/description */
  message: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button variant - use "danger" for destructive actions */
  variant?: "primary" | "danger";
  /** Whether confirm action is loading */
  loading?: boolean;
}

/**
 * Confirmation dialog for destructive or important actions.
 *
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={showDelete}
 *   onClose={() => setShowDelete(false)}
 *   onConfirm={handleDelete}
 *   title="Delete Board"
 *   message="Are you sure you want to delete this board? This action cannot be undone."
 *   confirmText="Delete"
 *   variant="danger"
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary",
  loading = false,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    if (!loading) {
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      showCloseButton={false}
      zIndex={60}
    >
      <p className="text-dark-muted">{message}</p>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === "danger" ? "danger" : "primary"}
          onClick={handleConfirm}
          loading={loading}
        >
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
