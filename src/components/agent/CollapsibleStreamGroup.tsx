"use client";

import { useState } from "react";
import { StreamMessage } from "@/agent/StreamingHandler";
import { AgentStreamDisplay } from "./AgentStreamDisplay";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleStreamGroupProps {
  messages: StreamMessage[];
  defaultExpanded?: boolean;
}

export function CollapsibleStreamGroup({
  messages,
  defaultExpanded = false,
}: CollapsibleStreamGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!messages || messages.length === 0) return null;

  // Find the last status/success/error message as the header
  const headerMessage = [...messages]
    .reverse()
    .find(
      (m) => m.type === "status" || m.type === "success" || m.type === "error"
    );

  // All other messages (think, progress) go inside
  const bodyMessages = messages.filter(
    (m) => m.type === "think" || m.type === "progress"
  );

  // If no collapsible content, just show the header
  if (bodyMessages.length === 0 && headerMessage) {
    return (
      <div className="my-1">
        <AgentStreamDisplay messages={[headerMessage]} />
      </div>
    );
  }

  return (
    <div className="my-1">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded transition-colors group"
      >
        <div className="flex-shrink-0">
          {/* Removed Chevrons as requested for text-only style */}
        </div>

        {headerMessage ? (
          <div className="flex-1">
            <AgentStreamDisplay messages={[headerMessage]} />
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2 font-mono text-xs text-gray-500">
            <span>[▶ Thinking... ({bodyMessages.length} steps)]</span>
          </div>
        )}

        {bodyMessages.length > 0 && !isExpanded && (
          <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            {bodyMessages.length} hidden
          </span>
        )}
      </button>

      {/* Collapsible Body */}
      {isExpanded && bodyMessages.length > 0 && (
        <div className="ml-6 mt-1 space-y-1 border-l-2 border-gray-200 pl-3">
          <AgentStreamDisplay messages={bodyMessages} />
        </div>
      )}
    </div>
  );
}
