"use client";

import { useEffect, useCallback, useRef } from "react";
import * as fabric from "fabric";

interface PanState {
  isPanMode: boolean;
  isDragging: boolean;
  lastX: number;
  lastY: number;
}

export function useCanvasPan(canvas: fabric.Canvas | undefined | null) {
  const panStateRef = useRef<PanState>({
    isPanMode: false,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  // Handle keyboard events for space key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Check if user is typing in an input field - don't trigger pan mode
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).contentEditable === "true")
      ) {
        return; // Allow normal space key behavior in input fields
      }

      if (e.code === "Space" && !e.repeat && canvas) {
        e.preventDefault();
        panStateRef.current.isPanMode = true;

        // Change cursor to grab when entering pan mode
        canvas.defaultCursor = "grab";
        canvas.hoverCursor = "grab";
        canvas.setCursor("grab");

        // Disable selection while in pan mode
        canvas.selection = false;
        canvas.forEachObject((obj) => {
          // Don't change selectability of workspace object
          if ((obj as any).name !== "workspace") {
            obj.selectable = false;
          }
        });
      }
    },
    [canvas]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      // Check if user is typing in an input field - don't trigger pan mode changes
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          (activeElement as HTMLElement).contentEditable === "true")
      ) {
        return; // Allow normal space key behavior in input fields
      }

      if (e.code === "Space" && canvas) {
        e.preventDefault();
        panStateRef.current.isPanMode = false;
        panStateRef.current.isDragging = false;

        // Reset cursor to default
        canvas.defaultCursor = "default";
        canvas.hoverCursor = "move";
        canvas.setCursor("default");

        // Re-enable selection
        canvas.selection = true;
        canvas.forEachObject((obj) => {
          // Don't change selectability of workspace object (it should stay non-selectable)
          if ((obj as any).name !== "workspace") {
            obj.selectable = true;
          }
        });
      }
    },
    [canvas]
  );

  // Handle mouse events for panning
  const handleMouseDown = useCallback(
    (e: fabric.TEvent) => {
      if (!panStateRef.current.isPanMode || !canvas) return;

      const event = e.e as MouseEvent;
      panStateRef.current.isDragging = true;
      panStateRef.current.lastX = event.clientX;
      panStateRef.current.lastY = event.clientY;

      // Change cursor to grabbing during drag
      canvas.setCursor("grabbing");
    },
    [canvas]
  );

  const handleMouseMove = useCallback(
    (e: fabric.TEvent) => {
      if (
        !panStateRef.current.isPanMode ||
        !panStateRef.current.isDragging ||
        !canvas
      )
        return;

      const event = e.e as MouseEvent;
      const deltaX = event.clientX - panStateRef.current.lastX;
      const deltaY = event.clientY - panStateRef.current.lastY;

      // Get current viewport transform
      const vpt = canvas.viewportTransform!;

      // Update the viewport translation
      vpt[4] += deltaX;
      vpt[5] += deltaY;

      // Apply the new viewport transform
      canvas.setViewportTransform(vpt);
      canvas.requestRenderAll();

      // Update last mouse position
      panStateRef.current.lastX = event.clientX;
      panStateRef.current.lastY = event.clientY;
    },
    [canvas]
  );

  const handleMouseUp = useCallback(() => {
    if (!panStateRef.current.isPanMode || !canvas) return;

    panStateRef.current.isDragging = false;

    // Change cursor back to grab (not grabbing)
    canvas.setCursor("grab");
  }, [canvas]);

  // Set up event listeners
  useEffect(() => {
    if (!canvas) return;

    // Add keyboard event listeners to document
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    // Add mouse event listeners to canvas
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    // Cleanup function
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);

      if (canvas) {
        canvas.off("mouse:down", handleMouseDown);
        canvas.off("mouse:move", handleMouseMove);
        canvas.off("mouse:up", handleMouseUp);

        // Reset canvas state if component unmounts while in pan mode
        if (panStateRef.current.isPanMode) {
          canvas.defaultCursor = "default";
          canvas.hoverCursor = "move";
          canvas.setCursor("default");
          canvas.selection = true;
          canvas.forEachObject((obj) => {
            // Don't change selectability of workspace object (it should stay non-selectable)
            if ((obj as any).name !== "workspace") {
              obj.selectable = true;
            }
          });
        }
      }
    };
  }, [
    canvas,
    handleKeyDown,
    handleKeyUp,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  ]);

  // Return pan state for debugging or UI feedback
  return {
    isPanMode: panStateRef.current.isPanMode,
    isDragging: panStateRef.current.isDragging,
  };
}
