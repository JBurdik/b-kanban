// Codex chat assistant slide-out panel (desktop only).

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { marked } from "marked";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useAssistant } from "@/contexts/AssistantContext";
import { useSessionToken } from "@/hooks/useSessionToken";
import {
  codexProbe,
  codexLogin,
  codexSend,
  type CodexStatus,
} from "@/lib/codex";
import { buildPrompt } from "@/lib/codexPrompt";
import {
  extractProposal,
  type CardProposal,
} from "@/lib/codexProposal";

type Msg = {
  id: number;
  role: "user" | "assistant" | "error";
  text: string;
  proposal?: CardProposal | null;
  applied?: string; // confirmation note once applied
  streaming?: boolean;
};

function md(text: string): string {
  try {
    return marked.parse(text, { async: false }) as string;
  } catch {
    return text;
  }
}

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { board, userEmail, activeCard } = useAssistant();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<CodexStatus | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [loginLog, setLoginLog] = useState<string[]>([]);
  const [loggingIn, setLoggingIn] = useState(false);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessionToken = useSessionToken();
  const createCard = useMutation(api.cards.create);
  const updateCard = useMutation(api.cards.update);

  const refreshStatus = useCallback(async () => {
    const probed = await codexProbe();
    setAvailable(probed !== null);
    if (probed !== null) setStatus(probed);
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const validColumns = new Set((board?.columns ?? []).map((c) => c.name));
  const validSlugs = new Set(
    (board?.columns ?? []).flatMap((c) => c.cards.map((card) => card.slug)),
  );
  if (activeCard) validSlugs.add(activeCard.slug);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: Msg = { id: nextId.current++, role: "user", text };
    const assistantId = nextId.current++;
    setMessages((m) => [
      ...m,
      userMsg,
      { id: assistantId, role: "assistant", text: "", streaming: true },
    ]);
    setStreaming(true);

    const prompt = buildPrompt({
      board: board
        ? {
            name: board.name,
            columns: board.columns.map((c) => ({
              name: c.name,
              cards: c.cards.map((card) => ({
                slug: card.slug,
                title: card.title,
              })),
            })),
          }
        : null,
      activeCard,
      userMessage: text,
    });

    try {
      const result = await codexSend(prompt, sessionId, (e) => {
        if (e.kind === "started") {
          setSessionId(e.session_id);
        } else if (e.kind === "message") {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, text: msg.text ? msg.text + "\n\n" + e.text : e.text }
                : msg,
            ),
          );
        } else if (e.kind === "error") {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, role: "error", text: e.message, streaming: false }
                : msg,
            ),
          );
        }
      });

      if (result.session_id) setSessionId(result.session_id);
      const { proposal, chat } = extractProposal(
        result.final_text,
        validColumns,
        validSlugs,
      );
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                text: chat || result.final_text,
                proposal,
                streaming: false,
              }
            : msg,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("codex_not_authed")) {
        await refreshStatus();
      }
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, role: "error", text: message, streaming: false }
            : msg,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }, [
    input,
    streaming,
    board,
    sessionId,
    validColumns,
    validSlugs,
    activeCard,
    refreshStatus,
  ]);

  const applyProposal = useCallback(
    async (msgId: number, proposal: CardProposal) => {
      if (!board) return;
      const notes: string[] = [];
      try {
        if (proposal.create_cards) {
          for (const c of proposal.create_cards) {
            const column = board.columns.find(
              (col) => col.name.toLowerCase() === c.columnName.toLowerCase(),
            );
            if (!column) continue;
            await createCard({
              columnId: column._id as Id<"columns">,
              title: c.title,
              content: c.description ? md(c.description) : undefined,
              priority: c.priority,
              type: c.type,
              sessionToken,
            });
            notes.push(`Created "${c.title}" in ${column.name}`);
          }
        }
        if (proposal.update_card) {
          const upd = proposal.update_card;
          let cardId: string | undefined;
          for (const col of board.columns) {
            const found = col.cards.find((card) => card.slug === upd.slug);
            if (found) {
              cardId = found._id;
              break;
            }
          }
          if (cardId) {
            await updateCard({
              cardId: cardId as Id<"cards">,
              title: upd.title,
              content: upd.description ? md(upd.description) : undefined,
              sessionToken,
            });
            notes.push(`Updated ${upd.slug}`);
          }
        }
        setMessages((m) =>
          m.map((msg) =>
            msg.id === msgId
              ? {
                  ...msg,
                  proposal: null,
                  applied: notes.join(" · ") || "Applied",
                }
              : msg,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMessages((m) => [
          ...m,
          { id: nextId.current++, role: "error", text: message },
        ]);
      }
    },
    [board, createCard, updateCard, userEmail],
  );

  const rejectProposal = useCallback((msgId: number) => {
    setMessages((m) =>
      m.map((msg) => (msg.id === msgId ? { ...msg, proposal: null } : msg)),
    );
  }, []);

  const handleLogin = useCallback(async () => {
    setLoggingIn(true);
    setLoginLog([]);
    try {
      await codexLogin((line) => setLoginLog((l) => [...l, line]));
      await refreshStatus();
    } catch {
      setLoginLog((l) => [
        ...l,
        "Login failed. Try running `codex login` in a terminal, then Re-check.",
      ]);
    } finally {
      setLoggingIn(false);
    }
  }, [refreshStatus]);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
        onClick={onClose}
      />
      <div className="fixed bg-dark-surface shadow-2xl z-50 flex flex-col pb-safe sm:pb-0 inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[440px] sm:border-l border-dark-border animate-slide-up sm:animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-dark-border flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-dark-text">Assistant</h2>
            {board && (
              <p className="text-xs text-dark-muted truncate">{board.name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded-lg transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Gate on availability + status */}
        {available === null ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : !available ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-dark-text">Desktop app only</p>
            <p className="text-xs text-dark-muted">
              The assistant runs the Codex CLI locally, so it's available in the
              desktop app (run <code>pnpm dev:desktop</code>), not the browser.
            </p>
          </div>
        ) : status === null ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : !status.installed ? (
          <Onboarding
            title="Codex CLI not found"
            body="Install the OpenAI Codex CLI, then re-check. If it's installed in a non-standard location, set the CODEX_BIN env var to its full path."
            cmd="npm i -g @openai/codex"
            altCmd="brew install codex"
            onRecheck={refreshStatus}
          />
        ) : !status.authed ? (
          <ConnectState
            loggingIn={loggingIn}
            loginLog={loginLog}
            onConnect={handleLogin}
            onRecheck={refreshStatus}
          />
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-dark-muted text-center mt-8">
                  Ask me to reword a task, draft a description, or create cards.
                </p>
              )}
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  canApply={!!board}
                  onApply={applyProposal}
                  onReject={rejectProposal}
                />
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-dark-border p-3 flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={streaming ? "Thinking…" : "Message the assistant…"}
                  disabled={streaming}
                  className="flex-1 resize-none bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-accent max-h-32"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={streaming || !input.trim()}
                  className="px-3 py-2 bg-accent text-white text-sm rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function MessageBubble({
  msg,
  canApply,
  onApply,
  onReject,
}: {
  msg: Msg;
  canApply: boolean;
  onApply: (id: number, p: CardProposal) => void;
  onReject: (id: number) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-accent text-white rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.role === "error") {
    return (
      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
        {msg.text}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {(msg.text || msg.streaming) && (
        <div className="max-w-[90%] bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-sm text-dark-text prose-assistant">
          {msg.streaming && !msg.text ? (
            <span className="text-dark-muted">Thinking…</span>
          ) : (
            <div
              className="prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: md(msg.text) }}
            />
          )}
        </div>
      )}
      {msg.applied && (
        <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
          ✓ {msg.applied}
        </div>
      )}
      {msg.proposal && (
        <ProposalPreview
          proposal={msg.proposal}
          canApply={canApply}
          onApply={() => onApply(msg.id, msg.proposal!)}
          onReject={() => onReject(msg.id)}
        />
      )}
    </div>
  );
}

function ProposalPreview({
  proposal,
  canApply,
  onApply,
  onReject,
}: {
  proposal: CardProposal;
  canApply: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  return (
    <div className="border border-accent/40 bg-accent/5 rounded-lg p-3 space-y-2">
      <p className="text-xs font-medium text-dark-muted uppercase tracking-wide">
        Proposed changes
      </p>
      {proposal.create_cards?.map((c, i) => (
        <div key={i} className="text-sm">
          <span className="text-xs text-dark-muted">+ {c.columnName}</span>
          <p className="font-medium text-dark-text">{c.title}</p>
          {c.description && (
            <p className="text-xs text-dark-muted line-clamp-3 whitespace-pre-wrap">
              {c.description}
            </p>
          )}
          <span className="text-xs text-dark-muted">
            {[c.priority, c.type].filter(Boolean).join(" · ")}
          </span>
        </div>
      ))}
      {proposal.update_card && (
        <div className="text-sm">
          <span className="text-xs text-dark-muted">~ {proposal.update_card.slug}</span>
          {proposal.update_card.title && (
            <p className="font-medium text-dark-text">{proposal.update_card.title}</p>
          )}
          {proposal.update_card.description && (
            <p className="text-xs text-dark-muted line-clamp-3 whitespace-pre-wrap">
              {proposal.update_card.description}
            </p>
          )}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onApply}
          disabled={!canApply}
          className="flex-1 px-3 py-1.5 bg-accent text-white text-sm rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
          title={canApply ? undefined : "Open a board to apply changes"}
        >
          Confirm
        </button>
        <button
          onClick={onReject}
          className="px-3 py-1.5 border border-dark-border text-dark-muted text-sm rounded-lg hover:text-dark-text hover:bg-dark-hover transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function Onboarding({
  title,
  body,
  cmd,
  altCmd,
  onRecheck,
}: {
  title: string;
  body: string;
  cmd: string;
  altCmd?: string;
  onRecheck: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium text-dark-text">{title}</p>
      <p className="text-xs text-dark-muted">{body}</p>
      <code className="text-xs bg-dark-bg border border-dark-border rounded px-2 py-1 text-dark-text">
        {cmd}
      </code>
      {altCmd && (
        <code className="text-xs bg-dark-bg border border-dark-border rounded px-2 py-1 text-dark-text">
          {altCmd}
        </code>
      )}
      <button
        onClick={onRecheck}
        className="mt-2 px-3 py-1.5 bg-accent text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
      >
        Re-check
      </button>
    </div>
  );
}

function ConnectState({
  loggingIn,
  loginLog,
  onConnect,
  onRecheck,
}: {
  loggingIn: boolean;
  loginLog: string[];
  onConnect: () => void;
  onRecheck: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-medium text-dark-text">Connect your ChatGPT account</p>
      <p className="text-xs text-dark-muted">
        Codex uses your ChatGPT subscription. Click Connect to sign in via your
        browser. If it doesn't open, run <code>codex login</code> in a terminal,
        then Re-check.
      </p>
      <div className="flex gap-2">
        <button
          onClick={onConnect}
          disabled={loggingIn}
          className="px-3 py-1.5 bg-accent text-white text-sm rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {loggingIn ? "Connecting…" : "Connect"}
        </button>
        <button
          onClick={onRecheck}
          className="px-3 py-1.5 border border-dark-border text-dark-muted text-sm rounded-lg hover:text-dark-text hover:bg-dark-hover transition-colors"
        >
          Re-check
        </button>
      </div>
      {loginLog.length > 0 && (
        <pre className="text-[10px] text-left text-dark-muted bg-dark-bg border border-dark-border rounded p-2 max-h-40 overflow-y-auto w-full whitespace-pre-wrap">
          {loginLog.join("\n")}
        </pre>
      )}
    </div>
  );
}
