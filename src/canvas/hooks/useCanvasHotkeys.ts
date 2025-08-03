"use client";

import { useEffect } from "react";
import * as fabric from "fabric";

interface UseCanvasHotkeysProps {
  canvas?: fabric.Canvas | null;
  enabled?: boolean;
  // PART 2: Direct function props for debugging
  onGroup: () => void;
  onUngroup: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRotate?: () => void; // Add rotation function
}

/**
 * PART 2: The "Triggers" (Direct Connection Test)
 * Cross-platform keyboard shortcuts hook - Calls functions directly
 *
 * Keyboard Shortcuts:
 * - Ctrl/Cmd + C: Copy selected objects
 * - Ctrl/Cmd + V: Paste copied objects
 * - Ctrl/Cmd + G: Group selected objects
 * - Ctrl/Cmd + Shift + G: Ungroup selected objects
 * - Delete/Backspace: Delete selected objects
 * - Ctrl/Cmd + Z: Undo
 * - Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
 * - R: Rotate selected component 90°
 */
export function useCanvasHotkeys({
  canvas,
  enabled = true,
  onGroup,
  onUngroup,
  onDelete,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  onRotate,
}: UseCanvasHotkeysProps) {
  useEffect(() => {
    if (!enabled || !canvas) return;

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
      const isModifierPressed = e.ctrlKey || e.metaKey;

      if (isModifierPressed) {
        switch (e.key.toLowerCase()) {
          case "c":
            e.preventDefault();
            console.log("TRIGGER: Ctrl/Cmd+C shortcut pressed.");
            onCopy();
            break;

          case "v":
            e.preventDefault();
            console.log("TRIGGER: Ctrl/Cmd+V shortcut pressed.");
            onPaste();
            break;

          case "g":
            e.preventDefault();
            if (e.shiftKey) {
              console.log("TRIGGER: Ctrl/Cmd+Shift+G shortcut pressed.");
              onUngroup();
            } else {
              console.log("TRIGGER: Ctrl/Cmd+G shortcut pressed.");
              onGroup();
            }
            break;

          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              console.log("TRIGGER: Ctrl/Cmd+Shift+Z shortcut pressed.");
              onRedo();
            } else {
              console.log("TRIGGER: Ctrl/Cmd+Z shortcut pressed.");
              onUndo();
            }
            break;

          case "y":
            e.preventDefault();
            console.log("TRIGGER: Ctrl/Cmd+Y shortcut pressed.");
            onRedo();
            break;

          default:
            // No action for other keys
            break;
        }
      }

      // Single key shortcuts (no modifier needed)
      switch (e.key.toLowerCase()) {
        case "delete":
        case "backspace":
          e.preventDefault();
          console.log("TRIGGER: Delete/Backspace shortcut pressed.");
          onDelete();
          break;

        case "r":
          if (!isModifierPressed && onRotate) {
            e.preventDefault();
            console.log("TRIGGER: R key pressed - Rotating component.");
            onRotate();
          }
          break;

        default:
          // No action for other keys
          break;
      }
    };

    // Add event listener
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    canvas,
    enabled,
    onGroup,
    onUngroup,
    onDelete,
    onCopy,
    onPaste,
    onUndo,
    onRedo,
  ]);
}
