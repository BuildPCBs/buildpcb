interface ChartIconProps {
  size?: number;
  className?: string;
}

export function ChartIcon({ size = 24, className = "" }: ChartIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 3v18h18" />
      <path d="M18.7 8l-4.7 4.7-3-3L7 14" />
    </svg>
  );
}
