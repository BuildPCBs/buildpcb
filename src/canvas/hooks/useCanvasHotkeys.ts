"use client";

import { useEffect } from "react";
import * as fabric from "fabric";

interface UseCanvasHotkeysProps {
  canvas?: fabric.Canvas | null;
  enabled?: boolean;
  // PART 2: Direct function props for debugging
  // NOTE: Group/Ungroup removed - doesn't make sense for PCB schematics
  // Components must maintain individual identity for pin connectivity and metadata
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRotate?: () => void; // Add rotation function
  onSave?: () => void; // Add save function
  onToggleGrid?: () => void; // Add grid toggle function
  onComponentPicker?: () => void; // Add component picker function
  onToggleWireMode?: () => void; // Add wire mode toggle function
}

/**
 * PART 2: The "Triggers" (Direct Connection Test)
 * Cross-platform keyboard shortcuts hook - Calls functions directly
 *
 * Keyboard Shortcuts:
 * - Ctrl/Cmd + C: Copy selected objects
 * - Ctrl/Cmd + V: Paste copied objects
 * - Delete/Backspace: Delete selected objects
 * - Ctrl/Cmd + Z: Undo
 * - Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z: Redo
 * - Ctrl/Cmd + S: Save project
 * - R: Rotate selected component 90°
 * - G: Toggle grid visibility
 * 
 * NOTE: Group/Ungroup removed - not applicable in PCB schematic context
 */
export function useCanvasHotkeys({
  canvas,
  enabled = true,
  onDelete,
  onCopy,
  onPaste,
  onUndo,
  onRedo,
  onRotate,
  onSave,
  onToggleGrid,
  onComponentPicker,
  onToggleWireMode,
}: UseCanvasHotkeysProps) {
  useEffect(() => {
    if (!enabled || !canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Enhanced input field detection - don't trigger shortcuts when typing
      const activeElement = document.activeElement;
      const isTyping =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.tagName === "SELECT" ||
          (activeElement as HTMLElement).contentEditable === "true" ||
          (activeElement as HTMLElement).isContentEditable ||
          activeElement.closest('[contenteditable="true"]') ||
          activeElement.closest("input") ||
          activeElement.closest("textarea"));

      // If user is typing in an input field, ONLY allow Cmd+S (save)
      // All other shortcuts should work normally in inputs (Cmd+A, Cmd+Z, Cmd+C, Cmd+V, etc.)
      if (isTyping) {
        // Cross-platform modifier key detection
        const isModifierPressed = e.ctrlKey || e.metaKey;

        // Only intercept Cmd+S to save the project
        if (isModifierPressed && e.key.toLowerCase() === "s" && onSave) {
          e.preventDefault();
          console.log("TRIGGER: Ctrl/Cmd+S shortcut pressed (in input field).");
          onSave();
          return;
        }

        // Let all other shortcuts work normally in input fields
        console.log(
          "🔇 Canvas hotkeys disabled - user is typing in:",
          activeElement.tagName
        );
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

          case "s":
            e.preventDefault();
            console.log("TRIGGER: Ctrl/Cmd+S shortcut pressed.");
            if (onSave) {
              onSave();
            }
            break;

          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              console.log(
                "🔍 DEBUG: Ctrl/Cmd+Shift+Z shortcut pressed - calling onRedo"
              );
              onRedo();
            } else {
              console.log(
                "🔍 DEBUG: Ctrl/Cmd+Z shortcut pressed - calling onUndo"
              );
              onUndo();
            }
            break;

          case "y":
            e.preventDefault();
            console.log(
              "🔍 DEBUG: Ctrl/Cmd+Y shortcut pressed - calling onRedo"
            );
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

        case "c":
          if (!isModifierPressed && onComponentPicker) {
            e.preventDefault();
            console.log("TRIGGER: C key pressed - Opening component picker.");
            onComponentPicker();
          }
          break;

        case "g":
          if (!isModifierPressed && onToggleGrid) {
            e.preventDefault();
            console.log("TRIGGER: G key pressed - Toggling grid.");
            onToggleGrid();
          }
          break;

        case "w":
          if (!isModifierPressed && onToggleWireMode) {
            e.preventDefault();
            console.log("TRIGGER: W key pressed - Toggling wire mode.");
            onToggleWireMode();
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
    onDelete,
    onCopy,
    onPaste,
    onUndo,
    onRedo,
    onRotate,
    onSave,
    onToggleGrid,
    onComponentPicker,
    onToggleWireMode,
  ]);
}
