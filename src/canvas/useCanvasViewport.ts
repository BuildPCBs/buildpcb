import { useState, useRef, useEffect } from "react";

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
