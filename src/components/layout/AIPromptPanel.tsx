"use client";

import { useState } from "react";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { PromptEntry } from "./PromptEntry";
import { useAIChat } from "../../contexts/AIChatContext";

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

  // Use context isThinking, then external isThinking, then local state
  const currentIsThinking = contextIsThinking || isThinking || localIsThinking;

  const handlePromptSubmit = async (prompt: string) => {
    console.log("AI Prompt submitted:", prompt);

    if (onPromptSubmit) {
      // Use external handler if provided
      await onPromptSubmit(prompt);
    } else {
      // Use context handler
      await contextHandlePromptSubmit(prompt);
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
