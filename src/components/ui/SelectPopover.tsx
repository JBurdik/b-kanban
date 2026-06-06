import type { ReactNode } from "react";
import { BottomSheet } from "./BottomSheet";
import { useIsMobile } from "@/hooks/useIsMobile";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Title shown in the mobile bottom sheet header. */
  title?: string;
  /** Tailwind classes for the desktop absolute panel (positioning + width + surface). */
  desktopClassName?: string;
  children: ReactNode;
}

/**
 * Renders selector option lists responsively:
 *   - mobile (< sm): a full-width slide-up bottom sheet (escapes parent overflow)
 *   - desktop: the original inline absolute-positioned panel (unchanged)
 *
 * The desktop branch is a child of the caller's `relative` container, so it
 * positions exactly as the old inline dropdown did.
 */
export function SelectPopover({ open, onClose, title, desktopClassName, children }: Props) {
  const isMobile = useIsMobile();

  if (!open) return null;

  if (isMobile) {
    return (
      <BottomSheet open onClose={onClose} title={title}>
        {children}
      </BottomSheet>
    );
  }

  return <div className={desktopClassName}>{children}</div>;
}
