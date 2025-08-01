"use client";

import { useRef, useEffect, useState } from "react";
import * as fabric from "fabric";

interface CanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export function Canvas({
  width = 800,
  height = 600,
  className = "",
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric.js canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "#FFFFFF",
    });

    // Clear any default objects that might be added
    canvas.clear();

    // Store the canvas instance
    setFabricCanvas(canvas);

    // Cleanup function to prevent memory leaks
    return () => {
      canvas.dispose();
      setFabricCanvas(null);
    };
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
      }}
    />
  );
}
