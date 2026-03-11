import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

interface Props {
  boardId: Id<"boards">;
}

export function InviteLinkManager({ boardId }: Props) {
  const invites = useQuery(api.invites.list, { boardId });
  const createInvite = useMutation(api.invites.create);
  const revokeInvite = useMutation(api.invites.revoke);

  const [role, setRole] = useState<"admin" | "member">("member");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createInvite({ boardId, role });
    } catch (err) {
      console.error("Failed to create invite:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (inviteId: Id<"boardInvites">) => {
    try {
      await revokeInvite({ inviteId });
    } catch (err) {
      console.error("Failed to revoke invite:", err);
    }
  };

  const handleCopy = async (token: string, id: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-dark-text">Invite Links</h3>
        <div className="flex items-center gap-2">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "member")}
            className="input text-xs py-1 px-2"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="text-xs px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {creating ? (
              <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
            Create Link
          </button>
        </div>
      </div>

      {invites === undefined ? (
        <div className="text-xs text-dark-muted py-2">Loading...</div>
      ) : invites.length === 0 ? (
        <div className="text-xs text-dark-muted py-2">No active invite links</div>
      ) : (
        <div className="space-y-2">
          {invites.map((invite: any) => (
            <div
              key={invite._id}
              className="flex items-center justify-between p-2.5 bg-dark-bg rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    invite.role === "admin"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-blue-500/20 text-blue-400"
                  }`}
                >
                  {invite.role}
                </span>
                <span className="text-xs text-dark-muted">
                  {formatDate(invite.createdAt)}
                </span>
                {invite.maxUses && (
                  <span className="text-xs text-dark-muted">
                    {invite.useCount}/{invite.maxUses} uses
                  </span>
                )}
                {!invite.maxUses && invite.useCount > 0 && (
                  <span className="text-xs text-dark-muted">
                    {invite.useCount} {invite.useCount === 1 ? "use" : "uses"}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCopy(invite.token, invite._id)}
                  className="text-xs px-2 py-1 text-dark-muted hover:text-dark-text hover:bg-dark-hover rounded transition-colors"
                  title="Copy invite link"
                >
                  {copiedId === invite._id ? (
                    <span className="text-green-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleRevoke(invite._id)}
                  className="text-xs px-2 py-1 text-dark-muted hover:text-red-400 hover:bg-dark-hover rounded transition-colors"
                  title="Revoke invite"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
