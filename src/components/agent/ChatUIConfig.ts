/**
 * Shared configuration for all Chat UI components
 * Ensures consistent dimensions across PromptEntry, AgentStreamDisplay, and AIPromptPanel
 */

import { container, spacing, radius } from "@/lib/responsive";

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
 * 
 * FIXED: Using container() for widths (max 380px), spacing() for gaps
 */
export const getChatUIStyles = () => {
  // Use container() with absolute max to prevent growing on huge screens
  const contentWidth = container(CHAT_UI_DESIGN.CONTENT_WIDTH, 380); // Max 380px
  const padding = spacing(CHAT_UI_DESIGN.PADDING);
  const gap = spacing(CHAT_UI_DESIGN.GAP);

  return {
    // Container (AIPromptPanel)
    container: {
      padding,
      maxWidth: container(
        CHAT_UI_DESIGN.CONTENT_WIDTH + CHAT_UI_DESIGN.PADDING,
        420 // Absolute max: 380 + 40 padding
      ),
      minWidth: "312px", // 280 + 32 padding minimum
    },

    offsets: {
      bottom: spacing(CHAT_UI_DESIGN.BOTTOM_OFFSET),
      right: spacing(CHAT_UI_DESIGN.RIGHT_OFFSET),
    },

    // Content dimensions (shared by all child components)
    content: {
      width: contentWidth,
      minWidth: "280px",
      maxWidth: "380px", // Hard cap - never exceed this
    },

    // Spacing
    gap,

    // PromptEntry
    promptEntry: {
      height: container(CHAT_UI_DESIGN.PROMPT_HEIGHT, 110),
      minHeight: "80px",
      maxHeight: "110px", // Prevent growing over toolbar
      borderRadius: radius(12),
    },

    // AgentStreamDisplay
    streamer: {
      height: container(CHAT_UI_DESIGN.STREAMER_HEIGHT, 32),
      minHeight: "12px",
      maxHeight: "32px",
      borderRadius: radius(4),
      marginBottom: gap,
    },
  };
};

/**
 * Get consistent responsive value for chat UI
 * @deprecated Use container(), spacing(), or radius() directly
 */
export const chatUIResponsive = container;
