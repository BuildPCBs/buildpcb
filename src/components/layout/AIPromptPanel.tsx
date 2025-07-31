"use client";

import { useState } from "react";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { PromptEntry } from "./PromptEntry";

interface AIPromptPanelProps {
  className?: string;
}

export function AIPromptPanel({ className = "" }: AIPromptPanelProps) {
  const [isThinking, setIsThinking] = useState(false);

  const handlePromptSubmit = async (prompt: string) => {
    console.log("AI Prompt submitted:", prompt);
    setIsThinking(true);

    // Simulate AI thinking time
    setTimeout(() => {
      setIsThinking(false);
      console.log("AI finished thinking");
    }, 3000);
  };

  const handlePlusClick = () => {
    console.log("Plus button clicked - Add component");
    // Add component functionality here
  };

  const handleDotsClick = () => {
    console.log("Dots button clicked - More options");
    // More options functionality here
  };

  const handleMicClick = () => {
    console.log("Microphone button clicked - Voice input");
    // Voice input functionality here
  };

  return (
    <div className={className}>
      {/* Thinking Indicator */}
      <ThinkingIndicator isVisible={isThinking} />

      {/* Prompt Entry */}
      <PromptEntry
        onSubmit={handlePromptSubmit}
        onPlusClick={handlePlusClick}
        onDotsClick={handleDotsClick}
        onMicClick={handleMicClick}
        isThinking={isThinking}
      />
    </div>
  );
}
