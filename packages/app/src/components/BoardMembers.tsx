import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useSession } from "@/lib/auth-client";
import { Avatar } from "./Avatar";

type BoardRole = "owner" | "admin" | "member";

interface Member {
  id: Id<"boardMembers">;
  role: BoardRole;
  userId: Id<"users">;
  userName: string;
  userEmail: string;
}

interface Props {
  boardId: Id<"boards">;
  members: Member[];
  userRole?: BoardRole;
  onClose: () => void;
}

const roleLabels: Record<BoardRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function BoardMembers({ boardId, members, userRole, onClose }: Props) {
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";
  const canManageMembers = isOwner || isAdmin;

  // Convex mutations
  const addMember = useMutation(api.members.add);
  const updateRole = useMutation(api.members.updateRole);
  const removeMember = useMutation(api.members.remove);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsAdding(true);
    setError("");

    try {
      await addMember({
        boardId,
        email: email.trim(),
        role,
      });
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateRole = async (
    memberId: Id<"boardMembers">,
    newRole: "admin" | "member"
  ) => {
    try {
      await updateRole({ memberId, role: newRole });
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  const handleRemove = async (memberId: Id<"boardMembers">, memberName: string) => {
    if (confirm(`Remove ${memberName} from this board?`)) {
      try {
        await removeMember({ memberId });
      } catch (err) {
        console.error("Failed to remove member:", err);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-dark-surface border border-dark-border rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold">Board Members</h2>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-dark-text p-1"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Member List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-dark-bg rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={member.userName}
                    id={member.userId}
                    size="md"
                  />
                  <div>
                    <p className="text-sm font-medium">{member.userName}</p>
                    <p className="text-xs text-dark-muted">{member.userEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === "owner" ? (
                    <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded">
                      {roleLabels[member.role]}
                    </span>
                  ) : canManageMembers &&
                    !(isAdmin && member.role === "admin") ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleUpdateRole(
                            member.id,
                            e.target.value as "admin" | "member"
                          )
                        }
                        className="input text-xs py-1 px-2"
                        disabled={!isOwner && member.role === "admin"}
                      >
                        {isOwner && <option value="admin">Admin</option>}
                        <option value="member">Member</option>
                      </select>
                      {member.userId !== session?.user.id && (
                        <button
                          onClick={() => handleRemove(member.id, member.userName)}
                          className="text-dark-muted hover:text-red-400 p-1"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-dark-muted">
                      {roleLabels[member.role]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Invite Form (admin or owner) */}
        {canManageMembers && (
          <div className="p-4 border-t border-dark-border">
            <h3 className="text-sm font-medium mb-3">Invite Member</h3>
            <form onSubmit={handleInvite} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="input w-full"
                required
              />
              <div className="flex gap-2">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "member")}
                  className="input flex-1"
                >
                  {isOwner && <option value="admin">Admin</option>}
                  <option value="member">Member</option>
                </select>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="btn-primary px-6"
                >
                  {isAdding ? "Inviting..." : "Invite"}
                </button>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
