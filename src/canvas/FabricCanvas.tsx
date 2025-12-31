"use client";

import React, { useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect, Circle } from "react-konva";
import Konva from "konva";
// import { useKonvaCanvasViewport } from "./useCanvasViewport";

interface KonvaCanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export function KonvaCanvas({
  width = 800,
  height = 600,
  className = "",
}: KonvaCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const [stage, setStage] = useState<Konva.Stage | null>(null);
  const [zoom, setZoom] = useState(1);

  // TODO: Convert viewport hook to work with Konva
  // const { getCurrentZoom, setZoom, resetZoom, zoomToFit } =
  //   useKonvaCanvasViewport(stage || undefined);

  useEffect(() => {
    if (!stageRef.current) return;

    const konvaStage = stageRef.current;
    setStage(konvaStage);
  }, []);

  const handleResetZoom = () => {
    setZoom(1);
    if (stage) {
      stage.scale({ x: 1, y: 1 });
      stage.position({ x: 0, y: 0 });
      stage.batchDraw();
    }
  };

  const handleZoomToFit = () => {
    // TODO: Implement zoom to fit logic
    console.log("Zoom to fit - to be implemented");
  };

  const handleSetZoom = (newZoom: number) => {
    setZoom(newZoom);
    if (stage) {
      stage.scale({ x: newZoom, y: newZoom });
      stage.batchDraw();
    }
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
          className="px-3 py-1 bg-[#0038DF] text-white rounded hover:bg-[#002BB5] text-sm"
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
        Zoom: {Math.round(zoom * 100)}%
      </div>

      {/* Konva Stage */}
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        style={{ backgroundColor: "#f8f9fa", border: "1px solid #d1d5db" }}
        scaleX={zoom}
        scaleY={zoom}
        // Performance optimizations
        pixelRatio={window.devicePixelRatio || 1}
      >
        <Layer
          // Enable performance optimizations
          listening={true}
          imageSmoothingEnabled={true}
        >
          {/* Sample shapes - will be converted to dynamic components */}
          <Rect x={100} y={100} width={100} height={100} fill="#ff6b6b" />
          <Circle x={350} y={250} radius={50} fill="#4ecdc4" />
        </Layer>
      </Stage>

      {/* Instructions */}
      <div className="mt-4 text-sm text-gray-600">
        <p>
          <strong>Instructions:</strong>
        </p>
        <ul className="list-disc list-inside mt-2">
          <li>Click and drag to pan the canvas</li>
          <li>Use mouse wheel to zoom in/out</li>
          <li>Use the buttons above to control zoom</li>
        </ul>
      </div>
    </div>
  );
}
