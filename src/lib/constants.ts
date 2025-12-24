import type { Priority, BoardRole } from "./types";

// ============================================================================
// App Branding
// ============================================================================

export const APP_NAME = "bProductive";
export const APP_DESCRIPTION = "Modern Kanban Board for Teams";

// ============================================================================
// Priority Configuration
// ============================================================================

export const PRIORITY_CONFIG: Record<Priority, {
  bg: string;
  text: string;
  border: string;
  dot: string;
  ring: string;
}> = {
  low: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-400",
    ring: "ring-emerald-500",
  },
  medium: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-400",
    ring: "ring-amber-500",
  },
  high: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
    dot: "bg-rose-400",
    ring: "ring-rose-500",
  },
};

// ============================================================================
// Role Configuration
// ============================================================================

export const ROLE_LABELS: Record<BoardRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const ROLE_DESCRIPTIONS: Record<BoardRole, string> = {
  owner: "Full control over the board",
  admin: "Can manage columns and members",
  member: "Can create and edit cards",
};

// ============================================================================
// Timing Constants
// ============================================================================

export const AUTO_SAVE_DELAY = 500; // ms
export const DEBOUNCE_DELAY = 300; // ms
export const TOAST_DURATION = 5000; // ms

// ============================================================================
// UI Constants
// ============================================================================

export const PRIORITIES: Priority[] = ["low", "medium", "high"];

export const MODAL_SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-none w-full h-full m-0 rounded-none",
} as const;
