"use client";

import { useState, useEffect, useCallback } from "react";
import * as fabric from "fabric";

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface GridConfig {
  majorLineSpacing: number; // pixels between major grid lines
  minorLineSpacing: number; // pixels between minor grid lines
  majorLineColor: string;
  minorLineColor: string;
  majorLineWidth: number;
  minorLineWidth: number;
}

const DEFAULT_GRID_CONFIG: GridConfig = {
  majorLineSpacing: 100,
  minorLineSpacing: 20,
  majorLineColor: "#e5e5e5",
  minorLineColor: "#f5f5f5",
  majorLineWidth: 1,
  minorLineWidth: 0.5,
};

// Original hook for HTML Canvas (used by existing Canvas component)
export function useCanvasViewport(initialViewport?: Partial<ViewportState>) {
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: 1,
    ...initialViewport,
  });

  const pan = (deltaX: number, deltaY: number) => {
    setViewport((prev) => ({
      ...prev,
      x: prev.x + deltaX,
      y: prev.y + deltaY,
    }));
  };

  const zoom = (delta: number, centerX: number, centerY: number) => {
    setViewport((prev) => {
      const newZoom = Math.max(0.1, Math.min(10, prev.zoom + delta));

      // Zoom towards the mouse position
      const zoomFactor = newZoom / prev.zoom;
      const newX = centerX - (centerX - prev.x) * zoomFactor;
      const newY = centerY - (centerY - prev.y) * zoomFactor;

      return {
        x: newX,
        y: newY,
        zoom: newZoom,
      };
    });
  };

  const resetView = () => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  return {
    viewport,
    pan,
    zoom,
    resetView,
    setViewport,
  };
}

// Constants for Fabric.js zoom behavior
const ZOOM_FACTOR = 1.1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 10;

// New hook specifically for Fabric.js Canvas with mouse wheel zooming
export function useFabricCanvasViewport(canvas?: fabric.Canvas) {
  const handleMouseWheel = useCallback(
    (opt: fabric.TEvent<WheelEvent>) => {
      if (!canvas) return;

      const delta = opt.e.deltaY;
      const pointer = canvas.getPointer(opt.e);

      // Prevent default browser scrolling
      opt.e.preventDefault();
      opt.e.stopPropagation();

      // Calculate zoom direction and new zoom level
      const zoom = canvas.getZoom();
      let newZoom: number;

      if (delta > 0) {
        // Scrolling down - zoom out
        newZoom = zoom / ZOOM_FACTOR;
      } else {
        // Scrolling up - zoom in
        newZoom = zoom * ZOOM_FACTOR;
      }

      // Apply zoom limits
      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

      // Zoom to the mouse cursor position
      canvas.zoomToPoint(new fabric.Point(pointer.x, pointer.y), newZoom);

      // Request a re-render
      canvas.requestRenderAll();
    },
    [canvas]
  );

  useEffect(() => {
    if (!canvas) return;

    // Add mouse wheel event listener
    canvas.on("mouse:wheel", handleMouseWheel);

    // Cleanup event listener on unmount
    return () => {
      canvas.off("mouse:wheel", handleMouseWheel);
    };
  }, [canvas, handleMouseWheel]);

  // Return utility functions for canvas control
  return {
    getCurrentZoom: () => canvas?.getZoom() || 1,
    setZoom: (zoom: number) => {
      if (!canvas) return;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      canvas.setZoom(clampedZoom);
      canvas.requestRenderAll();
    },
    resetZoom: () => {
      if (!canvas) return;
      canvas.setZoom(1);
      canvas.requestRenderAll();
    },
    zoomToFit: () => {
      if (!canvas) return;
      const objects = canvas.getObjects();
      if (objects.length === 0) return;

      canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const group = new fabric.Group(objects);
      const boundingRect = group.getBoundingRect();

      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const scaleX = canvasWidth / boundingRect.width;
      const scaleY = canvasHeight / boundingRect.height;
      const scale = Math.min(scaleX, scaleY) * 0.8; // 80% to add some padding

      const finalScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));

      const centerX = boundingRect.left + boundingRect.width / 2;
      const centerY = boundingRect.top + boundingRect.height / 2;

      canvas.setZoom(finalScale);
      canvas.absolutePan(
        new fabric.Point(
          canvasWidth / 2 - centerX * finalScale,
          canvasHeight / 2 - centerY * finalScale
        )
      );

      canvas.requestRenderAll();
    },
  };
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportState,
  canvasWidth: number,
  canvasHeight: number,
  config: GridConfig = DEFAULT_GRID_CONFIG
) {
  ctx.save();

  // Only show grid when zoomed in enough
  const minZoomForMinorGrid = 0.5;
  const minZoomForMajorGrid = 0.2;

  if (viewport.zoom < minZoomForMajorGrid) {
    ctx.restore();
    return;
  }

  // Calculate grid spacing based on zoom
  const majorSpacing = config.majorLineSpacing * viewport.zoom;
  const minorSpacing = config.minorLineSpacing * viewport.zoom;

  // Calculate grid offset
  const offsetX = viewport.x % majorSpacing;
  const offsetY = viewport.y % majorSpacing;
  const minorOffsetX = viewport.x % minorSpacing;
  const minorOffsetY = viewport.y % minorSpacing;

  // Draw minor grid lines (only when zoomed in enough)
  if (viewport.zoom >= minZoomForMinorGrid) {
    ctx.strokeStyle = config.minorLineColor;
    ctx.lineWidth = config.minorLineWidth;
    ctx.beginPath();

    // Vertical minor lines
    for (let x = minorOffsetX; x < canvasWidth; x += minorSpacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
    }

    // Horizontal minor lines
    for (let y = minorOffsetY; y < canvasHeight; y += minorSpacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
    }

    ctx.stroke();
  }

  // Draw major grid lines
  ctx.strokeStyle = config.majorLineColor;
  ctx.lineWidth = config.majorLineWidth;
  ctx.beginPath();

  // Vertical major lines
  for (let x = offsetX; x < canvasWidth; x += majorSpacing) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
  }

  // Horizontal major lines
  for (let y = offsetY; y < canvasHeight; y += majorSpacing) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
  }

  ctx.stroke();
  ctx.restore();
}
