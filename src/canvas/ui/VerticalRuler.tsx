"use client";

import React, { useRef, useEffect } from "react";

interface VerticalRulerProps {
  width?: number;
  height: number;
  viewportTransform: number[];
  zoom: number;
  className?: string;
}

export function VerticalRuler({
  width = 30,
  height,
  viewportTransform,
  zoom,
  className = "",
}: VerticalRulerProps) {
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
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#fafafa");
    gradient.addColorStop(1, "#f0f0f0");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw border at right
    ctx.strokeStyle = "#d0d0d0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - 1, 0);
    ctx.lineTo(width - 1, height);
    ctx.stroke();

    // Calculate viewport offset
    const offsetY = viewportTransform[5];

    // Calculate the start and end positions in world coordinates
    const startY = -offsetY / zoom;
    const endY = (height - offsetY) / zoom;

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
    const firstMajorTick = Math.floor(startY / majorTickSpacing) * majorTickSpacing;
    const firstMinorTick = Math.floor(startY / minorTickSpacing) * minorTickSpacing;

    // Draw minor ticks
    for (let y = firstMinorTick; y <= endY + minorTickSpacing; y += minorTickSpacing) {
      if (y % majorTickSpacing !== 0) { // Skip positions where major ticks will be drawn
        const screenY = y * zoom + offsetY;
        if (screenY >= 0 && screenY <= height) {
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(width - 8, screenY);
          ctx.lineTo(width - 1, screenY);
          ctx.stroke();
        }
      }
    }

    // Draw major ticks with labels
    for (let y = firstMajorTick; y <= endY + majorTickSpacing; y += majorTickSpacing) {
      const screenY = y * zoom + offsetY;
      if (screenY >= 0 && screenY <= height) {
        // Draw major tick
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width - 15, screenY);
        ctx.lineTo(width - 1, screenY);
        ctx.stroke();

        // Save the current transformation
        ctx.save();
        
        // Translate to the text position and rotate
        ctx.translate(8, screenY);
        ctx.rotate(-Math.PI / 2);
        
        // Draw the rotated text
        ctx.textAlign = "center";
        ctx.fillText(y.toString(), 0, 0);
        
        // Restore the transformation
        ctx.restore();
      }
    }

  }, [width, height, viewportTransform, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className={`ruler-vertical ${className}`}
      style={{
        display: "block",
        backgroundColor: "#f8f9fa",
        borderRight: "1px solid #e0e0e0",
      }}
    />
  );
}
