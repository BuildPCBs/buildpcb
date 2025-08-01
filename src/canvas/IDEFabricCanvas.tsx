"use client";

import React, { useRef, useEffect, useState } from "react";
import * as fabric from "fabric";
import { useFabricCanvasViewport } from "./useCanvasViewport";

interface IDEFabricCanvasProps {
  className?: string;
}

export function IDEFabricCanvas({ className = "" }: IDEFabricCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });

  // Use our custom hook for mouse wheel zooming
  const { getCurrentZoom, setZoom, resetZoom, zoomToFit } =
    useFabricCanvasViewport(fabricCanvas || undefined);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 1920,
          height: rect.height || 1080,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric.js canvas with a clean PCB design background
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: "#1a1a2e", // Dark background suitable for PCB design
      selection: true,
      preserveObjectStacking: true,
    });

    setFabricCanvas(canvas);

    // Add sample PCB components for demonstration
    // Arduino board representation
    const arduinoBoard = new fabric.Rect({
      left: dimensions.width / 2 - 60,
      top: dimensions.height / 2 - 40,
      width: 120,
      height: 80,
      fill: "#0f3460",
      stroke: "#16537e",
      strokeWidth: 2,
      selectable: true,
      moveable: true,
    });

    // Add Arduino label
    const arduinoLabel = new fabric.Text("ARDUINO UNO R3", {
      left: dimensions.width / 2,
      top: dimensions.height / 2 - 10,
      fontSize: 10,
      fill: "#e94560",
      fontFamily: "Arial",
      textAlign: "center",
      originX: "center",
      originY: "center",
      selectable: false,
    });

    // LED component
    const led = new fabric.Circle({
      left: dimensions.width / 2 + 100,
      top: dimensions.height / 2 - 60,
      radius: 15,
      fill: "#e94560",
      stroke: "#533483",
      strokeWidth: 2,
      selectable: true,
      moveable: true,
    });

    const ledLabel = new fabric.Text("LED", {
      left: dimensions.width / 2 + 100,
      top: dimensions.height / 2 - 60,
      fontSize: 8,
      fill: "#ffffff",
      fontFamily: "Arial",
      textAlign: "center",
      originX: "center",
      originY: "center",
      selectable: false,
    });

    // Resistor component
    const resistor = new fabric.Rect({
      left: dimensions.width / 2 + 70,
      top: dimensions.height / 2 + 20,
      width: 40,
      height: 12,
      fill: "#f5f3f0",
      stroke: "#533483",
      strokeWidth: 2,
      selectable: true,
      moveable: true,
    });

    const resistorLabel = new fabric.Text("220Ω", {
      left: dimensions.width / 2 + 90,
      top: dimensions.height / 2 + 35,
      fontSize: 8,
      fill: "#e94560",
      fontFamily: "Arial",
      textAlign: "center",
      originX: "center",
      originY: "center",
      selectable: false,
    });

    // Connection wires (as lines)
    const wire1 = new fabric.Line(
      [
        dimensions.width / 2 + 60,
        dimensions.height / 2 - 30,
        dimensions.width / 2 + 85,
        dimensions.height / 2 - 60,
      ],
      {
        stroke: "#16f5b4",
        strokeWidth: 3,
        selectable: true,
        moveable: true,
      }
    );

    const wire2 = new fabric.Line(
      [
        dimensions.width / 2 + 100,
        dimensions.height / 2 - 45,
        dimensions.width / 2 + 90,
        dimensions.height / 2 + 20,
      ],
      {
        stroke: "#16f5b4",
        strokeWidth: 3,
        selectable: true,
        moveable: true,
      }
    );

    const wire3 = new fabric.Line(
      [
        dimensions.width / 2 + 70,
        dimensions.height / 2 + 26,
        dimensions.width / 2 + 60,
        dimensions.height / 2 - 10,
      ],
      {
        stroke: "#16f5b4",
        strokeWidth: 3,
        selectable: true,
        moveable: true,
      }
    );

    // Add all objects to canvas
    canvas.add(
      arduinoBoard,
      arduinoLabel,
      led,
      ledLabel,
      resistor,
      resistorLabel,
      wire1,
      wire2,
      wire3
    );

    // Cleanup function
    return () => {
      canvas.dispose();
    };
  }, [dimensions]);

  return (
    <div
      ref={containerRef}
      className={`relative canvas-container ${className}`}
      data-scrollable="false"
    >
      {/* Canvas element */}
      <canvas
        ref={canvasRef}
        className="cursor-default"
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
