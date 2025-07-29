interface IconProps {
  size?: number;
  className?: string;
}

export function WindowIcon({ size = 16, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Window frame with rounded corners */}
      <rect x="3" y="4" width="18" height="16" rx="3" ry="3" />
      {/* Left panel (smaller) */}
      <rect
        x="3"
        y="4"
        width="6"
        height="16"
        rx="3"
        ry="3"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Vertical divider between left and right panels */}
      <line x1="9" y1="4" x2="9" y2="20" />
      {/* NO top header divider - removed this line */}
    </svg>
  );
}
