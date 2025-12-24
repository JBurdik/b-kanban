import { useEffect, useRef, type RefObject } from "react";

/**
 * Hook to detect clicks outside of an element.
 * Useful for closing dropdowns, popovers, and modals.
 *
 * @param callback - Function to call when clicking outside
 * @param enabled - Whether the hook should be active (default: true)
 * @returns A ref to attach to the element
 *
 * @example
 * ```tsx
 * function Dropdown({ onClose }) {
 *   const dropdownRef = useClickOutside<HTMLDivElement>(onClose);
 *
 *   return (
 *     <div ref={dropdownRef} className="dropdown">
 *       Dropdown content
 *     </div>
 *   );
 * }
 * ```
 */
export function useClickOutside<T extends HTMLElement>(
  callback: () => void,
  enabled = true
): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    const handleTouch = (event: TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };

    // Use mousedown instead of click for better UX
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleTouch);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleTouch);
    };
  }, [callback, enabled]);

  return ref;
}

/**
 * Hook to detect clicks outside of multiple elements.
 *
 * @param refs - Array of refs to check against
 * @param callback - Function to call when clicking outside all refs
 * @param enabled - Whether the hook should be active (default: true)
 *
 * @example
 * ```tsx
 * function DropdownWithTrigger({ onClose }) {
 *   const triggerRef = useRef<HTMLButtonElement>(null);
 *   const dropdownRef = useRef<HTMLDivElement>(null);
 *
 *   useClickOutsideMultiple([triggerRef, dropdownRef], onClose);
 *
 *   return (
 *     <>
 *       <button ref={triggerRef}>Toggle</button>
 *       <div ref={dropdownRef}>Dropdown</div>
 *     </>
 *   );
 * }
 * ```
 */
export function useClickOutsideMultiple(
  refs: RefObject<HTMLElement | null>[],
  callback: () => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent) => {
      const isOutside = refs.every(
        (ref) => ref.current && !ref.current.contains(event.target as Node)
      );
      if (isOutside) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [refs, callback, enabled]);
}
