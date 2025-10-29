"use client";

import React, { useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect, Text } from "react-konva";
import Konva from "konva";
import { useCanvasPan } from "./hooks/useCanvasPan";

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
  const stageRef = useRef<Konva.Stage>(null);
  const [stage, setStage] = useState<Konva.Stage | null>(null);

  useEffect(() => {
    if (!stageRef.current) return;

    // Initialize Konva Stage
    const konvaStage = stageRef.current;
    setStage(konvaStage);

    // Cleanup function to prevent memory leaks
    return () => {
      // Konva handles cleanup automatically
      setStage(null);
    };
  }, []);

  return (
    <div className={className}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        style={{ border: "1px solid #ccc" }}
      >
        <Layer>
          {/* Background */}
          <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />

          {/* Grid (optional) */}
          {/* Add grid lines here if needed */}

          {/* Sample component */}
          <Rect
            x={100}
            y={100}
            width={50}
            height={50}
            fill="#f0f0f0"
            stroke="#000"
            strokeWidth={1}
          />
          <Text x={125} y={125} text="Test" fontSize={12} align="center" />
        </Layer>
      </Stage>
    </div>
  );
}
