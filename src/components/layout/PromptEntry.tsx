"use client";

import { useState } from "react";
import { PlusIcon, DotsIcon, MicIcon } from "@/components/icons";
import { r, responsive } from "@/lib/responsive";

interface PromptEntryProps {
  onSubmit?: (prompt: string) => void;
  onPlusClick?: () => void;
  onDotsClick?: () => void;
  onMicClick?: () => void;
  isThinking?: boolean;
  className?: string;
}

export function PromptEntry({
  onSubmit,
  onPlusClick,
  onDotsClick,
  onMicClick,
  isThinking = false,
  className = "",
}: PromptEntryProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isThinking) {
      onSubmit?.(prompt.trim());
      setPrompt(""); // Clear after submit
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      className={`fixed ${className}`}
      style={{
        ...r({
          width: 338,
          height: 97,
          borderRadius: 12,
          top: 708,
        }),
        right: responsive(32), // Same right margin as toolbar
        zIndex: 10,
      }}
    >
      {/* Main Prompt Box */}
      <div
        className="relative border border-gray-300 h-full"
        style={{
          borderRadius: responsive(12),
          borderWidth: responsive(1),
          backgroundColor: "#F8F8F81F", // Translucent light gray
        }}
      >
        {/* Prompt Text Area */}
        <form onSubmit={handleSubmit} className="h-full relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Build your circuit with AI..."
            disabled={isThinking}
            className="w-full h-full resize-none border-none rounded-xl transition-all focus:outline-none focus:ring-0 focus:border-gray-400"
            style={{
              backgroundColor: "transparent",
              color: "#999999",
              fontSize: responsive(12),
              padding: `${responsive(12)} ${responsive(50)} ${responsive(
                45
              )} ${responsive(12)}`, // Extra right padding for mic icon
              borderRadius: responsive(12),
              border: "none",
            }}
          />

          {/* Microphone Icon - Positioned at far right */}
          <button
            type="button"
            onClick={onMicClick}
            disabled={isThinking}
            className="absolute flex items-center justify-center bg-white border hover:border-blue-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              top: responsive(13),
              right: responsive(13),
              ...r({
                width: 32,
                height: 32,
                borderRadius: 99, // Fully circular
              }),
              borderColor: "#DDDDDD",
              borderWidth: responsive(1),
            }}
          >
            <MicIcon size={16} className="text-gray-600" />
          </button>
        </form>

        {/* Action Buttons - Positioned at bottom */}
        <div
          className="absolute flex items-center"
          style={{
            bottom: responsive(13),
            left: responsive(13),
            gap: responsive(10),
          }}
        >
          {/* Plus Button */}
          <button
            type="button"
            onClick={onPlusClick}
            disabled={isThinking}
            className="flex items-center justify-center bg-white border hover:border-blue-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              ...r({
                width: 32,
                height: 32,
                borderRadius: 99, // Fully circular
              }),
              borderColor: "#DDDDDD",
              borderWidth: responsive(1),
            }}
          >
            <PlusIcon size={16} className="text-gray-600" />
          </button>

          {/* Dots Button */}
          <button
            type="button"
            onClick={onDotsClick}
            disabled={isThinking}
            className="flex items-center justify-center bg-white border hover:border-blue-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              ...r({
                width: 32,
                height: 32,
                borderRadius: 99, // Fully circular
              }),
              borderColor: "#DDDDDD",
              borderWidth: responsive(1),
            }}
          >
            <DotsIcon size={16} className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
