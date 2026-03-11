import { Avatar } from "@/components/Avatar";
import type { Id } from "convex/_generated/dataModel";
import { useState } from "react";

interface OnlineUser {
  userId: Id<"users">;
  userName: string;
  userImage?: string;
  activeCardSlug?: string;
}

interface Props {
  onlineUsers: OnlineUser[];
  currentUserId?: Id<"users">;
}

const MAX_VISIBLE = 5;

export function PresenceBar({ onlineUsers, currentUserId }: Props) {
  const others = currentUserId
    ? onlineUsers.filter((u) => u.userId !== currentUserId)
    : onlineUsers;

  if (others.length === 0) return null;

  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1">
      {visible.map((user) => (
        <PresenceAvatar key={user.userId} user={user} />
      ))}
      {overflow > 0 && (
        <span className="text-xs text-dark-muted ml-1">+{overflow}</span>
      )}
    </div>
  );
}

function PresenceAvatar({ user }: { user: OnlineUser }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipText = user.activeCardSlug
    ? `${user.userName} \u2022 viewing ${user.activeCardSlug}`
    : user.userName;

  return (
    <div
      className="relative ring-2 ring-green-500 rounded-full"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Avatar
        name={user.userName}
        id={user.userId}
        imageUrl={user.userImage}
        size="xs"
      />
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs text-white bg-dark-surface border border-dark-border rounded shadow-lg whitespace-nowrap z-50">
          {tooltipText}
        </div>
      )}
    </div>
  );
}
