interface SendIconProps {
  size?: number;
  className?: string;
}

export function SendIcon({ size = 24, className = "" }: SendIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="2" y1="12" x2="22" y2="12" />
      <polyline points="15,5 22,12 15,19" />
    </svg>
  );
}
