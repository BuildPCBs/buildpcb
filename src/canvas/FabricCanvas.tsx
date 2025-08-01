"use client";

import React, { useRef, useEffect, useState } from "react";
import * as fabric from "fabric";
import { useFabricCanvasViewport } from "./useCanvasViewport";

interface FabricCanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export function FabricCanvas({
  width = 800,
  height = 600,
  className = "",
}: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  // Use our custom hook for mouse wheel zooming
  const { getCurrentZoom, setZoom, resetZoom, zoomToFit } =
    useFabricCanvasViewport(fabricCanvas || undefined);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric.js canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "#f8f9fa",
    });

    setFabricCanvas(canvas);

    // Add some sample objects to demonstrate zooming
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: "#ff6b6b",
    });

    const circle = new fabric.Circle({
      left: 300,
      top: 200,
      radius: 50,
      fill: "#4ecdc4",
    });

    const triangle = new fabric.Triangle({
      left: 500,
      top: 150,
      width: 80,
      height: 80,
      fill: "#45b7d1",
    });

    canvas.add(rect, circle, triangle);

    // Cleanup function
    return () => {
      canvas.dispose();
    };
  }, [width, height]);

  const handleResetZoom = () => {
    resetZoom();
  };

  const handleZoomToFit = () => {
    zoomToFit();
  };

  const handleSetZoom = (zoom: number) => {
    setZoom(zoom);
  };

  return (
    <div
      className={`relative canvas-container ${className}`}
      data-scrollable="false"
    >
      {/* Control buttons */}
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <button
          onClick={handleResetZoom}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Reset Zoom
        </button>
        <button
          onClick={handleZoomToFit}
          className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
        >
          Zoom to Fit
        </button>
        <button
          onClick={() => handleSetZoom(0.5)}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          50%
        </button>
        <button
          onClick={() => handleSetZoom(2)}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          200%
        </button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-2 right-2 z-10 bg-black/70 text-white px-2 py-1 rounded text-sm">
        Zoom: {Math.round((getCurrentZoom() || 1) * 100)}%
      </div>

      {/* Canvas element */}
      <canvas
        ref={canvasRef}
        className="border border-gray-300 cursor-default"
      />

      {/* Instructions */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Instructions:</strong>
        </p>
        <ul className="list-disc ml-5 space-y-1">
          <li>Use your mouse wheel to zoom in/out at the cursor position</li>
          <li>Scroll up to zoom in, scroll down to zoom out</li>
          <li>Zoom factor: 1.1x per scroll step</li>
          <li>Zoom range: 10% - 1000%</li>
          <li>Click the buttons above to test programmatic zoom controls</li>
        </ul>
      </div>
    </div>
  );
}
