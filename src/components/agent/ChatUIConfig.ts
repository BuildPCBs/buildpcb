/**
 * Shared configuration for all Chat UI components
 * Ensures consistent dimensions across PromptEntry, AgentStreamDisplay, and AIPromptPanel
 */

import { responsive } from "@/lib/responsive";

/**
 * Design constants (at 1280px screen width)
 */
export const CHAT_UI_DESIGN = {
  // Base dimensions from design
  CONTENT_WIDTH: 338,
  PADDING: 32,
  GAP: 16,
  BOTTOM_OFFSET: 56,
  RIGHT_OFFSET: 32,

  // Component heights
  PROMPT_HEIGHT: 97,
  STREAMER_HEIGHT: 16,
} as const;

export const CHAT_UI_OFFSETS = {
  bottom: CHAT_UI_DESIGN.BOTTOM_OFFSET,
  right: CHAT_UI_DESIGN.RIGHT_OFFSET,
} as const;

/**
 * Calculated responsive dimensions
 * All components should use these for consistency
 */
export const getChatUIStyles = () => {
  const contentWidth = responsive(CHAT_UI_DESIGN.CONTENT_WIDTH);
  const padding = responsive(CHAT_UI_DESIGN.PADDING);
  const gap = responsive(CHAT_UI_DESIGN.GAP);

  return {
    // Container (AIPromptPanel)
    container: {
      padding,
      maxWidth: responsive(
        CHAT_UI_DESIGN.CONTENT_WIDTH + CHAT_UI_DESIGN.PADDING
      ),
      minWidth: "312px", // 280 + 32 padding minimum
    },

    offsets: {
      bottom: responsive(CHAT_UI_DESIGN.BOTTOM_OFFSET),
      right: responsive(CHAT_UI_DESIGN.RIGHT_OFFSET),
    },

    // Content dimensions (shared by all child components)
    content: {
      width: contentWidth,
      minWidth: "280px",
      maxWidth: "400px",
    },

    // Spacing
    gap,

    // PromptEntry
    promptEntry: {
      height: responsive(CHAT_UI_DESIGN.PROMPT_HEIGHT),
      minHeight: "80px",
      maxHeight: "120px",
      borderRadius: responsive(12),
    },

    // AgentStreamDisplay
    streamer: {
      height: responsive(CHAT_UI_DESIGN.STREAMER_HEIGHT),
      minHeight: "12px",
      maxHeight: "36px",
      borderRadius: responsive(4),
      marginBottom: gap,
    },
  };
};

/**
 * Get consistent responsive value for chat UI
 */
export const chatUIResponsive = responsive;
