/**
 * Extract mentioned user IDs from HTML content
 */
export function extractMentionedUserIds(html: string): string[] {
  // Match data-id attributes from mention spans
  // Example: <span data-type="mention" data-id="k17abc..." data-label="John">@John</span>
  const mentionRegex = /data-id="([^"]+)"/g;
  const ids: string[] = [];
  let match;

  while ((match = mentionRegex.exec(html)) !== null) {
    const id = match[1];
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids;
}
