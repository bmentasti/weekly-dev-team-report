import { cn } from "@/lib/utils";

/**
 * DevMetrics logo. The frame + wordmark use currentColor (so it adapts to dark
 * or light surfaces); the accent bars/line stay Electric Blue.
 */
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      {/* Document frame (open brackets) */}
      <path
        d="M13 5H9a4 4 0 0 0-4 4v4M13 35H9a4 4 0 0 1-4-4v-4M27 5h4a4 4 0 0 1 4 4v4M27 35h4a4 4 0 0 0 4-4v-4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Small squares */}
      <rect x="11" y="11" width="4" height="4" rx="1" fill="#2563FF" />
      <rect x="17" y="11" width="4" height="4" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="11" y="17" width="4" height="4" rx="1" fill="currentColor" opacity="0.35" />
      {/* Ascending line + arrow */}
      <path
        d="M12 28l5-5 4 3 7-8"
        stroke="#2563FF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25 18h4v4"
        stroke="#2563FF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  iconClassName,
  showText = true,
}: {
  className?: string;
  iconClassName?: string;
  showText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoIcon className={iconClassName} />
      {showText && (
        <span className="text-xl font-bold tracking-tight">DevMetrics</span>
      )}
    </span>
  );
}
