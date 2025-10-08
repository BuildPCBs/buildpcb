"use client";

import { PromptEntry } from "./PromptEntry";
import { useAIChat } from "../../contexts/AIChatContext";
import { useCanvas } from "../../contexts/CanvasContext";
import { useCanvasStateSnapshot } from "../../hooks/useCanvasState";
import { logger } from "../../lib/logger";
import { getChatUIStyles } from "../agent/ChatUIConfig";

interface AIPromptPanelProps {
  className?: string;
  onPromptSubmit?: (prompt: string) => Promise<void>;
  isThinking?: boolean;
}

export function AIPromptPanel({
  className = "",
  onPromptSubmit,
  isThinking = false,
}: AIPromptPanelProps) {
  const {
    isThinking: contextIsThinking,
    handlePromptSubmit: contextHandlePromptSubmit,
  } = useAIChat();

  // Get canvas state for AI context
  const { canvas } = useCanvas();
  const canvasState = useCanvasStateSnapshot(canvas);

  // Use context isThinking, then external isThinking, then local state
  const currentIsThinking = contextIsThinking || isThinking;

  const handlePromptSubmit = async (prompt: string) => {
    logger.api("AI Prompt submitted:", prompt);
    logger.api("Canvas available:", !!canvas);
    logger.api("Canvas state:", canvasState);
    logger.api("Canvas type:", canvas?.constructor?.name);

    if (onPromptSubmit) {
      // Use external handler if provided
      await onPromptSubmit(prompt);
    } else {
      // Use context handler with canvas state and canvas
      logger.api("Calling context handlePromptSubmit with canvas:", !!canvas);
      await contextHandlePromptSubmit(prompt, canvasState, canvas);
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
        bottom: styles.container.padding,
        right: styles.container.padding,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <div
        className="relative flex flex-col"
        style={{
          ...styles.content,
          gap: 0,
          pointerEvents: "auto",
        }}
      >
        {/* Prompt Entry */}
        <PromptEntry
          onSubmit={handlePromptSubmit}
          onMicClick={handleMicClick}
          onDotsClick={handleDotsClick}
          onSendClick={handleSendClick}
          isThinking={currentIsThinking}
        />
      </div>
    </div>
  );
}
