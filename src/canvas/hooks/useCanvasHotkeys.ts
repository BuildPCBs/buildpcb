"use client";

import { useEffect } from "react";
import * as fabric from "fabric";

interface UseCanvasHotkeysProps {
  canvas?: fabric.Canvas | null;
  onCopy: () => void;
  onPaste: () => void;
  onDelete?: () => void;
  enabled?: boolean;
}

/**
 * Cross-platform keyboard shortcuts hook for canvas operations
 * Supports both Windows/Linux (Ctrl) and macOS (Cmd) keyboard shortcuts
 *
 * Keyboard Shortcuts:
 * - Ctrl/Cmd + C: Copy selected objects
 * - Ctrl/Cmd + V: Paste copied objects
 * - Delete/Backspace: Delete selected objects
 * - R: Rotate selected objects by 90 degrees
 */
export function useCanvasHotkeys({
  canvas,
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

      // Single key shortcuts (no modifier needed)
      switch (e.key.toLowerCase()) {
        case "delete":
        case "backspace":
          // Direct canvas deletion
          if (canvas) {
            e.preventDefault();
            handleCanvasDelete();
            console.log("Keyboard shortcut: Delete triggered (canvas)");
          } else if (onDelete) {
            e.preventDefault();
            onDelete();
            console.log("Keyboard shortcut: Delete triggered (callback)");
          }
          break;

        case "r":
          // Rotation shortcut
          if (canvas) {
            e.preventDefault();
            handleCanvasRotation();
            console.log("Keyboard shortcut: Rotation triggered");
          }
          break;

        default:
          // No action for other keys
          break;
      }
    };

    // Handle deletion of selected objects
    const handleCanvasDelete = () => {
      if (!canvas) return;

      // Get all currently active objects (returns array even for single selection)
      const activeObjects = canvas.getActiveObjects();

      if (activeObjects.length > 0) {
        // Remove each selected object from the canvas
        activeObjects.forEach((obj) => {
          // Don't delete workspace objects
          if ((obj as any).name !== "workspace") {
            canvas.remove(obj);
          }
        });

        // Clear the selection box
        canvas.discardActiveObject();

        // Update the view
        canvas.renderAll();

        console.log(`Deleted ${activeObjects.length} object(s)`);
      }
    };

    // Handle rotation of selected objects
    const handleCanvasRotation = () => {
      if (!canvas) return;

      // Get the currently active object or selection
      const activeObject = canvas.getActiveObject();

      if (activeObject) {
        // Don't rotate workspace objects
        if ((activeObject as any).name === "workspace") {
          return;
        }

        // Get current angle (default to 0 if not set)
        const currentAngle = activeObject.angle || 0;

        // Rotate by 90 degrees
        activeObject.set("angle", currentAngle + 90);

        // Update the view
        canvas.renderAll();

        console.log(`Rotated object to ${currentAngle + 90} degrees`);
      }
    };

    // Add event listener to window for global shortcuts
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup function
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canvas, onCopy, onPaste, onDelete, enabled]);
}
