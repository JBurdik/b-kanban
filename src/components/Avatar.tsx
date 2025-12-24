import clsx from "clsx";

interface Props {
  name: string;
  id?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
};

export function Avatar({ name, id, size = "md", className }: Props) {
  // Use DiceBear API for avatars
  const seed = id || name;
  const avatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1a1a1a`;

  return (
    <img
      src={avatarUrl}
      alt={name}
      className={clsx(
        "rounded-full bg-dark-surface",
        sizes[size],
        className
      )}
    />
  );
}
