"use client";

import React, { useRef, useEffect } from "react";

interface HorizontalRulerProps {
  width: number;
  height?: number;
  viewportTransform: number[];
  zoom: number;
  className?: string;
}

export function HorizontalRuler({
  width,
  height = 30,
  viewportTransform,
  zoom,
  className = "",
}: HorizontalRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Fill background with a subtle gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#fafafa");
    gradient.addColorStop(1, "#f0f0f0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw border at bottom
    ctx.strokeStyle = "#d0d0d0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 1);
    ctx.lineTo(width, height - 1);
    ctx.stroke();

    // Calculate viewport offset
    const offsetX = viewportTransform[4];

    // Calculate the start and end positions in world coordinates
    const startX = -offsetX / zoom;
    const endX = (width - offsetX) / zoom;

    // Determine appropriate tick spacing based on zoom level
    let majorTickSpacing = 100;
    let minorTickSpacing = 10;

    if (zoom < 0.5) {
      majorTickSpacing = 500;
      minorTickSpacing = 100;
    } else if (zoom < 1) {
      majorTickSpacing = 200;
      minorTickSpacing = 50;
    } else if (zoom > 2) {
      majorTickSpacing = 50;
      minorTickSpacing = 5;
    } else if (zoom > 5) {
      majorTickSpacing = 20;
      minorTickSpacing = 2;
    }

    // Draw tick marks
    ctx.strokeStyle = "#777777";
    ctx.fillStyle = "#777777";
    ctx.font = "9px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";

    // Calculate the first major tick position
    const firstMajorTick = Math.floor(startX / majorTickSpacing) * majorTickSpacing;
    const firstMinorTick = Math.floor(startX / minorTickSpacing) * minorTickSpacing;

    // Draw minor ticks
    for (let x = firstMinorTick; x <= endX + minorTickSpacing; x += minorTickSpacing) {
      if (x % majorTickSpacing !== 0) { // Skip positions where major ticks will be drawn
        const screenX = x * zoom + offsetX;
        if (screenX >= 0 && screenX <= width) {
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(screenX, height - 8);
          ctx.lineTo(screenX, height - 1);
          ctx.stroke();
        }
      }
    }

    // Draw major ticks with labels
    for (let x = firstMajorTick; x <= endX + majorTickSpacing; x += majorTickSpacing) {
      const screenX = x * zoom + offsetX;
      if (screenX >= 0 && screenX <= width) {
        // Draw major tick
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX, height - 15);
        ctx.lineTo(screenX, height - 1);
        ctx.stroke();

        // Draw label
        ctx.fillText(x.toString(), screenX, height - 18);
      }
    }

  }, [width, height, viewportTransform, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className={`ruler-horizontal ${className}`}
      style={{
        display: "block",
        backgroundColor: "#f8f9fa",
        borderBottom: "1px solid #e0e0e0",
      }}
    />
  );
}
