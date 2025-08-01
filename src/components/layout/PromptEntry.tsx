"use client";

import { useState } from "react";
import { DotsIcon, MicIcon } from "@/components/icons";
import { r, responsive } from "@/lib/responsive";
import { Send } from "lucide-react";

interface PromptEntryProps {
  onSubmit?: (prompt: string) => void;
  onMicClick?: () => void; // Previously onPlusClick, now microphone
  onDotsClick?: () => void;
  onSendClick?: () => void; // Previously onMicClick, now send button
  isThinking?: boolean;
  className?: string;
}

export function PromptEntry({
  onSubmit,
  onMicClick,
  onDotsClick,
  onSendClick,
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
      className={`absolute ${className}`}
      style={{
        ...r({
          width: 338,
          height: 97,
          borderRadius: 12,
          bottom: 32, // Changed from top to bottom positioning
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
          backgroundColor: "#FFFFFF", // White background as requested
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
              padding: `${responsive(12)} ${responsive(12)} ${responsive(
                45
              )} ${responsive(12)}`, // Reduced right padding since mic moved to bottom
              borderRadius: responsive(12),
              border: "none",
            }}
          />
        </form>

        {/* Action Buttons - Positioned at bottom with microphone on the right */}
        <div
          className="absolute flex items-center justify-between"
          style={{
            bottom: responsive(13),
            left: responsive(13),
            right: responsive(13),
            width: `calc(100% - ${responsive(26)})`, // Account for left and right padding
          }}
        >
          {/* Left side buttons */}
          <div
            className="flex items-center"
            style={{
              gap: responsive(10),
            }}
          >
            {/* Microphone Button - Changed from Plus to Mic */}
            <button
              type="button"
              onClick={onMicClick}
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
              <MicIcon size={16} className="text-gray-600" />
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

          {/* Send Button - Changed from Microphone, blue bg with white icon */}
          <button
            type="button"
            onClick={onSendClick}
            disabled={isThinking}
            className="flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
            style={{
              ...r({
                width: 32,
                height: 32,
                borderRadius: 99, // Fully circular
              }),
              backgroundColor: "#3B82F6", // Blue background
              border: "none",
            }}
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
