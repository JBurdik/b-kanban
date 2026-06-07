// Parses an optional JSON action proposal out of Codex's reply.
//
// The assistant appends a fenced ```json block when it wants to create/edit
// cards. We extract + defensively validate it; on any problem we return no
// proposal and treat the whole reply as chat (fail safe — never apply junk).

export type CreateCardProposal = {
  columnName: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  type?: "task" | "bug";
};

export type UpdateCardProposal = {
  slug: string;
  title?: string;
  description?: string;
};

export type CardProposal = {
  create_cards?: CreateCardProposal[];
  update_card?: UpdateCardProposal;
};

const PRIORITIES = new Set(["low", "medium", "high"]);
const TYPES = new Set(["task", "bug"]);

const FENCE = /```json\s*([\s\S]*?)```/gi;

function lastJsonBlock(text: string): { json: string; start: number; end: number } | null {
  let match: RegExpExecArray | null;
  let last: { json: string; start: number; end: number } | null = null;
  FENCE.lastIndex = 0;
  while ((match = FENCE.exec(text)) !== null) {
    last = { json: match[1], start: match.index, end: match.index + match[0].length };
  }
  return last;
}

function validateCreate(
  raw: unknown,
  validColumns: Set<string>,
): CreateCardProposal | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.columnName !== "string" || !validColumns.has(o.columnName)) return null;
  if (typeof o.title !== "string" || o.title.trim() === "") return null;
  const out: CreateCardProposal = { columnName: o.columnName, title: o.title };
  if (typeof o.description === "string") out.description = o.description;
  if (typeof o.priority === "string" && PRIORITIES.has(o.priority)) {
    out.priority = o.priority as CreateCardProposal["priority"];
  }
  if (typeof o.type === "string" && TYPES.has(o.type)) {
    out.type = o.type as CreateCardProposal["type"];
  }
  return out;
}

function validateUpdate(
  raw: unknown,
  validSlugs: Set<string>,
): UpdateCardProposal | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.slug !== "string" || !validSlugs.has(o.slug)) return null;
  const out: UpdateCardProposal = { slug: o.slug };
  if (typeof o.title === "string") out.title = o.title;
  if (typeof o.description === "string") out.description = o.description;
  // An update with no actual field change is meaningless.
  if (out.title === undefined && out.description === undefined) return null;
  return out;
}

export function extractProposal(
  text: string,
  validColumns: Set<string>,
  validSlugs: Set<string>,
): { proposal: CardProposal | null; chat: string } {
  const block = lastJsonBlock(text);
  if (!block) return { proposal: null, chat: text };

  let parsed: unknown;
  try {
    parsed = JSON.parse(block.json.trim());
  } catch {
    return { proposal: null, chat: text };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { proposal: null, chat: text };
  }

  const o = parsed as Record<string, unknown>;
  const proposal: CardProposal = {};

  if (Array.isArray(o.create_cards)) {
    const cards = o.create_cards
      .map((c) => validateCreate(c, validColumns))
      .filter((c): c is CreateCardProposal => c !== null);
    if (cards.length > 0) proposal.create_cards = cards;
  }
  if (o.update_card !== undefined) {
    const upd = validateUpdate(o.update_card, validSlugs);
    if (upd) proposal.update_card = upd;
  }

  if (!proposal.create_cards && !proposal.update_card) {
    return { proposal: null, chat: text };
  }

  // Strip the JSON block so the chat bubble shows prose only.
  const chat = (text.slice(0, block.start) + text.slice(block.end)).trim();
  return { proposal, chat };
}
