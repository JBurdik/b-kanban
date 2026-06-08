// Settings card: manage per-user API keys for the remote MCP server, and show
// the one-line command to connect Claude Code over HTTP. Visible on web + desktop.

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";

// HTTP router routes (incl. /mcp) are served by the Convex site origin, which
// the self-hosted deploy proxies under the /http path of the API domain.
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;
const MCP_URL = `${CONVEX_URL?.replace(/\/$/, "")}/http/mcp`;

function installCommand(key: string) {
  return `claude mcp add --transport http bproductive ${MCP_URL} --header "Authorization: Bearer ${key}"`;
}

export function McpKeysSettings({ email }: { email?: string }) {
  const keys = useQuery(api.mcpKeys.list, email ? { userEmail: email } : "skip");
  const generate = useMutation(api.mcpKeys.generate);
  const revoke = useMutation(api.mcpKeys.revoke);

  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await generate({ name: name.trim() || "key", userEmail: email });
      setNewKey(res.key);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => void navigator.clipboard?.writeText(text);

  return (
    <div className="card">
      <h2 className="font-semibold mb-1">Remote MCP (Claude Code)</h2>
      <p className="text-sm text-dark-muted mb-4">
        Connect Claude Code to your board over HTTP. Create a key, then run the
        command below in any terminal. The key authenticates as you — keep it
        secret. Tools: read/list/create/update tasks, change status, comments,
        labels, search.
      </p>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Freshly created key — shown once */}
      {newKey && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-3">
          <p className="text-xs font-medium text-dark-text mb-1">
            New key — copy it now, it won't be shown again:
          </p>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 text-xs bg-dark-bg border border-dark-border rounded px-2 py-1.5 break-all">
              {newKey}
            </code>
            <button
              onClick={() => copy(newKey)}
              className="text-xs px-3 py-1.5 border border-dark-border text-dark-muted rounded-lg hover:text-dark-text hover:bg-dark-hover transition-colors"
            >
              Copy
            </button>
          </div>
          <p className="text-xs font-medium text-dark-text mb-1">
            Install command:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] bg-dark-bg border border-dark-border rounded px-2 py-1.5 break-all">
              {installCommand(newKey)}
            </code>
            <button
              onClick={() => copy(installCommand(newKey))}
              className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setNewKey(null)}
            className="text-[11px] text-dark-muted mt-2 hover:text-dark-text"
          >
            Done
          </button>
        </div>
      )}

      {/* Create */}
      <div className="flex items-center gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. laptop)"
          className="flex-1 text-sm bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-dark-text placeholder:text-dark-muted"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={busy}
          className="text-sm px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create key"}
        </button>
      </div>

      {/* Existing keys */}
      <div className="space-y-2">
        {keys === undefined && (
          <p className="text-xs text-dark-muted">Loading…</p>
        )}
        {keys && keys.length === 0 && (
          <p className="text-xs text-dark-muted">No keys yet.</p>
        )}
        {keys?.map((k) => (
          <div
            key={k._id}
            className="flex items-center justify-between bg-dark-bg border border-dark-border rounded-lg px-3 py-2"
          >
            <div className="min-w-0">
              <span className="text-sm text-dark-text">{k.name}</span>
              <span className="text-xs text-dark-muted ml-2">{k.prefix}…</span>
              <span className="text-[11px] text-dark-muted block">
                {k.lastUsedAt
                  ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                  : "never used"}
              </span>
            </div>
            <button
              onClick={() => email && void revoke({ keyId: k._id, userEmail: email })}
              className="text-xs px-3 py-1.5 border border-dark-border text-dark-muted rounded-lg hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-dark-muted mt-3">
        Endpoint: <code>{MCP_URL}</code> · After adding, run <code>/mcp</code> in
        Claude Code to confirm the tools loaded.
      </p>
    </div>
  );
}
