import { useRef, useEffect, useCallback } from "react";
import { useCanvasInteraction } from "./useCanvasInteraction";
import { useCanvasViewport, drawGrid } from "./useCanvasViewport";

interface CanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export function Canvas({
  width = 100000,
  height = 100000,
  className = "",
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Start at center of huge canvas
  const { viewport, pan, zoom } = useCanvasViewport({
    x: width / 2 - 640, // Center 1280px view in huge canvas
    y: height / 2 - 416, // Center 832px view in huge canvas
    zoom: 1,
  });

  const handlePan = useCallback(
    (deltaX: number, deltaY: number) => {
      pan(deltaX, deltaY);
    },
    [pan]
  );

  const handleZoom = useCallback(
    (delta: number, x: number, y: number) => {
      zoom(delta, x, y);
    },
    [zoom]
  );

  const handleSelect = useCallback(
    (x: number, y: number) => {
      // Convert screen coordinates to world coordinates
      const worldX = (x - viewport.x) / viewport.zoom;
      const worldY = (y - viewport.y) / viewport.zoom;
      console.log("Selected at world coordinates:", worldX, worldY);
    },
    [viewport]
  );

  const interactions = useCanvasInteraction(
    handlePan,
    handleZoom,
    handleSelect
  );

  // Draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, viewport, canvas.width, canvas.height);

    // Draw mock circuit design at center
    ctx.save();

    // Calculate center position considering viewport
    const centerX = (canvas.width / 2 - viewport.x) * viewport.zoom;
    const centerY = (canvas.height / 2 - viewport.y) * viewport.zoom;

    // Scale all drawing with zoom
    ctx.scale(viewport.zoom, viewport.zoom);
    const scaledCenterX = centerX / viewport.zoom;
    const scaledCenterY = centerY / viewport.zoom;

    // Draw Arduino board (rectangle)
    ctx.strokeStyle = "#2563eb";
    ctx.fillStyle = "#dbeafe";
    ctx.lineWidth = 2;
    ctx.fillRect(scaledCenterX - 60, scaledCenterY - 40, 120, 80);
    ctx.strokeRect(scaledCenterX - 60, scaledCenterY - 40, 120, 80);

    // Draw Arduino label
    ctx.fillStyle = "#1e40af";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText("ARDUINO", scaledCenterX, scaledCenterY - 20);
    ctx.fillText("UNO R3", scaledCenterX, scaledCenterY - 8);

    // Draw pins on sides
    ctx.fillStyle = "#374151";
    for (let i = 0; i < 14; i++) {
      // Left side pins
      ctx.fillRect(scaledCenterX - 65, scaledCenterY - 35 + i * 5, 8, 3);
      // Right side pins
      ctx.fillRect(scaledCenterX + 57, scaledCenterY - 35 + i * 5, 8, 3);
    }

    // Draw LED (circle)
    ctx.strokeStyle = "#dc2626";
    ctx.fillStyle = "#fecaca";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(scaledCenterX + 100, scaledCenterY - 60, 15, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Draw LED label
    ctx.fillStyle = "#991b1b";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("LED", scaledCenterX + 100, scaledCenterY - 57);

    // Draw resistor (rectangle)
    ctx.strokeStyle = "#7c2d12";
    ctx.fillStyle = "#fed7aa";
    ctx.lineWidth = 2;
    ctx.fillRect(scaledCenterX + 70, scaledCenterY + 20, 40, 12);
    ctx.strokeRect(scaledCenterX + 70, scaledCenterY + 20, 40, 12);

    // Draw resistor bands
    ctx.strokeStyle = "#7c2d12";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(scaledCenterX + 75 + i * 8, scaledCenterY + 20);
      ctx.lineTo(scaledCenterX + 75 + i * 8, scaledCenterY + 32);
      ctx.stroke();
    }

    // Draw resistor label
    ctx.fillStyle = "#7c2d12";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText("220Ω", scaledCenterX + 90, scaledCenterY + 45);

    // Draw connecting wires
    ctx.strokeStyle = "#059669";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    // Wire from Arduino to LED
    ctx.beginPath();
    ctx.moveTo(scaledCenterX + 57, scaledCenterY - 30);
    ctx.lineTo(scaledCenterX + 85, scaledCenterY - 60);
    ctx.stroke();

    // Wire from LED to resistor
    ctx.beginPath();
    ctx.moveTo(scaledCenterX + 100, scaledCenterY - 45);
    ctx.lineTo(scaledCenterX + 90, scaledCenterY + 20);
    ctx.stroke();

    // Wire from resistor to Arduino
    ctx.beginPath();
    ctx.moveTo(scaledCenterX + 70, scaledCenterY + 26);
    ctx.lineTo(scaledCenterX + 57, scaledCenterY - 10);
    ctx.stroke();

    ctx.restore();
  }, [viewport]);

  // Animation loop
  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`cursor-crosshair ${className}`}
      style={{
        width: "100%",
        height: "100%",
        imageRendering: "pixelated", // Crisp grid lines
      }}
      {...interactions}
    />
  );
}
