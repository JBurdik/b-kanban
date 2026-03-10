import clsx from "clsx";
import type { Version } from "@/lib/types";

interface Props {
  version: Version;
  size?: "sm" | "md";
}

export function VersionBadge({ version, size = "md" }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full font-medium",
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5",
      )}
    >
      <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", version.color)} />
      {version.name}
    </span>
  );
}
