"use client";

import { useState, useEffect } from "react";
import { AgentStreamDisplay } from "./AgentStreamDisplay";
import { PromptEntry } from "../layout/PromptEntry";
import { useAIChat } from "@/contexts/AIChatContext";
import { useCanvas } from "@/contexts/CanvasContext";
import { useCanvasState } from "@/hooks/useCanvasState";
import { logger } from "@/lib/logger";
import { agentService } from "@/agent/AgentService";
import { StreamMessage } from "@/agent/StreamingHandler";
import { getChatUIStyles } from "./ChatUIConfig";

/**
 * Unified Chat UI Container
 * All layout, spacing, and positioning logic in ONE place
 */

interface ChatUIContainerProps {
  className?: string;
  onPromptSubmit?: (prompt: string) => Promise<void>;
  isThinking?: boolean;
}

export function ChatUIContainer({
  className = "",
  onPromptSubmit,
  isThinking = false,
}: ChatUIContainerProps) {
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);

  const {
    isThinking: contextIsThinking,
    handlePromptSubmit: contextHandlePromptSubmit,
  } = useAIChat();

  // Get canvas state for AI context
  const { canvas } = useCanvas();
  const { getCurrentState } = useCanvasState({
    canvas,
    enableLiveUpdates: false,
  });

  // Use context isThinking, then external isThinking, then local state
  const currentIsThinking = contextIsThinking || isThinking;

  // Subscribe to agent streaming messages
  useEffect(() => {
    const streamingHandler = agentService.getStreamingHandler();

    const unsubscribe = streamingHandler.subscribe((message) => {
      setStreamMessages((prev) => {
        if (message.type === "success" || message.type === "error") {
          return [message];
        }

        if (message.type === "status") {
          const withoutOlderStatus = prev.filter((m) => m.type !== "status");
          return [...withoutOlderStatus, message];
        }

        if (message.type === "progress") {
          const withoutProgress = prev.filter((m) => m.type !== "progress");
          return [...withoutProgress, message];
        }

        return [...prev, message];
      });

      // Auto-clear success/error messages after 3 seconds
      if (message.type === "success" || message.type === "error") {
        setTimeout(() => setStreamMessages([]), 3000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handlePromptSubmit = async (prompt: string) => {
    logger.api("AI Prompt submitted:", prompt);
    logger.api("Canvas available:", !!canvas);
    const canvasSnapshot = getCurrentState();

    logger.api("Canvas state snapshot captured:", !!canvasSnapshot);
    logger.api("Canvas type:", canvas?.constructor?.name);

    if (onPromptSubmit) {
      // Use external handler if provided
      await onPromptSubmit(prompt);
    } else {
      // Use context handler with canvas state and canvas
      logger.api("Calling context handlePromptSubmit with canvas:", !!canvas);
      await contextHandlePromptSubmit(prompt, canvasSnapshot, canvas);
    }
  };

  const handleMicClick = () => {
    logger.api("Microphone button clicked - Voice input");
    // Voice input functionality here
  };

  const handleDotsClick = () => {
    logger.api("Dots button clicked - More options");
    // More options functionality here
  };

  const handleSendClick = () => {
    logger.api("Send button clicked - Process input");
    // Send/process functionality here
  };

  const styles = getChatUIStyles();

  return (
    <div
      className={`fixed ${className}`}
      style={{
        bottom: styles.offsets.bottom,
        right: styles.offsets.right,
        zIndex: 10,
        pointerEvents: "none", // Allow clicks through to canvas
      }}
    >
      {/* Inner container with all chat UI */}
      <div
        className="flex flex-col items-stretch"
        style={{
          width: styles.content.width,
          minWidth: styles.content.minWidth,
          maxWidth: styles.content.maxWidth,
          gap: styles.gap,
          justifyContent: "flex-end",
          pointerEvents: "auto", // Re-enable clicks for chat UI
        }}
      >
        {/* Agent Stream Display - Only shows when there are messages */}
        {streamMessages.length > 0 && (
          <AgentStreamDisplay
            messages={streamMessages}
            width={styles.content.width}
            minWidth={styles.content.minWidth}
            maxWidth={styles.content.maxWidth}
            minHeight={styles.streamer.minHeight}
            maxHeight={styles.streamer.maxHeight}
          />
        )}

        {/* Prompt Entry - Always visible */}
        <PromptEntry
          onSubmit={handlePromptSubmit}
          onMicClick={handleMicClick}
          onDotsClick={handleDotsClick}
          onSendClick={handleSendClick}
          isThinking={currentIsThinking}
          width={styles.content.width}
          minWidth={styles.content.minWidth}
          maxWidth={styles.content.maxWidth}
          minHeight={styles.promptEntry.minHeight}
          maxHeight={styles.promptEntry.maxHeight}
        />
      </div>
    </div>
  );
}
