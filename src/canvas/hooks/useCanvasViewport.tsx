import { useState, useEffect } from "react";
import Konva from "konva";

interface ViewportState {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

export function useCanvasViewport(stage: Konva.Stage | null) {
  const [viewportState, setViewportState] = useState<ViewportState>({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
  });

  useEffect(() => {
    if (!stage) return;

    const updateViewportState = () => {
      setViewportState({
        x: stage.x(),
        y: stage.y(),
        scaleX: stage.scaleX(),
        scaleY: stage.scaleY(),
      });
    };

    // Initial state
    updateViewportState();

    // Listen for viewport changes
    const handleViewportChange = () => {
      updateViewportState();
    };

    // Listen for various events that change the viewport
    stage.on("wheel", handleViewportChange);
    stage.on("dragend", handleViewportChange);

    // More comprehensive pan detection
    let wasViewportChanged = false;

    const checkViewportChange = () => {
      const currentX = stage.x();
      const currentY = stage.y();
      const currentScaleX = stage.scaleX();
      const currentScaleY = stage.scaleY();

      if (
        currentX !== viewportState.x ||
        currentY !== viewportState.y ||
        currentScaleX !== viewportState.scaleX ||
        currentScaleY !== viewportState.scaleY
      ) {
        wasViewportChanged = true;
        updateViewportState();
      }
    };

    // Check for changes periodically (for smooth updates)
    const intervalId = setInterval(checkViewportChange, 100);

    // Cleanup function
    return () => {
      stage.off("wheel", handleViewportChange);
      stage.off("dragend", handleViewportChange);
      clearInterval(intervalId);
    };
  }, [stage]);

  return viewportState;
}
