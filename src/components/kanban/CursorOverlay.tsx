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
  // Column scroll containers, keyed by columnId — cursor x/y are relative to
  // these, not to the board's own scroll offset.
  columnEls: Map<string, HTMLDivElement>;
  // Element the overlay itself is positioned against (used to convert
  // viewport coords into the overlay's local coordinate space).
  originEl: HTMLDivElement | null;
  containerWidth?: number;
  containerHeight?: number;
  onScrollTo?: (columnId: string, x: number, y: number) => void;
}

const EDGE_PAD = 52;

function getEdgePosition(
  vx: number,
  vy: number,
  w: number,
  h: number,
) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = vx - cx;
  const dy = vy - cy;
  if (dx === 0 && dy === 0) return { ex: cx, ey: cy, angle: 0 };
  const sx = dx !== 0 ? (w / 2 - EDGE_PAD) / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? (h / 2 - EDGE_PAD) / Math.abs(dy) : Infinity;
  const scale = Math.min(sx, sy);
  return {
    ex: Math.max(EDGE_PAD, Math.min(w - EDGE_PAD, cx + dx * scale)),
    ey: Math.max(EDGE_PAD, Math.min(h - EDGE_PAD, cy + dy * scale)),
    angle: Math.atan2(dy, dx) * 180 / Math.PI,
  };
}

const CURSOR_SVG = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    className="flex-shrink-0"
    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
  >
    <path
      d="M0 0 L0 12 L3.5 8.5 L6.5 14 L8 13.5 L5 7.5 L9.5 7.5 Z"
      fill="white"
      stroke="#22c55e"
      strokeWidth="1"
    />
  </svg>
);

function AvatarPill({ info }: { info: UserInfo }) {
  return (
    <div className="flex items-center gap-1 bg-dark-surface border border-green-500 rounded-full px-1 py-0.5 shadow-md">
      <div className="ring-1 ring-green-500 rounded-full flex-shrink-0">
        <Avatar name={info.userName} id={info.userId} imageUrl={info.userImage} size="xs" />
      </div>
      <span className="text-[10px] text-white whitespace-nowrap pr-0.5 max-w-[80px] truncate">
        {info.userName.split(" ")[0]}
      </span>
    </div>
  );
}

export function CursorOverlay({
  cursors,
  userLookup,
  currentUserId,
  columnEls,
  originEl,
  containerWidth = 99999,
  containerHeight = 99999,
  onScrollTo,
}: Props) {
  const others = cursors.filter(
    (c) => c.userId !== currentUserId && userLookup.has(c.userId) && c.columnId,
  );
  if (others.length === 0 || !originEl) return null;

  const originRect = originEl.getBoundingClientRect();

  // Resolve each cursor's column-relative x/y to a position in the overlay's
  // own coordinate space, using that column's *current* rect + scrollTop —
  // this is what makes the cursor track the pointed-at card even when the
  // sender's and viewer's columns are scrolled independently.
  const resolved: { cursor: CursorPosition; vx: number; vy: number }[] = [];
  for (const c of others) {
    const colEl = columnEls.get(c.columnId!);
    if (!colEl) continue;
    const colRect = colEl.getBoundingClientRect();
    const vx = colRect.left - originRect.left + c.x;
    const vy = colRect.top - originRect.top - colEl.scrollTop + c.y;
    resolved.push({ cursor: c, vx, vy });
  }

  const visible = resolved.filter(
    (r) => !(r.vx < -20 || r.vx > containerWidth + 20 || r.vy < -20 || r.vy > containerHeight + 20),
  );
  const offScreen = resolved.filter(
    (r) => r.vx < -20 || r.vx > containerWidth + 20 || r.vy < -20 || r.vy > containerHeight + 20,
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {visible.map(({ cursor, vx, vy }) => {
        const info = userLookup.get(cursor.userId)!;
        return (
          <div
            key={cursor.userId}
            className="absolute flex items-end gap-1 pointer-events-auto cursor-pointer"
            style={{
              left: vx,
              top: vy,
              transition: "left 80ms linear, top 80ms linear",
            }}
            onClick={() => onScrollTo?.(cursor.columnId!, cursor.x, cursor.y)}
            title={`${info.userName} — click to follow`}
          >
            {CURSOR_SVG}
            <AvatarPill info={info} />
          </div>
        );
      })}

      {/* Viewport-space edge indicators for off-screen cursors */}
      {containerWidth > 0 &&
        offScreen.map(({ cursor, vx, vy }) => {
          const info = userLookup.get(cursor.userId)!;
          const { ex, ey, angle } = getEdgePosition(
            vx,
            vy,
            containerWidth,
            containerHeight,
          );
          return (
            <div
              key={`edge-${cursor.userId}`}
              className="absolute pointer-events-auto cursor-pointer"
              style={{ left: ex, top: ey, transform: "translate(-50%, -50%)" }}
              onClick={() => onScrollTo?.(cursor.columnId!, cursor.x, cursor.y)}
              title={`${info.userName} is off-screen — click to follow`}
            >
              <div className="flex items-center gap-1 bg-dark-surface/90 border border-green-500 rounded-full px-1 py-0.5 shadow-lg backdrop-blur-sm">
                <div className="ring-1 ring-green-500 rounded-full flex-shrink-0">
                  <Avatar
                    name={info.userName}
                    id={info.userId}
                    imageUrl={info.userImage}
                    size="xs"
                  />
                </div>
                <span className="text-[10px] text-white whitespace-nowrap">
                  {info.userName.split(" ")[0]}
                </span>
                {/* Arrow pointing toward off-screen cursor */}
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  className="flex-shrink-0 mr-0.5"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <path d="M5 0 L10 10 L5 6.5 L0 10 Z" fill="#22c55e" />
                </svg>
              </div>
            </div>
          );
        })}
    </div>
  );
}
