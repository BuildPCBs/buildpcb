"use client";

import { useState } from "react";
import { DotsIcon, MicIcon } from "@/components/icons";
import { responsive, responsiveSquare } from "@/lib/responsive";
import { BRAND_COLORS } from "@/lib/constants";
import { getChatUIStyles } from "../agent/ChatUIConfig";
import { Send } from "lucide-react";
import { SelectedComponent } from "@/contexts/CanvasContext";

interface PromptEntryProps {
  onSubmit?: (prompt: string) => void;
  onMicClick?: () => void;
  onDotsClick?: () => void;
  onSendClick?: () => void;
  isThinking?: boolean;
  className?: string;
  selectedComponents?: SelectedComponent[];
  // Optional dimension overrides from parent container
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
}

export function PromptEntry({
  onSubmit,
  onMicClick,
  onDotsClick,
  onSendClick,
  isThinking = false,
  className = "",
  selectedComponents = [],
  width,
  minWidth,
  maxWidth,
  minHeight,
  maxHeight,
}: PromptEntryProps) {
  const [prompt, setPrompt] = useState("");

  // Debug logging
  console.log("📦 PromptEntry selectedComponents:", selectedComponents);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isThinking) {
      onSubmit?.(prompt.trim());
      setPrompt(""); // Clear after submit
    }
  };

  const handleSendClick = () => {
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

  const styles = getChatUIStyles();

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{
        width: width || styles.content.width,
        minWidth: minWidth || styles.content.minWidth,
        maxWidth: maxWidth || styles.content.maxWidth,
        minHeight: minHeight || styles.promptEntry.minHeight,
        maxHeight: maxHeight || styles.promptEntry.maxHeight,
        // Remove fixed height - let content determine size
        zIndex: 1, // Below AgentStreamDisplay
      }}
    >
      {/* Main Prompt Box */}
      <div
        className="relative"
        style={{
          borderRadius: styles.promptEntry.borderRadius,
          borderWidth: responsive(1),
          borderColor: "#DDDDDD", // Border color
          borderStyle: "solid",
          backgroundColor: "#F5F5F5", // Light gray fill as requested
          minHeight: "100%", // Grow to fill parent but don't force it
        }}
      >
        {/* Prompt Text Area */}
        <form onSubmit={handleSubmit} className="relative">
          {/* Container for tags and textarea */}
          <div className="relative">
            {/* Selected Components Tags - Above the textarea input */}
            {selectedComponents.length > 0 && (
              <div
                className="absolute flex flex-wrap gap-1.5 pointer-events-none"
                style={{
                  top: responsive(10),
                  left: responsive(10),
                  right: responsive(10),
                  zIndex: 2,
                }}
              >
                {selectedComponents.map((comp, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 border border-blue-300 rounded-md pointer-events-auto"
                    style={{
                      fontSize: "11px",
                    }}
                  >
                    <span className="text-blue-700">📦</span>
                    <span className="text-blue-900 font-medium">
                      {comp.name}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Build your circuit with AI..."
              disabled={isThinking}
              className="w-full resize-none border-none rounded-xl transition-all focus:outline-none focus:ring-0 focus:border-gray-400"
              rows={2}
              style={{
                backgroundColor: "transparent",
                color: prompt.trim() ? "#000000" : "#999999",
                fontSize: responsive(9),
                lineHeight: 1.4,
                paddingTop:
                  selectedComponents.length > 0
                    ? responsive(35)
                    : responsive(10),
                paddingBottom: responsive(40),
                paddingLeft: responsive(10),
                paddingRight: responsive(10),
                borderRadius: responsive(12),
                border: "none",
                minHeight: "60px",
              }}
            />
          </div>
        </form>

        {/* Action Buttons - Positioned at bottom with microphone on the right */}
        <div
          className="absolute flex items-center justify-between"
          style={{
            bottom: responsive(10),
            left: responsive(10),
            right: responsive(10),
            width: `calc(100% - ${responsive(20)})`, // Account for left and right padding
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
              className="flex items-center justify-center bg-white border hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                ...responsiveSquare(26),
                borderRadius: responsive(99), // Fully circular
                borderColor: "#DDDDDD",
                borderWidth: responsive(1),
              }}
              onMouseEnter={(e) => {
                if (!isThinking) {
                  e.currentTarget.style.borderColor = BRAND_COLORS.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isThinking) {
                  e.currentTarget.style.borderColor = "#DDDDDD";
                }
              }}
            >
              <MicIcon size={13} className="text-gray-600" />
            </button>

            {/* Dots Button */}
            <button
              type="button"
              onClick={onDotsClick}
              disabled={isThinking}
              className="flex items-center justify-center bg-white border hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                ...responsiveSquare(26),
                borderRadius: responsive(99), // Fully circular
                borderColor: "#DDDDDD",
                borderWidth: responsive(1),
              }}
              onMouseEnter={(e) => {
                if (!isThinking) {
                  e.currentTarget.style.borderColor = BRAND_COLORS.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isThinking) {
                  e.currentTarget.style.borderColor = "#DDDDDD";
                }
              }}
            >
              <DotsIcon size={13} className="text-gray-600" />
            </button>
          </div>

          {/* Send Button - Changed from Microphone, blue bg with white icon */}
          <button
            type="button"
            onClick={handleSendClick}
            disabled={isThinking || !prompt.trim()}
            className="flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              ...responsiveSquare(28),
              borderRadius: responsive(99), // Fully circular
              backgroundColor:
                prompt.trim() && !isThinking ? BRAND_COLORS.primary : "#CCCCCC", // Blue when enabled, gray when disabled
              border: "none",
              cursor: prompt.trim() && !isThinking ? "pointer" : "not-allowed",
            }}
            onMouseEnter={(e) => {
              if (prompt.trim() && !isThinking) {
                e.currentTarget.style.backgroundColor =
                  BRAND_COLORS.primaryHover; // Darker blue on hover
              }
            }}
            onMouseLeave={(e) => {
              if (prompt.trim() && !isThinking) {
                e.currentTarget.style.backgroundColor = BRAND_COLORS.primary; // Back to original blue
              }
            }}
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
