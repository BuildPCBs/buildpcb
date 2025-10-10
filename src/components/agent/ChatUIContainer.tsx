"use client";

import { PromptEntry } from "../layout/PromptEntry";
import { useAIChat } from "@/contexts/AIChatContext";
import { useCanvas } from "@/contexts/CanvasContext";
import { useCanvasState } from "@/hooks/useCanvasState";
import { logger } from "@/lib/logger";
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
  const {
    isThinking: contextIsThinking,
    handlePromptSubmit: contextHandlePromptSubmit,
  } = useAIChat();

  // Get canvas state for AI context
  const { canvas, selectedComponents } = useCanvas();
  const { getCurrentState } = useCanvasState({
    canvas,
    enableLiveUpdates: false,
  });

  // Debug log for selected components
  console.log("🔍 ChatUIContainer selectedComponents:", selectedComponents);

  // Use context isThinking, then external isThinking, then local state
  const currentIsThinking = contextIsThinking || isThinking;

  const handlePromptSubmit = async (prompt: string) => {
    logger.api("AI Prompt submitted:", prompt);
    logger.api("Canvas available:", !!canvas);
    logger.api("Selected components:", selectedComponents);
    const canvasSnapshot = getCurrentState();

    logger.api("Canvas state snapshot captured:", !!canvasSnapshot);
    logger.api("Canvas type:", canvas?.constructor?.name);

    if (onPromptSubmit) {
      // Use external handler if provided
      await onPromptSubmit(prompt);
    } else {
      // Use context handler with canvas state, canvas, and selected components
      logger.api("Calling context handlePromptSubmit with canvas:", !!canvas);
      logger.api("Passing selected components:", selectedComponents);
      await contextHandlePromptSubmit(prompt, canvasSnapshot, canvas, selectedComponents);
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
          gap: 0,
          justifyContent: "flex-end",
          pointerEvents: "auto", // Re-enable clicks for chat UI
        }}
      >
        {/* Prompt Entry - Always visible, no gap since streamer is in chat now */}
        <PromptEntry
          onSubmit={handlePromptSubmit}
          onMicClick={handleMicClick}
          onDotsClick={handleDotsClick}
          onSendClick={handleSendClick}
          isThinking={currentIsThinking}
          selectedComponents={selectedComponents}
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
