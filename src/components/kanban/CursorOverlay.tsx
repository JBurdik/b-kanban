import { Avatar } from "@/components/Avatar";
import type { Id } from "convex/_generated/dataModel";
import type { CursorPosition } from "@/hooks/useBoardCursors";

interface UserInfo {
  userId: Id<"users">;
  userName: string;
  userImage?: string;
}

interface Props {
  cursors: CursorPosition[];
  userLookup: Map<string, UserInfo>;
  currentUserId?: Id<"users">;
  scrollLeft: number;
  scrollTop: number;
}

export function CursorOverlay({
  cursors,
  userLookup,
  currentUserId,
  scrollLeft,
  scrollTop,
}: Props) {
  const others = cursors.filter((c) => c.userId !== currentUserId);
  if (others.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {others.map((cursor) => {
        const info = userLookup.get(cursor.userId);
        if (!info) return null;

        const left = cursor.x - scrollLeft;
        const top = cursor.y - scrollTop;

        // Don't render if cursor is off-screen
        if (left < -20 || top < -20) return null;

        return (
          <div
            key={cursor.userId}
            className="absolute flex items-end gap-1"
            style={{
              left,
              top,
              transform: "translate(0, 0)",
              transition: "left 80ms linear, top 80ms linear",
            }}
          >
            {/* Cursor pointer glyph */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              className="flex-shrink-0 drop-shadow"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
            >
              <path
                d="M0 0 L0 12 L3.5 8.5 L6.5 14 L8 13.5 L5 7.5 L9.5 7.5 Z"
                fill="white"
                stroke="#22c55e"
                strokeWidth="1"
              />
            </svg>

            {/* Avatar label */}
            <div className="flex items-center gap-1 bg-dark-surface border border-green-500 rounded-full px-1 py-0.5 shadow-md">
              <div className="ring-1 ring-green-500 rounded-full flex-shrink-0">
                <Avatar
                  name={info.userName}
                  id={info.userId}
                  imageUrl={info.userImage}
                  size="xs"
                />
              </div>
              <span className="text-[10px] text-white whitespace-nowrap pr-0.5 max-w-[80px] truncate">
                {info.userName.split(" ")[0]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
