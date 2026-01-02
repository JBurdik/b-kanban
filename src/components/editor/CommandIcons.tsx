import clsx from "clsx";

interface IconProps {
  className?: string;
}

export function HeadingIcon({ level, className }: IconProps & { level: 1 | 2 | 3 }) {
  return (
    <span className={clsx("font-bold", className)}>
      H{level}
    </span>
  );
}

export function BulletListIcon({ className }: IconProps) {
  return (
    <svg className={clsx("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      <circle cx="2" cy="6" r="1" fill="currentColor" />
      <circle cx="2" cy="12" r="1" fill="currentColor" />
      <circle cx="2" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

export function NumberedListIcon({ className }: IconProps) {
  return (
    <svg className={clsx("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13" />
      <text x="1" y="8" fontSize="8" fill="currentColor" fontFamily="monospace">1</text>
      <text x="1" y="14" fontSize="8" fill="currentColor" fontFamily="monospace">2</text>
      <text x="1" y="20" fontSize="8" fill="currentColor" fontFamily="monospace">3</text>
    </svg>
  );
}

export function CheckboxIcon({ className }: IconProps) {
  return (
    <svg className={clsx("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function CodeIcon({ className }: IconProps) {
  return (
    <svg className={clsx("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

export function QuoteIcon({ className }: IconProps) {
  return (
    <svg className={clsx("w-5 h-5", className)} fill="currentColor" viewBox="0 0 24 24">
      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
    </svg>
  );
}

export function DividerIcon({ className }: IconProps) {
  return (
    <svg className={clsx("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
    </svg>
  );
}

export function TableIcon({ className }: IconProps) {
  return (
    <svg className={clsx("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
      <path strokeWidth={2} d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

export function CalloutIcon({ className }: IconProps) {
  return (
    <svg className={clsx("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function HighlightIcon({ className }: IconProps) {
  return (
    <svg className={clsx("w-5 h-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}
