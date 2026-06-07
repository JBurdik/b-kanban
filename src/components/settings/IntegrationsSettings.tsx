// Settings card: install the B Productive MCP server + the /bnotion skill into
// Claude Desktop and Codex. Desktop only — renders nothing on web.

import { useCallback, useEffect, useState } from "react";
import {
  mcpInstall,
  mcpStatus,
  mcpUninstall,
  skillInstall,
  skillUninstall,
  type McpStatus,
} from "@/lib/mcp";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;

export function IntegrationsSettings({ email }: { email?: string }) {
  const [status, setStatus] = useState<McpStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = await mcpStatus();
    setStatus(s);
    setChecked(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Not in the desktop app → hide the whole section.
  if (!checked) return null;
  if (!status) return null;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const canInstall = !!status.node_path && !!email;

  return (
    <div className="card">
      <h2 className="font-semibold mb-1">Assistant integrations</h2>
      <p className="text-sm text-dark-muted mb-4">
        Wire your board into external AI assistants. They get tools to read and
        edit cards, and can see the task you currently have open.
      </p>

      {!status.node_path && (
        <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 mb-4">
          Node.js not found. Install Node (e.g. <code>brew install node</code>),
          then reopen this page.
        </p>
      )}
      {!email && (
        <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 mb-4">
          Sign in to enable installation.
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* MCP server */}
      <Section title="MCP server" subtitle="kanban tools (create/edit cards, comments)">
        <Row
          name="Claude Desktop"
          installed={status.claude_installed}
          busy={busy === "mcp:claude"}
          disabled={!canInstall}
          onInstall={() =>
            run("mcp:claude", () => mcpInstall("claude", CONVEX_URL, email!))
          }
          onRemove={() => run("mcp:claude", () => mcpUninstall("claude"))}
        />
        <Row
          name="Codex"
          installed={status.codex_installed}
          busy={busy === "mcp:codex"}
          disabled={!canInstall}
          onInstall={() =>
            run("mcp:codex", () => mcpInstall("codex", CONVEX_URL, email!))
          }
          onRemove={() => run("mcp:codex", () => mcpUninstall("codex"))}
        />
      </Section>

      {/* Skill */}
      <Section
        title="/bnotion skill"
        subtitle="a slash command that drives the board via the MCP tools"
      >
        <Row
          name="Claude Code"
          installed={status.claude_skill}
          busy={busy === "skill:claude"}
          disabled={false}
          onInstall={() => run("skill:claude", () => skillInstall("claude"))}
          onRemove={() => run("skill:claude", () => skillUninstall("claude"))}
        />
        <Row
          name="Codex"
          installed={status.codex_skill}
          busy={busy === "skill:codex"}
          disabled={false}
          onInstall={() => run("skill:codex", () => skillInstall("codex"))}
          onRemove={() => run("skill:codex", () => skillUninstall("codex"))}
        />
      </Section>

      <p className="text-[11px] text-dark-muted mt-3">
        Restart Claude/Codex after installing so it picks up the changes.
      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2">
        <p className="text-sm font-medium text-dark-text">{title}</p>
        <p className="text-xs text-dark-muted">{subtitle}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  name,
  installed,
  busy,
  disabled,
  onInstall,
  onRemove,
}: {
  name: string;
  installed: boolean;
  busy: boolean;
  disabled: boolean;
  onInstall: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between bg-dark-bg border border-dark-border rounded-lg px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="text-sm text-dark-text">{name}</span>
        {installed && (
          <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/30 rounded px-1.5 py-0.5">
            installed
          </span>
        )}
      </div>
      {installed ? (
        <button
          onClick={onRemove}
          disabled={busy}
          className="text-xs px-3 py-1.5 border border-dark-border text-dark-muted rounded-lg hover:text-dark-text hover:bg-dark-hover transition-colors disabled:opacity-40"
        >
          {busy ? "…" : "Remove"}
        </button>
      ) : (
        <button
          onClick={onInstall}
          disabled={busy || disabled}
          className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {busy ? "Installing…" : "Install"}
        </button>
      )}
    </div>
  );
}
