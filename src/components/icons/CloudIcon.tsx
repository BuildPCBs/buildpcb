interface CloudIconProps {
  size?: number;
  className?: string;
  isAnimating?: boolean;
}

export function CloudIcon({
  size = 20,
  className = "",
  isAnimating = false,
}: CloudIconProps) {
  return (
    <svg
      width={size}
      height={size * 0.8} // Maintain aspect ratio from figma (20.15 x 16.12)
      viewBox="0 0 24 19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} ${isAnimating ? "animate-pulse" : ""}`}
    >
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      <polyline points="16,16 12,12 8,16" />
      <line x1="12" y1="12" x2="12" y2="21" />
    </svg>
  );
}
