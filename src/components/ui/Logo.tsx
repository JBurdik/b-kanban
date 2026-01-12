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
 * bProductive logo component.
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
      <img
        src="/icon.svg"
        alt="bProductive"
        width={iconSize}
        height={iconSize}
        className="flex-shrink-0"
      />

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
    <img
      src="/icon.svg"
      alt="bProductive"
      width={size}
      height={size}
      className={className}
    />
  );
}
