// Remote MCP server over HTTP (MCP Streamable HTTP transport).
//
// Exposes the kanban board to Claude Code / any MCP client that supports remote
// HTTP servers. JSON-RPC 2.0 over a single POST; responses are plain
// application/json (no SSE needed for request/response). Authenticated by a
// per-user Bearer API key (see convex/mcpKeys.ts) — the resolved email is the
// identity passed to the existing Convex functions.
//
// Wired into the router in convex/http.ts at path "/mcp".

import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { marked } from "marked";
import { sha256Hex } from "./mcpKeys";

const SERVER_INFO = { name: "bproductive", version: "1.0.0" };
const DEFAULT_PROTOCOL = "2025-06-18";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
};

function mdToHtml(md?: string): string | undefined {
  if (!md) return undefined;
  try {
    return marked.parse(md, { async: false }) as string;
  } catch {
    return md;
  }
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
      "Get a board with its columns and cards (slug, title, priority, type, assignee). Use this to list tasks in a board.",
    inputSchema: {
      type: "object",
      properties: { boardId: { type: "string" } },
      required: ["boardId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_card",
    description: "Read a single card/task by slug (e.g. PROJ-12) within a board.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        slug: { type: "string" },
      },
      required: ["boardId", "slug"],
      additionalProperties: false,
    },
  },
  {
    name: "list_my_tasks",
    description: "List tasks assigned to the current user across all boards, with summary stats.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
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
        assigneeEmail: { type: "string", description: "Email of user to assign" },
        dueDate: { type: "number", description: "Due date as unix ms timestamp" },
        effort: { type: "number", description: "Effort in hours" },
      },
      required: ["boardId", "column", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "update_card",
    description:
      "Update a card by slug. Description is Markdown. Only provided fields change. Use update_card_status to move between columns.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        slug: { type: "string" },
        title: { type: "string" },
        description: { type: "string", description: "Markdown" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
        type: { type: "string", enum: ["task", "bug"] },
        assigneeEmail: { type: "string", description: "Email of user to assign (empty string to unassign)" },
        dueDate: { type: "number", description: "Due date as unix ms timestamp" },
        effort: { type: "number", description: "Effort in hours" },
      },
      required: ["boardId", "slug"],
      additionalProperties: false,
    },
  },
  {
    name: "update_card_status",
    description: "Move a card to a different column (change its status) by column name.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        slug: { type: "string" },
        column: { type: "string", description: "Target column name (exact)" },
      },
      required: ["boardId", "slug", "column"],
      additionalProperties: false,
    },
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
  {
    name: "list_comments",
    description: "List comments on a card identified by slug.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        slug: { type: "string" },
      },
      required: ["boardId", "slug"],
      additionalProperties: false,
    },
  },
  {
    name: "list_labels",
    description: "List the labels defined on a board.",
    inputSchema: {
      type: "object",
      properties: { boardId: { type: "string" } },
      required: ["boardId"],
      additionalProperties: false,
    },
  },
  {
    name: "add_label",
    description: "Attach a label (by name) to a card (by slug).",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        slug: { type: "string" },
        label: { type: "string", description: "Label name (exact)" },
      },
      required: ["boardId", "slug", "label"],
      additionalProperties: false,
    },
  },
  {
    name: "search_cards",
    description: "Search cards in a board by text in their title or description.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        query: { type: "string" },
      },
      required: ["boardId", "query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_html_docs",
    description:
      "List the HTML documentation files attached to a board (id, title, fileName, size).",
    inputSchema: {
      type: "object",
      properties: { boardId: { type: "string" } },
      required: ["boardId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_html_doc",
    description: "Read the raw HTML content of a board documentation file by its id.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        docId: { type: "string" },
      },
      required: ["boardId", "docId"],
      additionalProperties: false,
    },
  },
  {
    name: "upload_html_doc",
    description:
      "Upload an HTML documentation file to a board. Pass the full HTML as `html`. To overwrite an existing doc, pass its `docId`.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        title: { type: "string", description: "Human-readable title" },
        html: { type: "string", description: "Full HTML document content" },
        fileName: { type: "string", description: "Optional file name, e.g. guide.html" },
        docId: { type: "string", description: "Optional id of an existing doc to overwrite" },
      },
      required: ["boardId", "title", "html"],
      additionalProperties: false,
    },
  },
  {
    name: "get_me",
    description: "Get the currently authenticated user (id, name, email) for this MCP key.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "assign_card",
    description:
      "Assign a card (by slug) to a user by email. Pass an empty string for assigneeEmail to unassign.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        slug: { type: "string" },
        assigneeEmail: { type: "string", description: "Email of user to assign, or empty to unassign" },
      },
      required: ["boardId", "slug", "assigneeEmail"],
      additionalProperties: false,
    },
  },
  {
    name: "set_reporter",
    description:
      "Set the reporter (creator) of a card (by slug) to a user by email. Pass an empty string to clear.",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        slug: { type: "string" },
        reporterEmail: { type: "string", description: "Email of the reporter, or empty to clear" },
      },
      required: ["boardId", "slug", "reporterEmail"],
      additionalProperties: false,
    },
  },
  {
    name: "create_board",
    description: "Create a new kanban board. Returns the new boardId.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
];

type Ctx = Parameters<Parameters<typeof httpAction>[0]>[0];

async function resolveColumn(ctx: Ctx, boardId: string, email: string, columnName: string) {
  const board = await ctx.runQuery(api.boards.get, { boardId: boardId as any, userEmail: email });
  if (!board) throw new Error("Board not found");
  const col = (board.columns ?? []).find(
    (c: any) => c.name.toLowerCase() === String(columnName).toLowerCase(),
  );
  if (!col) {
    throw new Error(
      `Column "${columnName}" not found. Available: ${(board.columns ?? [])
        .map((c: any) => c.name)
        .join(", ")}`,
    );
  }
  return { board, column: col };
}

async function callTool(ctx: Ctx, email: string, name: string, args: any): Promise<unknown> {
  switch (name) {
    case "list_boards": {
      const boards = await ctx.runQuery(api.boards.list, { userEmail: email });
      return (boards ?? []).map((b: any) => ({
        boardId: b._id,
        name: b.name,
        slugPrefix: b.slugPrefix,
      }));
    }
    case "get_board": {
      const board = await ctx.runQuery(api.boards.get, { boardId: args.boardId, userEmail: email });
      if (!board) throw new Error("Board not found");
      return {
        boardId: board._id,
        name: board.name,
        columns: (board.columns ?? []).map((c: any) => ({
          name: c.name,
          cards: (c.cards ?? []).map((card: any) => ({
            slug: card.slug,
            title: card.title,
            priority: card.priority,
            type: card.type,
          })),
        })),
      };
    }
    case "get_card": {
      const card = await ctx.runQuery(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      return card;
    }
    case "list_my_tasks": {
      return await ctx.runQuery(api.cards.getMyTasks, {
        userEmail: email,
        limit: args.limit,
      });
    }
    case "create_card": {
      const { column } = await resolveColumn(ctx, args.boardId, email, args.column);
      const cardId = await ctx.runMutation(api.cards.create, {
        columnId: column._id,
        title: args.title,
        content: mdToHtml(args.description),
        priority: args.priority,
        type: args.type,
        dueDate: args.dueDate,
        effort: args.effort,
        assigneeId: await resolveAssignee(ctx, args.assigneeEmail),
        userEmail: email,
      });
      return { created: true, cardId };
    }
    case "update_card": {
      const card = await ctx.runQuery(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      await ctx.runMutation(api.cards.update, {
        cardId: card._id,
        title: args.title,
        content: args.description !== undefined ? mdToHtml(args.description) : undefined,
        priority: args.priority,
        type: args.type,
        dueDate: args.dueDate,
        effort: args.effort,
        assigneeId:
          args.assigneeEmail === undefined
            ? undefined
            : args.assigneeEmail === ""
              ? null
              : await resolveAssignee(ctx, args.assigneeEmail),
        currentUserEmail: email,
      });
      return { updated: true, slug: args.slug };
    }
    case "update_card_status": {
      const card = await ctx.runQuery(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      const { column } = await resolveColumn(ctx, args.boardId, email, args.column);
      const position = (column.cards ?? []).length; // append to end of target column
      await ctx.runMutation(api.cards.update, {
        cardId: card._id,
        columnId: column._id,
        position,
        currentUserEmail: email,
      });
      return { moved: true, slug: args.slug, column: column.name };
    }
    case "add_comment": {
      const card = await ctx.runQuery(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      await ctx.runMutation(api.comments.create, {
        cardId: card._id,
        content: args.comment,
        authorEmail: email,
      });
      return { commented: true, slug: args.slug };
    }
    case "list_comments": {
      const card = await ctx.runQuery(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      const comments = await ctx.runQuery(api.comments.list, { cardId: card._id });
      return (comments ?? []).map((c: any) => ({
        author: c.author?.name ?? c.author?.email ?? "unknown",
        content: c.content,
        createdAt: c.createdAt,
      }));
    }
    case "list_labels": {
      const labels = await ctx.runQuery(api.labels.list, {
        boardId: args.boardId,
        userEmail: email,
      });
      return (labels ?? []).map((l: any) => ({ name: l.name, color: l.color }));
    }
    case "add_label": {
      const card = await ctx.runQuery(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      const labels = await ctx.runQuery(api.labels.list, {
        boardId: args.boardId,
        userEmail: email,
      });
      const label = (labels ?? []).find(
        (l: any) => l.name.toLowerCase() === String(args.label).toLowerCase(),
      );
      if (!label) {
        throw new Error(
          `Label "${args.label}" not found. Available: ${(labels ?? [])
            .map((l: any) => l.name)
            .join(", ")}`,
        );
      }
      await ctx.runMutation(api.labels.addToCard, {
        cardId: card._id,
        labelId: label._id,
        userEmail: email,
      });
      return { labeled: true, slug: args.slug, label: label.name };
    }
    case "search_cards": {
      const board = await ctx.runQuery(api.boards.get, { boardId: args.boardId, userEmail: email });
      if (!board) throw new Error("Board not found");
      const q = String(args.query).toLowerCase();
      const matches: any[] = [];
      for (const col of board.columns ?? []) {
        for (const card of col.cards ?? []) {
          const hay = `${card.title ?? ""} ${card.content ?? ""}`.toLowerCase();
          if (hay.includes(q)) {
            matches.push({
              slug: card.slug,
              title: card.title,
              column: col.name,
              priority: card.priority,
            });
          }
        }
      }
      return matches;
    }
    case "list_html_docs": {
      const docs = await ctx.runQuery(api.htmlDocs.list, {
        boardId: args.boardId,
        userEmail: email,
      });
      return (docs ?? []).map((d: any) => ({
        docId: d._id,
        title: d.title,
        fileName: d.fileName,
        fileSize: d.fileSize,
        updatedAt: d.updatedAt,
      }));
    }
    case "get_html_doc": {
      const doc = await ctx.runAction(api.htmlDocs.getContent, {
        docId: args.docId,
        userEmail: email,
      });
      if (!doc) throw new Error(`HTML doc ${args.docId} not found`);
      return doc;
    }
    case "upload_html_doc": {
      const docId = await ctx.runAction(api.htmlDocs.createFromHtml, {
        boardId: args.boardId,
        title: args.title,
        html: args.html,
        fileName: args.fileName,
        docId: args.docId,
        userEmail: email,
      });
      return { uploaded: true, docId };
    }
    case "get_me": {
      const user = await ctx.runQuery(api.users.getByEmail, { email });
      if (!user) throw new Error(`No user with email ${email}`);
      return { id: user.id, name: user.name, email: user.email };
    }
    case "assign_card": {
      const card = await ctx.runQuery(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      await ctx.runMutation(api.cards.update, {
        cardId: card._id,
        assigneeId:
          args.assigneeEmail === "" ? null : await resolveAssignee(ctx, args.assigneeEmail),
        currentUserEmail: email,
      });
      return { assigned: true, slug: args.slug, assignee: args.assigneeEmail || null };
    }
    case "set_reporter": {
      const card = await ctx.runQuery(api.cards.getBySlug, {
        slug: args.slug,
        boardId: args.boardId,
      });
      if (!card) throw new Error(`Card ${args.slug} not found`);
      await ctx.runMutation(api.cards.update, {
        cardId: card._id,
        reporterId:
          args.reporterEmail === "" ? null : await resolveAssignee(ctx, args.reporterEmail),
        currentUserEmail: email,
      });
      return { reporterSet: true, slug: args.slug, reporter: args.reporterEmail || null };
    }
    case "create_board": {
      const boardId = await ctx.runMutation(api.boards.create, {
        name: args.name,
        description: args.description,
        userEmail: email,
      });
      return { created: true, boardId };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function resolveAssignee(ctx: Ctx, email?: string) {
  if (!email) return undefined;
  const user = await ctx.runQuery(api.users.getByEmail, { email });
  if (!user?.id) throw new Error(`No user with email ${email}`);
  return user.id;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export const mcpHandler = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Browser GET / health check — MCP clients use POST.
  if (request.method === "GET") {
    return jsonResponse({
      ok: true,
      server: SERVER_INFO,
      transport: "mcp-streamable-http",
      hint: "POST JSON-RPC here with an Authorization: Bearer <key> header.",
    });
  }

  // Authenticate via Bearer API key.
  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return jsonResponse({ error: "Missing Bearer token" }, 401);
  }
  const keyHash = await sha256Hex(token);
  const owner = await ctx.runQuery(internal.mcpKeys.internalValidate, { keyHash });
  if (!owner) {
    return jsonResponse({ error: "Invalid API key" }, 401);
  }
  const email = owner.email;
  await ctx.scheduler.runAfter(0, internal.mcpKeys.internalTouch, { keyId: owner.keyId });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(rpcError(null, -32700, "Parse error"), 400);
  }

  // We handle a single JSON-RPC request per call (Claude Code sends one).
  const { id, method, params } = body ?? {};

  // Notifications (no id) — just ack with 202.
  if (method === "notifications/initialized" || (method && method.startsWith("notifications/"))) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  switch (method) {
    case "initialize":
      return jsonResponse(
        rpcResult(id, {
          protocolVersion: params?.protocolVersion || DEFAULT_PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        }),
      );
    case "ping":
      return jsonResponse(rpcResult(id, {}));
    case "tools/list":
      return jsonResponse(rpcResult(id, { tools: TOOLS }));
    case "tools/call": {
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      try {
        const result = await callTool(ctx, email, toolName, toolArgs);
        return jsonResponse(
          rpcResult(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          }),
        );
      } catch (e: any) {
        return jsonResponse(
          rpcResult(id, {
            isError: true,
            content: [{ type: "text", text: `Error: ${e?.message ?? String(e)}` }],
          }),
        );
      }
    }
    default:
      return jsonResponse(rpcError(id, -32601, `Method not found: ${method}`));
  }
});
