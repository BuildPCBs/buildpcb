"use client";

import { useEffect, useState } from "react";
import { responsive } from "@/lib/responsive";
import { getChatUIStyles } from "./ChatUIConfig";
import { StreamMessage, StreamMessageType } from "@/agent/StreamingHandler";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Zap,
} from "lucide-react";

interface AgentStreamDisplayProps {
  messages: StreamMessage[];
  className?: string;
  // Optional dimension overrides from parent container
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
}

export function AgentStreamDisplay({
  messages,
  className = "",
  width,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
}: AgentStreamDisplayProps) {
  // Only show the most recent message
  const currentMessage = messages[messages.length - 1];

  if (!currentMessage) return null;

  const styles = getChatUIStyles();

  return (
    <div
      className={`relative flex items-center flex-shrink-0 ${className}`}
      style={{
        width: width || styles.content.width,
        minWidth: minWidth || styles.content.minWidth,
        maxWidth: maxWidth || styles.content.maxWidth,
        minHeight: minHeight || styles.streamer.minHeight,
        maxHeight: maxHeight || styles.streamer.maxHeight,
        // Remove fixed height - let content determine size
        borderRadius: styles.streamer.borderRadius,
        borderWidth: responsive(1),
        ...getMessageStyles(currentMessage.type),
        paddingTop: responsive(3),
        paddingBottom: responsive(3),
        paddingLeft: responsive(8),
        paddingRight: responsive(8),
        zIndex: 2, // Ensure streamer appears above prompt entry
      }}
    >
      {/* Icon based on message type */}
      <div className="flex-shrink-0" style={{ marginRight: responsive(5) }}>
        {getIcon(currentMessage.type)}
      </div>

      {/* Message Content */}
      <div className="flex-1 overflow-hidden">
        <span
          style={{
            fontSize: responsive(8.5),
            fontWeight: 400,
            lineHeight: 1.4,
          }}
        >
          {currentMessage.message}
        </span>

        {/* Progress bar if applicable */}
        {currentMessage.progress && (
          <div
            className="mt-0.5 bg-white bg-opacity-30 rounded-full overflow-hidden"
            style={{ height: responsive(1.5) }}
          >
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${
                  (currentMessage.progress.current /
                    currentMessage.progress.total) *
                  100
                }%`,
                backgroundColor: getProgressBarColor(currentMessage.type),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Get styles based on message type
 */
function getMessageStyles(type: StreamMessageType): React.CSSProperties {
  const styles = {
    status: {
      backgroundColor: "#EFF6FF", // Blue-50
      border: "1px solid #3B82F6", // Blue-500
      color: "#1E40AF", // Blue-800
    },
    think: {
      backgroundColor: "#F3E8FF", // Purple-50
      border: "1px solid #A855F7", // Purple-500
      color: "#6B21A8", // Purple-800
    },
    progress: {
      backgroundColor: "#DBEAFE", // Blue-100
      border: "1px solid #60A5FA", // Blue-400
      color: "#1E3A8A", // Blue-900
    },
    error: {
      backgroundColor: "#FEE2E2", // Red-100
      border: "1px solid #EF4444", // Red-500
      color: "#991B1B", // Red-800
    },
    success: {
      backgroundColor: "#D1FAE5", // Green-100
      border: "1px solid #10B981", // Green-500
      color: "#065F46", // Green-800
    },
    warn: {
      backgroundColor: "#FFF5D1", // Yellow (matching old thinking indicator)
      border: "1px solid #D6A800",
      color: "#854D0E", // Yellow-900
    },
  };

  return styles[type] || styles.status;
}

/**
 * Get icon based on message type
 */
function getIcon(type: StreamMessageType) {
  const iconSize = responsive(10);
  const iconProps = {
    size: iconSize,
    className: "animate-pulse",
  };

  const icons = {
    status: <Loader2 {...iconProps} className="animate-spin" />,
    think: <Zap {...iconProps} />,
    progress: <Loader2 {...iconProps} className="animate-spin" />,
    error: <AlertCircle {...iconProps} className="" />,
    success: <CheckCircle {...iconProps} className="" />,
    warn: <AlertTriangle {...iconProps} />,
  };

  return icons[type] || icons.status;
}

/**
 * Get progress bar color based on message type
 */
function getProgressBarColor(type: StreamMessageType): string {
  const colors = {
    status: "#3B82F6", // Blue-500
    think: "#A855F7", // Purple-500
    progress: "#60A5FA", // Blue-400
    error: "#EF4444", // Red-500
    success: "#10B981", // Green-500
    warn: "#D6A800", // Yellow
  };

  return colors[type] || colors.status;
}
