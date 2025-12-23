import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useSession } from "@/lib/auth-client";
import { Avatar } from "./Avatar";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ROLE_LABELS } from "@/lib/constants";
import { isOwner as checkIsOwner, canManageMembers as checkCanManage } from "@/lib/permissions";
import type { BoardRole } from "@/lib/types";

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

export function BoardMembers({ boardId, members, userRole, onClose }: Props) {
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const isOwner = checkIsOwner(userRole);
  const canManageMembers = checkCanManage(userRole);

  const addMember = useMutation(api.members.add);
  const updateRole = useMutation(api.members.updateRole);
  const removeMember = useMutation(api.members.remove);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsAdding(true);
    setError("");

    try {
      await addMember({ boardId, email: email.trim(), role });
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateRole = async (memberId: Id<"boardMembers">, newRole: "admin" | "member") => {
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
    <Modal open={true} onClose={onClose} title="Board Members" size="md">
      {/* Member List */}
      <div className="space-y-3 max-h-[40vh] overflow-y-auto">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 bg-dark-bg rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Avatar name={member.userName} id={member.userId} size="md" />
              <div>
                <p className="text-sm font-medium">{member.userName}</p>
                <p className="text-xs text-dark-muted">{member.userEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {member.role === "owner" ? (
                <span className="text-xs px-2 py-1 bg-accent/20 text-accent rounded">
                  {ROLE_LABELS[member.role]}
                </span>
              ) : canManageMembers && !(userRole === "admin" && member.role === "admin") ? (
                <>
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateRole(member.id, e.target.value as "admin" | "member")}
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-dark-muted">{ROLE_LABELS[member.role]}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invite Form */}
      {canManageMembers && (
        <div className="mt-4 pt-4 border-t border-dark-border">
          <h3 className="text-sm font-medium mb-3">Invite Member</h3>
          <form onSubmit={handleInvite} className="space-y-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              error={error}
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
              <Button type="submit" loading={isAdding}>
                Invite
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
