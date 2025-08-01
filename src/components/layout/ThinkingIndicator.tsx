"use client";

import { r, responsive } from "@/lib/responsive";

interface ThinkingIndicatorProps {
  isVisible?: boolean;
  className?: string;
}

export function ThinkingIndicator({
  isVisible = false,
  className = "",
}: ThinkingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div
      className={`absolute flex items-center ${className}`}
      style={{
        ...r({
          width: 338,
          height: 25,
          borderRadius: 6,
          bottom: 105, // Position above the prompt box (97px height + 8px gap)
        }),
        right: responsive(32), // Same right margin as toolbar
        backgroundColor: "#FFF5D1",
        border: "1px solid #D6A800",
        borderWidth: responsive(1),
        zIndex: 10,
        padding: `0 ${responsive(12)}`,
      }}
    >
      {/* Animated Three-Dot Loader */}
      <div className="flex items-center space-x-1 mr-2">
        <div
          className="w-1 h-1 bg-yellow-600 rounded-full animate-pulse"
          style={{ animationDuration: "1.4s" }}
        />
        <div
          className="w-1 h-1 bg-yellow-600 rounded-full animate-pulse"
          style={{ animationDuration: "1.4s", animationDelay: "0.2s" }}
        />
        <div
          className="w-1 h-1 bg-yellow-600 rounded-full animate-pulse"
          style={{ animationDuration: "1.4s", animationDelay: "0.4s" }}
        />
      </div>

      {/* Thinking Text */}
      <span
        className="text-yellow-700"
        style={{
          fontSize: responsive(10),
          fontWeight: 400, // Regular weight, not bold
        }}
      >
        Thinking...
      </span>
    </div>
  );
}
