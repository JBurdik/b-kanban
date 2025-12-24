import clsx from "clsx";

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: "sm" | "md" | "lg";
  /** Whether to center in full screen */
  fullScreen?: boolean;
  /** Additional className */
  className?: string;
}

const sizeStyles = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-2",
  lg: "w-12 h-12 border-3",
};

/**
 * Loading spinner component.
 *
 * @example
 * ```tsx
 * // Inline spinner
 * <LoadingSpinner size="sm" />
 *
 * // Full screen centered
 * <LoadingSpinner fullScreen />
 * ```
 */
export function LoadingSpinner({
  size = "md",
  fullScreen = false,
  className,
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      className={clsx(
        "animate-spin rounded-full border-accent border-t-transparent",
        sizeStyles[size],
        className
      )}
    />
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * Loading skeleton for content placeholders
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded bg-dark-hover",
        className
      )}
      {...props}
    />
  );
}
