import { useState, useEffect } from "react";

/**
 * Tracks whether the viewport is phone-sized (Tailwind `sm` breakpoint, < 640px).
 * Used to switch dropdowns to full-width bottom sheets on mobile.
 */
export function useIsMobile(query = "(max-width: 639px)"): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
