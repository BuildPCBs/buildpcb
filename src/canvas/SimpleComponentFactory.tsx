import React, { useState } from "react";
import { Rect, Circle, Text, Group, Line } from "react-konva";
import Konva from "konva";
import { logger } from "@/lib/logger";
import { Component } from "@/types";

// Component factory that creates Konva components from database symbol_data
export const SimpleComponent: React.FC<{
  component: Component;
  x: number;
  y: number;
  scale?: number;
  showPins?: boolean;
  onDragEnd?: (componentId: string, newPos: { x: number; y: number }) => void;
  onDragMove?: (componentId: string, newPos: { x: number; y: number }) => void;
  onPinClick?: (pinNumber: string, pinX: number, pinY: number) => void;
  isWireMode?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}> = ({
  component,
  x,
  y,
  scale = 10,
  showPins = false, // 'showPins' now controls the clickable hotspot
  onDragEnd,
  onDragMove,
  onPinClick,
  isWireMode = false,
  isSelected = false,
  onClick,
}) => {
  const handlePinClick = (pinNumber: string, pinX: number, pinY: number) => {
    if (onPinClick) {
      onPinClick(pinNumber, pinX, pinY);
    }
  };

  const renderGraphics = () => {
    const elements: React.JSX.Element[] = [];
    const graphics = component.symbol_data.graphics;

    // KiCad to Konva coordinate transformation (centered)
    // Get component bounds to center it
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    // Calculate bounds from all graphics elements
    if (graphics.rectangles) {
      graphics.rectangles.forEach((rect) => {
        minX = Math.min(minX, rect.start.x, rect.end.x);
        maxX = Math.max(maxX, rect.start.x, rect.end.x);
        minY = Math.min(minY, rect.start.y, rect.end.y);
        maxY = Math.max(maxY, rect.start.y, rect.end.y);
      });
    }
    if (graphics.polylines) {
      graphics.polylines.forEach((polyline) => {
        polyline.points.forEach((point) => {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        });
      });
    }

    // Default bounds if no graphics
    if (minX === Infinity) {
      minX = -5;
      maxX = 5;
      minY = -5;
      maxY = 5;
    }

    // Center offsets (assuming a reasonable display size)
    const displayWidth = 200; // Reasonable display width
    const displayHeight = 150; // Reasonable display height
    const offsetX = displayWidth / 2;
    const offsetY = displayHeight / 2;

    const toKonva = (x: number, y: number) => ({
      x: offsetX + x * scale,
      y: offsetY - y * scale, // Flip Y axis
    });

    // Render rectangles (package outlines)
    if (graphics.rectangles) {
      graphics.rectangles.forEach((rect, index) => {
        const start = toKonva(rect.start.x, rect.start.y);
        const end = toKonva(rect.end.x, rect.end.y);

        const konvaRect = (
          <Rect
            key={`rect-${index}`}
            x={Math.min(start.x, end.x)}
            y={Math.min(start.y, end.y)}
            width={Math.abs(end.x - start.x)}
            height={Math.abs(end.y - start.y)}
            fill={rect.fill?.type === "background" ? "#f0f0f0" : "transparent"}
            stroke="#000000"
            strokeWidth={0.254 * scale * 0.5}
          />
        );
        elements.push(konvaRect);
      });
    }

    // Render circles
    if (graphics.circles) {
      graphics.circles.forEach((circle, index) => {
        const center = toKonva(circle.center.x, circle.center.y);

        const konvaCircle = (
          <Circle
            key={`circle-${index}`}
            x={center.x}
            y={center.y}
            radius={circle.radius * scale}
            fill={
              circle.fill?.type === "background" ? "#f0f0f0" : "transparent"
            }
            stroke="#000000"
            strokeWidth={0.254 * scale * 0.5}
          />
        );
        elements.push(konvaCircle);
      });
    }

    // Render polylines (logic symbols like NOR gates - open shapes)
    if (graphics.polylines) {
      graphics.polylines.forEach((polyline, index) => {
        // Convert each point from KiCad to Konva coordinates
        const konvaPoints = polyline.points.flatMap((point) => {
          const konvaPoint = toKonva(point.x, point.y);
          return [konvaPoint.x, konvaPoint.y];
        });

        const konvaLine = (
          <Line
            key={`polyline-${index}`}
            points={konvaPoints}
            stroke="#000000"
            strokeWidth={0.254 * scale * 0.5}
            closed={false} // NOR gates and logic symbols are open shapes
          />
        );
        elements.push(konvaLine);
      });
    }

    // Render text (component labels inside symbols)
    if (graphics.text) {
      graphics.text.forEach((textItem, index) => {
        const position = toKonva(textItem.position.x, textItem.position.y);

        const konvaText = (
          <Text
            key={`text-${index}`}
            x={position.x}
            y={position.y}
            text={textItem.text}
            fontSize={(textItem.size || 1.27) * scale}
            rotation={textItem.rotation || 0}
            fontFamily="DM Sans" // Apply DM Sans font to graphics text
            fill="#000000"
            align="center"
            verticalAlign="middle"
          />
        );
        elements.push(konvaText);
      });
    }

    return elements;
  };

  const renderPins = () => {
    // Use same coordinate transformation as graphics
    const displayWidth = 200;
    const displayHeight = 150;
    const offsetX = displayWidth / 2;
    const offsetY = displayHeight / 2;

    const toKonva = (x: number, y: number) => ({
      x: offsetX + x * scale,
      y: offsetY - y * scale,
    });

    return component.symbol_data.pins.map((pin) => {
      const pos = toKonva(pin.position.x, pin.position.y);
      const length = pin.length * scale;
      const angle = ((pin.position.angle || 0) * Math.PI) / 180;

      // Calculate pin line end point (extends outward from pin position)
      const endX = pos.x + length * Math.cos(angle);
      const endY = pos.y - length * Math.sin(angle);

      // Pin number label (at end of pin line)
      const pinNumberX = endX + 8;
      const pinNumberY = endY - 5;

      // Pin name label (near pin position)
      const nameOffset = 12;
      const nameX = pos.x - nameOffset * Math.cos(angle);
      const nameY = pos.y + nameOffset * Math.sin(angle);

      return (
        <Group key={`pin-group-${component.id}-${pin.number}`}>
          {/* Pin Line */}
          <Line
            points={[pos.x, pos.y, endX, endY]}
            stroke="#000000"
            strokeWidth={1}
          />
          {/* Pin Number (at end of line) */}
          <Text
            x={pinNumberX}
            y={pinNumberY}
            text={pin.number}
            fontSize={10}
            fill="#000000"
            fontFamily="DM Sans"
          />
          {/* Pin Name (near pin position) */}
          <Text
            x={nameX}
            y={nameY}
            text={pin.name}
            fontSize={10}
            fill="#000000"
            fontFamily="DM Sans"
          />
          {/* Pin Hotspot (Clickable Circle) */}
          <Circle
            x={pos.x}
            y={pos.y}
            radius={scale * 0.4}
            fill="#10B981"
            stroke="#059669"
            strokeWidth={1}
            visible={showPins || isWireMode}
            onClick={() => handlePinClick(pin.number, pos.x, pos.y)}
            onMouseEnter={() => {
              if (isWireMode) {
                document.body.style.cursor = "crosshair";
              }
            }}
            onMouseLeave={() => {
              document.body.style.cursor = "default";
            }}
            name={`pin-${pin.number}`}
            ref={(node) => {
              if (node) {
                (node as any).data = { pinNumber: pin.number };
              }
            }}
          />
        </Group>
      );
    });
  };

  const handleDragEnd = (e: any) => {
    if (onDragEnd) {
      const newPos = { x: e.target.x(), y: e.target.y() };
      onDragEnd(component.id, newPos);
    }
  };

  const handleDragMove = (e: any) => {
    if (onDragMove) {
      const newPos = { x: e.target.x(), y: e.target.y() };
      onDragMove(component.id, newPos);
    }
  };

  // Get dimensions for selection box (using centered coordinates)
  const mainRect = component.symbol_data.graphics?.rectangles?.[0];
  const displayWidth = 200;
  const displayHeight = 150;
  const offsetX = displayWidth / 2;
  const offsetY = displayHeight / 2;

  const rectX = mainRect
    ? offsetX + Math.min(mainRect.start.x, mainRect.end.x) * scale
    : offsetX - 10 * scale;
  const rectY = mainRect
    ? offsetY - Math.max(mainRect.start.y, mainRect.end.y) * scale // Note: Y is flipped
    : offsetY - 10 * scale;
  const rectWidth = mainRect
    ? Math.abs(mainRect.end.x - mainRect.start.x) * scale
    : 20 * scale;
  const rectHeight = mainRect
    ? Math.abs(mainRect.end.y - mainRect.start.y) * scale
    : 20 * scale;

  return (
    <Group
      x={x}
      y={y}
      draggable={!!onDragEnd && !isWireMode} // Only draggable if not in wire mode
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      onClick={onClick}
      ref={(node) => {
        if (node) {
          (node as any).data = { componentId: component.id };
        }
      }}
    >
      {/* Selection highlight (invisible for easier dragging) */}
      {isSelected && (
        <Rect
          x={rectX - scale * 0.5} // Position relative to the main rect
          y={rectY - scale * 0.5}
          width={rectWidth + scale} // Add padding
          height={rectHeight + scale}
          fill="transparent" // Make invisible
          stroke="transparent" // Make invisible
          strokeWidth={0} // No border
          cornerRadius={2}
        />
      )}
      {renderGraphics()}
      {renderPins()}
    </Group>
  );
};

// Function to create simple component data for serialization
export const createSimpleComponentData = (componentInfo: {
  type: string;
  svgPath: string;
  name: string;
  x?: number;
  y?: number;
  id?: string;
}) => {
  const componentId = componentInfo.id || `component_${Date.now()}`;
  return {
    id: componentId,
    type: "component",
    componentType: componentInfo.type,
    componentName: componentInfo.name,
    x: componentInfo.x || 100,
    y: componentInfo.y || 100,
  };
};
