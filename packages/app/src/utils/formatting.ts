// ============================================================================
// Date Formatting
// ============================================================================

/**
 * Format a timestamp as a short date string (e.g., "12/25/2024")
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format a timestamp as a long date string (e.g., "Dec 25, 2024")
 */
export function formatDateLong(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a timestamp as a relative time string (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(timestamp);
}

/**
 * Format a timestamp as a datetime string for display
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================================================
// Text Formatting
// ============================================================================

/**
 * Strip HTML tags from a string
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Check if a string contains HTML content
 */
export function isHtmlContent(content: string): boolean {
  return content.startsWith("<") && content.includes(">");
}

/**
 * Check if HTML content has actual text (not just empty tags)
 */
export function hasTextContent(html: string): boolean {
  const text = stripHtml(html).trim();
  return text.length > 0;
}

/**
 * Truncate a string to a maximum length, adding ellipsis if needed
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Format effort hours (e.g., "2h", "0.5h")
 */
export function formatEffort(hours?: number): string {
  if (hours === undefined || hours === null) return "0h";
  return `${hours}h`;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
