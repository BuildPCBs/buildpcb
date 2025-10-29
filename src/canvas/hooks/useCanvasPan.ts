"use client";

import { useEffect, useCallback, useRef } from "react";
import Konva from "konva";

interface PanState {
  isPanMode: boolean;
  isDragging: boolean;
  lastX: number;
  lastY: number;
}

export function useCanvasPan(stage: Konva.Stage | undefined | null) {
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

      if (e.code === "Space" && !e.repeat && stage) {
        e.preventDefault();
        panStateRef.current.isPanMode = true;

        // Change cursor to grab when entering pan mode
        stage.container().style.cursor = "grab";

        // Disable selection while in pan mode
        // Konva handles this differently - we'll handle in mouse events
      }
    },
    [stage]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === "Space" && stage) {
        panStateRef.current.isPanMode = false;
        panStateRef.current.isDragging = false;

        // Reset cursor
        stage.container().style.cursor = "default";
      }
    },
    [stage]
  );

  // Handle mouse events for panning
  useEffect(() => {
    if (!stage) return;

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!panStateRef.current.isPanMode) return;

      e.evt.preventDefault();
      panStateRef.current.isDragging = true;
      panStateRef.current.lastX = e.evt.clientX;
      panStateRef.current.lastY = e.evt.clientY;

      stage.container().style.cursor = "grabbing";
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!panStateRef.current.isDragging || !panStateRef.current.isPanMode)
        return;

      e.evt.preventDefault();

      const deltaX = e.evt.clientX - panStateRef.current.lastX;
      const deltaY = e.evt.clientY - panStateRef.current.lastY;

      // Get current position
      const currentX = stage.x();
      const currentY = stage.y();

      // Update stage position
      stage.x(currentX + deltaX);
      stage.y(currentY + deltaY);
      stage.batchDraw();

      panStateRef.current.lastX = e.evt.clientX;
      panStateRef.current.lastY = e.evt.clientY;
    };

    const handleMouseUp = () => {
      if (panStateRef.current.isDragging) {
        panStateRef.current.isDragging = false;
        if (stage) {
          stage.container().style.cursor = panStateRef.current.isPanMode
            ? "grab"
            : "default";
        }
      }
    };

    // Add event listeners
    stage.on("mousedown", handleMouseDown);
    stage.on("mousemove", handleMouseMove);
    stage.on("mouseup", handleMouseUp);

    // Global mouse up to handle mouse release outside canvas
    const handleGlobalMouseUp = () => {
      if (panStateRef.current.isDragging) {
        panStateRef.current.isDragging = false;
        if (stage) {
          stage.container().style.cursor = panStateRef.current.isPanMode
            ? "grab"
            : "default";
        }
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);

    // Cleanup function
    return () => {
      if (stage) {
        stage.off("mousedown", handleMouseDown);
        stage.off("mousemove", handleMouseMove);
        stage.off("mouseup", handleMouseUp);
      }
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [stage]);

  // Handle keyboard events
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Return pan state for debugging or UI feedback
  return {
    isPanMode: panStateRef.current.isPanMode,
    isDragging: panStateRef.current.isDragging,
  };
}
