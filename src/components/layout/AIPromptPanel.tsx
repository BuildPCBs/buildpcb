"use client";

import { useState } from "react";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { PromptEntry } from "./PromptEntry";
import { useAIChat } from "../../contexts/AIChatContext";
import { useCanvas } from "../../contexts/CanvasContext";
import { useCanvasStateSnapshot } from "../../hooks/useCanvasState";

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
  const [localIsThinking, setLocalIsThinking] = useState(false);
  const {
    isThinking: contextIsThinking,
    handlePromptSubmit: contextHandlePromptSubmit,
  } = useAIChat();

  // Get canvas state for AI context
  const { canvas } = useCanvas();
  const canvasState = useCanvasStateSnapshot(canvas);

  // Use context isThinking, then external isThinking, then local state
  const currentIsThinking = contextIsThinking || isThinking || localIsThinking;

  const handlePromptSubmit = async (prompt: string) => {
    console.log("🚀 AI Prompt submitted:", prompt);
    console.log("🎨 Canvas available:", !!canvas);
    console.log("📊 Canvas state:", canvasState);
    console.log("🔧 Canvas type:", canvas?.constructor?.name);

    if (onPromptSubmit) {
      // Use external handler if provided
      await onPromptSubmit(prompt);
    } else {
      // Use context handler with canvas state and canvas
      console.log(
        "📤 Calling context handlePromptSubmit with canvas:",
        !!canvas
      );
      await contextHandlePromptSubmit(prompt, canvasState, canvas);
    }
  };

  const handleMicClick = () => {
    console.log("Microphone button clicked - Voice input");
    // Voice input functionality here
  };

  const handleDotsClick = () => {
    console.log("Dots button clicked - More options");
    // More options functionality here
  };

  const handleSendClick = () => {
    console.log("Send button clicked - Process input");
    // Send/process functionality here
  };

  return (
    <div className={`relative ${className}`}>
      {/* Thinking Indicator */}
      <ThinkingIndicator isVisible={currentIsThinking} />

      {/* Prompt Entry */}
      <PromptEntry
        onSubmit={handlePromptSubmit}
        onMicClick={handleMicClick}
        onDotsClick={handleDotsClick}
        onSendClick={handleSendClick}
        isThinking={currentIsThinking}
      />
    </div>
  );
}
