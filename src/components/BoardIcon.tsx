import clsx from "clsx";

interface BoardIconData {
  name: string;
  iconType?: "emoji" | "image";
  iconEmoji?: string;
  iconUrl?: string | null;
}

interface Props {
  board: BoardIconData;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  xs: "w-5 h-5 text-sm",
  sm: "w-6 h-6 text-base",
  md: "w-8 h-8 text-lg",
  lg: "w-10 h-10 text-xl",
};

const imageSizes = {
  xs: "w-5 h-5",
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

export function BoardIcon({ board, size = "md", className }: Props) {
  // If board has an emoji icon
  if (board.iconType === "emoji" && board.iconEmoji) {
    return (
      <span
        className={clsx(
          "flex items-center justify-center",
          sizes[size],
          className
        )}
        role="img"
        aria-label={`${board.name} icon`}
      >
        {board.iconEmoji}
      </span>
    );
  }

  // If board has an uploaded image icon
  if (board.iconType === "image" && board.iconUrl) {
    return (
      <img
        src={board.iconUrl}
        alt={`${board.name} icon`}
        className={clsx(
          "rounded object-cover bg-dark-surface",
          imageSizes[size],
          className
        )}
      />
    );
  }

  // Fallback: generate initials or DiceBear icon
  const initials = board.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      className={clsx(
        "flex items-center justify-center rounded bg-dark-hover text-dark-muted font-medium",
        sizes[size],
        className
      )}
      aria-label={`${board.name} icon`}
    >
      {initials}
    </div>
  );
}
