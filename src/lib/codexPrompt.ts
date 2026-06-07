// Builds the prompt sent to Codex for a chat turn.
//
// We inject a compact, read-only snapshot of the current board so the assistant
// can reference real columns and cards, plus rules for emitting an actionable
// JSON proposal block that the app parses and applies (with user confirmation).

export type AssistantColumn = {
  name: string;
  cards: { slug: string; title: string }[];
};

export type AssistantBoardContext = {
  name: string;
  columns: AssistantColumn[];
};

export type AssistantActiveCard = {
  slug: string;
  title: string;
  description?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>(?=)/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MAX_CARDS = 100;

const RULES = `You are a kanban assistant inside a project board app. You help the user write and improve task titles and descriptions, and create or edit cards.

Two jobs:
1. Chat normally (plain prose) to help word and shape tasks.
2. ONLY when the user clearly wants to create or change cards, append ONE fenced JSON block at the very END of your reply, in exactly this form:

\`\`\`json
{
  "create_cards": [
    { "columnName": "<exact column name>", "title": "...", "description": "<markdown>", "priority": "low|medium|high", "type": "task|bug" }
  ],
  "update_card": { "slug": "<existing card slug>", "title": "...", "description": "<markdown>" }
}
\`\`\`

Rules:
- Include "create_cards" only when creating; include "update_card" only when editing one existing card. Omit the whole block entirely for normal conversation.
- "columnName" MUST exactly match one of the board columns listed below.
- "slug" MUST match an existing card slug listed below.
- "priority" and "type" are optional; descriptions are Markdown.
- Put conversational prose BEFORE the block and NOTHING after it.`;

function boardSnapshot(board: AssistantBoardContext): string {
  const lines: string[] = [`Current board: "${board.name}"`, "Columns:"];
  for (const col of board.columns) {
    lines.push(`- ${col.name}`);
  }
  const cards: string[] = [];
  for (const col of board.columns) {
    for (const c of col.cards) {
      cards.push(`  - [${col.name}] ${c.slug}: ${c.title}`);
      if (cards.length >= MAX_CARDS) break;
    }
    if (cards.length >= MAX_CARDS) break;
  }
  if (cards.length > 0) {
    lines.push("Existing cards:");
    lines.push(...cards);
  }
  return lines.join("\n");
}

export function buildPrompt(opts: {
  board: AssistantBoardContext | null;
  activeCard?: AssistantActiveCard | null;
  userMessage: string;
}): string {
  const parts = [RULES];
  if (opts.board) {
    parts.push(boardSnapshot(opts.board));
  } else {
    parts.push(
      "No board is currently open, so do not propose card changes — chat only.",
    );
  }
  if (opts.activeCard) {
    const desc = opts.activeCard.description
      ? stripHtml(opts.activeCard.description)
      : "(empty)";
    parts.push(
      `The user currently has this card OPEN and is looking at it:\n` +
        `Slug: ${opts.activeCard.slug}\n` +
        `Title: ${opts.activeCard.title}\n` +
        `Current description:\n${desc}\n\n` +
        `When the user refers to "this card", "this task", "the description", ` +
        `etc., they mean ${opts.activeCard.slug}. To change it, use ` +
        `"update_card" with slug "${opts.activeCard.slug}".`,
    );
  }
  parts.push(`User: ${opts.userMessage}`);
  return parts.join("\n\n");
}
