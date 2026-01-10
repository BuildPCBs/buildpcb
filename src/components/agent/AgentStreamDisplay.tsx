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
  ChevronRight,
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
  // Show all messages (accumulated)
  if (!messages || messages.length === 0) return null;

  const styles = getChatUIStyles();

  return (
    <div
      className={`relative flex flex-col gap-0.5 flex-shrink-0 ${className}`}
      style={{
        width: width || styles.content.width,
        minWidth: minWidth || styles.content.minWidth,
        maxWidth: maxWidth || styles.content.maxWidth,
        minHeight: minHeight || styles.streamer.minHeight,
        maxHeight: maxHeight || styles.streamer.maxHeight,
        zIndex: 2,
      }}
    >
      {messages.map((message) => (
        <StreamMessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}

interface StreamMessageItemProps {
  message: StreamMessage;
}

function StreamMessageItem({ message }: StreamMessageItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center flex-shrink-0 font-mono text-xs text-black"
        style={{
          paddingTop: responsive(1),
          paddingBottom: responsive(1),
        }}
      >
        {/* Icon based on message type */}
        <div className="flex-shrink-0 mr-2">{getEmojiIcon(message)}</div>

        {/* Message Content */}
        <div className="flex-1 overflow-hidden">
          <span
            style={{
              fontSize: responsive(8.5),
              fontWeight: 400,
              lineHeight: 1.4,
            }}
          >
            {message.message}
          </span>

          {/* Expandable content toggle */}
          {message.expandable && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2 text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
              style={{ fontSize: responsive(7) }}
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
              {message.expandable.title}
            </button>
          )}

          {/* Progress bar if applicable */}
          {message.progress && (
            <div
              className="mt-0.5 bg-gray-100 rounded-full overflow-hidden"
              style={{ height: responsive(1.5) }}
            >
              <div
                className="h-full transition-all duration-300 bg-gray-400"
                style={{
                  width: `${
                    (message.progress.current / message.progress.total) * 100
                  }%`,
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Expandable content */}
      {message.expandable && isExpanded && (
        <div
          className="ml-8 mt-1 mb-2 p-2 bg-gray-50 rounded text-xs text-gray-700 border-l-2 border-gray-200"
          style={{ fontSize: responsive(7.5) }}
        >
          {message.expandable.content}
        </div>
      )}
    </div>
  );
}

/**
 * Get emoji icon based on message content
 */
function getEmojiIcon(message: StreamMessage) {
  const content = message.message.toLowerCase();

  if (content.includes("looking for") || content.includes("searching")) {
    return "🔍";
  } else if (content.includes("adding component")) {
    return "📦";
  } else if (content.includes("connecting") || content.includes("wiring")) {
    return "🔌";
  } else if (content.includes("checking") || content.includes("reviewing")) {
    return "👀";
  } else if (content.includes("removing") || content.includes("deleting")) {
    return "🗑️";
  } else if (message.type === "success") {
    return "✅";
  } else if (message.type === "error") {
    return "❌";
  } else if (message.type === "warn") {
    return "⚠️";
  } else if (message.type === "think") {
    return "💭";
  } else if (message.type === "progress") {
    return "⏳";
  }

  return "🔹";
}
