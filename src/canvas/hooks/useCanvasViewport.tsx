import { useState, useEffect } from "react";
import * as fabric from "fabric";

interface ViewportState {
  viewportTransform: number[];
  zoom: number;
}

export function useCanvasViewport(canvas: fabric.Canvas | null) {
  const [viewportState, setViewportState] = useState<ViewportState>({
    viewportTransform: [1, 0, 0, 1, 0, 0],
    zoom: 1,
  });

  useEffect(() => {
    if (!canvas) return;

    const updateViewportState = () => {
      setViewportState({
        viewportTransform: [...canvas.viewportTransform],
        zoom: canvas.getZoom(),
      });
    };

    // Initial state
    updateViewportState();

    // Listen for viewport changes
    const handleViewportChange = () => {
      updateViewportState();
    };

    // Listen for various events that change the viewport
    canvas.on("mouse:wheel", handleViewportChange);
    canvas.on("path:created", handleViewportChange);

    // More comprehensive pan detection
    let wasViewportChanged = false;
    
    const checkViewportChange = () => {
      const currentTransform = canvas.viewportTransform;
      const currentZoom = canvas.getZoom();
      
      if (
        currentTransform[0] !== viewportState.viewportTransform[0] ||
        currentTransform[1] !== viewportState.viewportTransform[1] ||
        currentTransform[2] !== viewportState.viewportTransform[2] ||
        currentTransform[3] !== viewportState.viewportTransform[3] ||
        currentTransform[4] !== viewportState.viewportTransform[4] ||
        currentTransform[5] !== viewportState.viewportTransform[5] ||
        currentZoom !== viewportState.zoom
      ) {
        updateViewportState();
      }
    };

    // Use a more frequent check for smooth ruler updates during panning
    const intervalId = setInterval(checkViewportChange, 16); // ~60fps

    // Also listen for mouse events that might indicate panning
    const handleMouseMove = () => {
      // Check on next frame to avoid too frequent updates during drag
      if (!wasViewportChanged) {
        wasViewportChanged = true;
        requestAnimationFrame(() => {
          checkViewportChange();
          wasViewportChanged = false;
        });
      }
    };

    canvas.on("mouse:move", handleMouseMove);

    // Also listen for programmatic viewport changes
    const originalSetViewportTransform = canvas.setViewportTransform;
    canvas.setViewportTransform = function(transform: fabric.TMat2D) {
      const result = originalSetViewportTransform.call(this, transform);
      updateViewportState();
      return result;
    };

    const originalZoomToPoint = canvas.zoomToPoint;
    canvas.zoomToPoint = function(point: fabric.Point, value: number) {
      const result = originalZoomToPoint.call(this, point, value);
      updateViewportState();
      return result;
    };

    // Cleanup
    return () => {
      canvas.off("mouse:wheel", handleViewportChange);
      canvas.off("path:created", handleViewportChange);
      canvas.off("mouse:move", handleMouseMove);
      clearInterval(intervalId);
      
      // Restore original methods
      canvas.setViewportTransform = originalSetViewportTransform;
      canvas.zoomToPoint = originalZoomToPoint;
    };
  }, [canvas]);

  return viewportState;
}
