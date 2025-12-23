import clsx from "clsx";

export interface LogoProps {
  /** Size of the logo */
  size?: "sm" | "md" | "lg" | "xl";
  /** Whether to show text alongside icon */
  showText?: boolean;
  /** Additional className */
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: "text-sm" },
  md: { icon: 32, text: "text-base" },
  lg: { icon: 40, text: "text-lg" },
  xl: { icon: 48, text: "text-xl" },
};

/**
 * bProductive logo component with kanban-inspired design.
 * Three stylized columns with cards in amber/orange theme.
 *
 * @example
 * ```tsx
 * <Logo size="lg" showText />
 * <Logo size="sm" showText={false} />
 * ```
 */
export function Logo({ size = "md", showText = true, className }: LogoProps) {
  const { icon: iconSize, text: textSize } = sizes[size];

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Column backgrounds */}
        <rect
          x="4"
          y="6"
          width="12"
          height="36"
          rx="3"
          className="fill-dark-border"
        />
        <rect
          x="18"
          y="6"
          width="12"
          height="36"
          rx="3"
          className="fill-dark-border"
        />
        <rect
          x="32"
          y="6"
          width="12"
          height="36"
          rx="3"
          className="fill-dark-border"
        />

        {/* Column 1: 1 card */}
        <rect
          x="6"
          y="10"
          width="8"
          height="10"
          rx="2"
          className="fill-accent"
        />

        {/* Column 2: 2 cards */}
        <rect
          x="20"
          y="10"
          width="8"
          height="10"
          rx="2"
          className="fill-accent"
        />
        <rect
          x="20"
          y="22"
          width="8"
          height="10"
          rx="2"
          className="fill-accent-light"
        />

        {/* Column 3: 3 cards (done column, more items) */}
        <rect
          x="34"
          y="10"
          width="8"
          height="8"
          rx="2"
          className="fill-accent"
        />
        <rect
          x="34"
          y="20"
          width="8"
          height="8"
          rx="2"
          className="fill-accent-light"
        />
        <rect
          x="34"
          y="30"
          width="8"
          height="8"
          rx="2"
          className="fill-accent-dark"
        />
      </svg>

      {showText && (
        <span className={clsx("font-bold tracking-tight", textSize)}>
          <span className="text-accent">b</span>
          <span className="text-dark-text">Productive</span>
        </span>
      )}
    </div>
  );
}

/**
 * Compact icon-only version of the logo
 */
export function LogoIcon({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Column backgrounds */}
      <rect
        x="4"
        y="6"
        width="12"
        height="36"
        rx="3"
        className="fill-dark-border"
      />
      <rect
        x="18"
        y="6"
        width="12"
        height="36"
        rx="3"
        className="fill-dark-border"
      />
      <rect
        x="32"
        y="6"
        width="12"
        height="36"
        rx="3"
        className="fill-dark-border"
      />

      {/* Cards */}
      <rect
        x="6"
        y="10"
        width="8"
        height="10"
        rx="2"
        className="fill-accent"
      />
      <rect
        x="20"
        y="10"
        width="8"
        height="10"
        rx="2"
        className="fill-accent"
      />
      <rect
        x="20"
        y="22"
        width="8"
        height="10"
        rx="2"
        className="fill-accent-light"
      />
      <rect
        x="34"
        y="10"
        width="8"
        height="8"
        rx="2"
        className="fill-accent"
      />
      <rect
        x="34"
        y="20"
        width="8"
        height="8"
        rx="2"
        className="fill-accent-light"
      />
      <rect
        x="34"
        y="30"
        width="8"
        height="8"
        rx="2"
        className="fill-accent-dark"
      />
    </svg>
  );
}
