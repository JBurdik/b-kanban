#!/usr/bin/env node
// B Productive MCP server.
//
// Exposes the kanban board to MCP clients (Claude Desktop, Codex, Cursor, …) so
// an assistant can read boards/cards and create/edit them. Talks to the same
// Convex backend the app uses. Auth is by user email (the Convex functions take
// `userEmail`/`authorEmail` params), provided via env — no token needed.
//
// Env:
//   BPRODUCTIVE_CONVEX_URL  Convex deployment URL (VITE_CONVEX_URL)
//   BPRODUCTIVE_EMAIL       the user's email (identity for all operations)
//
// Run: node server.mjs   (communicates over stdio)

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ConvexHttpClient } from "convex/browser";
import { marked } from "marked";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { api } from "../convex/_generated/api.js";

const ACTIVE_CARD_FILE = join(homedir(), ".bproductive", "active.json");

const CONVEX_URL = process.env.BPRODUCTIVE_CONVEX_URL;
const EMAIL = process.env.BPRODUCTIVE_EMAIL;

if (!CONVEX_URL || !EMAIL) {
  console.error(
    "[bproductive-mcp] missing BPRODUCTIVE_CONVEX_URL or BPRODUCTIVE_EMAIL env",
  );
  process.exit(1);
}

const convex = new ConvexHttpClient(CONVEX_URL);

function mdToHtml(md) {
  if (!md) return undefined;
  try {
    return marked.parse(md, { async: false });
  } catch {
    return md;
  }
}

async function resolveColumnId(boardId, columnName) {
  const board = await convex.query(api.boards.get, { boardId, userEmail: EMAIL });
  if (!board) throw new Error("Board not found");
  const col = (board.columns ?? []).find(
    (c) => c.name.toLowerCase() === String(columnName).toLowerCase(),
  );
  if (!col) {
    throw new Error(
      `Column "${columnName}" not found. Available: ${(board.columns ?? [])
        .map((c) => c.name)
        .join(", ")}`,
    );
  }
  return col._id;
}

const TOOLS = [
  {
    name: "list_boards",
    description: "List all kanban boards the user can access.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_board",
    description:
      "Get a board with its columns and cards (slug, title, priority, column).",
    inputSchema: {
      type: "object",
      properties: { boardId: { type: "string" } },
      required: ["boardId"],
      additionalProperties: false,
    },
  },
  {
    name: "create_card",
    description: "Create a card in a board column. Description is Markdown.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        column: { type: "string", description: "Column name (exact)" },
        title: { type: "string" },
        description: { type: "string", description: "Markdown" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        type: { type: "string", enum: ["task", "bug"] },
      },
      required: ["boardId", "column", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_card",
    description:
      "Update a card by slug (e.g. STAT-12). Description is Markdown. Only provided fields change.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        slug: { type: "string" },
        title: { type: "string" },
        description: { type: "string", description: "Markdown" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["boardId", "slug"],
      additionalProperties: false,
    },
  },
  {
    name: "get_active_card",
    description:
      "Get the card the user currently has OPEN in the B Productive desktop app (boardId, slug, title, description). Use this when the user says 'this card' / 'the task I'm looking at'. Returns null if nothing is open.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "add_comment",
    description: "Add a comment to a card identified by slug.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        slug: { type: "string" },
        comment: { type: "string" },
      },
      required: ["boardId", "slug", "comment"],
      additionalProperties: false,
    },
  },
];

async function callTool(name, args) {
  switch (name) {
    case "list_boards": {
      const boards = await convex.query(api.boards.list, { userEmail: EMAIL });
      return (boards ?? []).map((b) => ({
        boardId: b._id,
        name: b.name,
        slugPrefix: b.slugPrefix,
      }));
    }
    case "get_board": {
      const board = await convex.query(api.boards.get, {
        boardId: args.boardId,
        userEmail: EMAIL,
      });
      if (!board) throw new Error("Board not found");
      return {
        boardId: board._id,
        name: board.name,
        columns: (board.columns ?? []).map((c) => ({
          name: c.name,
          cards: (c.cards ?? []).map((card) => ({
            slug: card.slug,
            title: card.title,
            priority: card.priority,
            type: card.type,
          })),
        })),
      };
    }
    case "create_card": {
      const columnId = await resolveColumnId(args.boardId, args.column);
      const cardId = await convex.mutation(api.cards.create, {
        columnId,
        title: args.title,
        content: mdToHtml(args.description),
        priority: args.priority,
        type: args.type,
        userEmail: EMAIL,
      });
      return { created: true, cardId };
    }
    case "update_card": {
      const card = await convex.query(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      await convex.mutation(api.cards.update, {
        cardId: card._id,
        title: args.title,
        content:
          args.description !== undefined ? mdToHtml(args.description) : undefined,
        priority: args.priority,
        currentUserEmail: EMAIL,
      });
      return { updated: true, slug: args.slug };
    }
    case "get_active_card": {
      try {
        const raw = readFileSync(ACTIVE_CARD_FILE, "utf8");
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    case "add_comment": {
      const card = await convex.query(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      await convex.mutation(api.comments.create, {
        cardId: card._id,
        content: args.comment,
        authorEmail: EMAIL,
      });
      return { commented: true, slug: args.slug };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: "bproductive", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const result = await callTool(req.params.name, req.params.arguments ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (e) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${e?.message ?? String(e)}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[bproductive-mcp] ready");
