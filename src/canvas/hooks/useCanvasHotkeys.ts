"use client";

import { useEffect } from "react";

interface UseCanvasHotkeysProps {
  onCopy: () => void;
  onPaste: () => void;
  onDelete?: () => void;
  enabled?: boolean;
}

/**
 * Cross-platform keyboard shortcuts hook for canvas operations
 * Supports both Windows/Linux (Ctrl) and macOS (Cmd) keyboard shortcuts
 */
export function useCanvasHotkeys({
  onCopy,
  onPaste,
  onDelete,
  enabled = true,
}: UseCanvasHotkeysProps) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field - don't trigger shortcuts
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).contentEditable === "true")
      ) {
        return;
      }

      // Cross-platform modifier key detection
      // Windows/Linux: Ctrl key
      // macOS: Cmd key (Meta key)
      const isModifierPressed = e.ctrlKey || e.metaKey;

      if (isModifierPressed && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "c":
            e.preventDefault();
            onCopy();
            console.log("Keyboard shortcut: Copy triggered");
            break;

          case "v":
            e.preventDefault();
            onPaste();
            console.log("Keyboard shortcut: Paste triggered");
            break;

          default:
            // No action for other keys
            break;
        }
      }

      // Delete key (no modifier needed)
      if (e.key === "Delete" || e.key === "Backspace") {
        if (onDelete) {
          e.preventDefault();
          onDelete();
          console.log("Keyboard shortcut: Delete triggered");
        }
      }
    };

    // Add event listener to window for global shortcuts
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup function
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCopy, onPaste, onDelete, enabled]);
}
