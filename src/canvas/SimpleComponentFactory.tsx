import React, { useState } from "react";
import { Rect, Circle, Text, Group, Line } from "react-konva";
import Konva from "konva";
import { logger } from "@/lib/logger";
import { Component } from "@/types";
import type {
  KiCadComponent,
  SymbolData,
  Graphics,
  Pin,
  Rectangle,
  Circle as KiCadCircle,
  Polyline,
  Arc,
  getComponentBounds,
} from "@/types/kicad";

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

    // Helper function matching index.html's getGraphicsColor
    const getGraphicsColor = (stroke: any, fill: any, elementType: string) => {
      const defaults = {
        stroke: "black",
        fill: elementType === "rectangle" ? "#FFFFE0" : "transparent",
      };

      if (fill && fill.type === "background") {
        return {
          stroke: stroke ? "black" : defaults.stroke,
          fill: elementType === "polyline" ? "transparent" : "#FFFFE0",
        };
      }

      if (fill && fill.type === "none") {
        return {
          stroke: stroke ? "black" : defaults.stroke,
          fill: "transparent",
        };
      }

      return {
        stroke: defaults.stroke,
        fill: defaults.fill,
      };
    };

    // Use raw KiCad coordinates (Y-flip at Group level)
    const toKonva = (x: number, y: number) => ({
      x: x * scale,
      y: y * scale,
    });

    // Render rectangles - EXACTLY matching index.html
    if (graphics.rectangles) {
      graphics.rectangles.forEach((rect, index) => {
        if (!rect.start || !rect.end) return;

        const width = Math.abs(rect.end.x - rect.start.x);
        const height = Math.abs(rect.end.y - rect.start.y);
        if (width <= 10.16 && height <= 10.16) return; // Skip small rectangles

        const x = rect.start.x;
        const y = rect.start.y;
        const drawHeight = rect.end.y - rect.start.y; // Can be negative

        const colors = getGraphicsColor(rect.stroke, rect.fill, "rectangle");
        const start = toKonva(x, y);
        const strokeWidth = rect.stroke ? rect.stroke.width || 0.254 : 0.254;

        const konvaRect = (
          <Rect
            key={`rect-${index}`}
            x={start.x}
            y={start.y}
            width={width * scale}
            height={drawHeight * scale}
            fill={colors.fill}
            stroke={colors.stroke}
            strokeWidth={strokeWidth * scale}
            cornerRadius={1.0 * scale}
          />
        );
        elements.push(konvaRect);
      });
    }

    // Render polylines - EXACTLY matching index.html
    if (graphics.polylines) {
      graphics.polylines.forEach((polyline, index) => {
        if (!polyline.points || polyline.points.length < 2) return;

        const colors = getGraphicsColor(
          polyline.stroke,
          polyline.fill,
          "polyline"
        );
        const strokeWidth = polyline.stroke
          ? polyline.stroke.width || 0.254
          : 0.254;

        const konvaPoints = polyline.points.flatMap((point) => {
          const konvaPoint = toKonva(point.x, point.y);
          return [konvaPoint.x, konvaPoint.y];
        });

        const konvaLine = (
          <Line
            key={`polyline-${index}`}
            points={konvaPoints}
            stroke={colors.stroke}
            strokeWidth={strokeWidth * scale}
            closed={false}
          />
        );
        elements.push(konvaLine);
      });
    }

    // Render circles - EXACTLY matching index.html
    if (graphics.circles) {
      graphics.circles.forEach((circle, index) => {
        if (!circle.center || !circle.radius) return;

        const colors = getGraphicsColor(circle.stroke, circle.fill, "circle");
        const center = toKonva(circle.center.x, circle.center.y);
        const strokeWidth = circle.stroke
          ? circle.stroke.width || 0.254
          : 0.254;

        const konvaCircle = (
          <Circle
            key={`circle-${index}`}
            x={center.x}
            y={center.y}
            radius={circle.radius * scale}
            fill={colors.fill !== "transparent" ? colors.fill : undefined}
            stroke={colors.stroke}
            strokeWidth={strokeWidth * scale}
          />
        );
        elements.push(konvaCircle);
      });
    }

    // Render arcs - handle both arc types (start/mid/end OR center/radius/angles)
    if (graphics.arcs) {
      graphics.arcs.forEach((arc: any, index) => {
        // Type 1: start/mid/end points (like index.html expects)
        if (arc.start && arc.mid && arc.end) {
          const colors = getGraphicsColor(arc.stroke, arc.fill, "arc");
          const strokeWidth = arc.stroke ? arc.stroke.width || 0.254 : 0.254;

          const start = toKonva(arc.start.x, arc.start.y);
          const mid = toKonva(arc.mid.x, arc.mid.y);
          const end = toKonva(arc.end.x, arc.end.y);

          const konvaArc = (
            <Line
              key={`arc-${index}`}
              points={[start.x, start.y, mid.x, mid.y, end.x, end.y]}
              stroke={colors.stroke}
              strokeWidth={strokeWidth * scale}
              tension={0.5}
              bezier={true}
            />
          );
          elements.push(konvaArc);
        }
        // Type 2: center/radius/angles
        else if (arc.center && arc.radius) {
          const colors = getGraphicsColor(arc.stroke, arc.fill, "arc");
          const strokeWidth = arc.stroke ? arc.stroke.width || 0.254 : 0.254;
          const center = toKonva(arc.center.x, arc.center.y);

          const points: number[] = [];
          const steps = 20;
          const startAngle = arc.startAngle || 0;
          const endAngle = arc.endAngle || 360;
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const angle = startAngle + (endAngle - startAngle) * t;
            const radians = (angle * Math.PI) / 180;
            const px = center.x + arc.radius * scale * Math.cos(radians);
            const py = center.y + arc.radius * scale * Math.sin(radians);
            points.push(px, py);
          }

          const konvaArc = (
            <Line
              key={`arc-${index}`}
              points={points}
              stroke={colors.stroke}
              strokeWidth={strokeWidth * scale}
            />
          );
          elements.push(konvaArc);
        }
      });
    }

    // Render text - handle both text and content properties
    if (graphics.text) {
      graphics.text.forEach((textElement: any, index) => {
        const content = textElement.content || textElement.text;
        if (!content || !textElement.position) return;

        const pos = textElement.position;
        const angle = pos.angle || textElement.rotation || 0;
        const position = toKonva(pos.x, pos.y);

        let hAlign: "left" | "center" | "right" = "center";
        let vAlign: "top" | "middle" | "bottom" = "middle";
        if (textElement.effects && textElement.effects.justify) {
          const justify = textElement.effects.justify.toLowerCase();
          if (justify.includes("left")) hAlign = "left";
          else if (justify.includes("right")) hAlign = "right";
          if (justify.includes("top")) vAlign = "top";
          else if (justify.includes("bottom")) vAlign = "bottom";
        }

        const konvaText = (
          <Text
            key={`text-${index}`}
            x={position.x}
            y={position.y}
            text={content}
            fontSize={(textElement.size || 2.0) * scale}
            rotation={angle}
            fontFamily="sans-serif"
            fill="black"
            align={hAlign}
            verticalAlign={vAlign}
            scaleY={-1}
          />
        );
        elements.push(konvaText);
      });
    }

    return elements;
  };

  const renderPins = () => {
    // Constants from index.html
    const PIN_TEXT_SIZE = 1.0;
    const PADDING = 0.5;

    // Use raw KiCad coordinates
    const toKonva = (x: number, y: number) => ({
      x: x * scale,
      y: y * scale,
    });

    // Get stroke width from rectangles like index.html does
    let strokeWidth = 0.152; // Default thinner width for pins
    if (
      component.symbol_data.graphics &&
      component.symbol_data.graphics.rectangles &&
      component.symbol_data.graphics.rectangles.length > 0 &&
      component.symbol_data.graphics.rectangles[0].stroke
    ) {
      strokeWidth = Math.min(
        component.symbol_data.graphics.rectangles[0].stroke.width,
        0.254
      );
    }

    return component.symbol_data.pins.map((pin) => {
      if (!pin.position) return null;
      if (pin.name === "Unused") return null;

      const p_start = pin.position;
      const p_len = pin.length;
      let p_end = { x: p_start.x, y: p_start.y };

      const startPos = toKonva(p_start.x, p_start.y);
      let pinNameElement = null;
      let pinNumberElement = null;

      // EXACTLY matching index.html switch statement
      switch (pin.position.angle) {
        case 0.0: // Left-side pins
          p_end.x += p_len;
          if (pin.name !== "~") {
            const namePos = toKonva(p_end.x + PADDING, p_end.y);
            pinNameElement = (
              <Text
                x={namePos.x}
                y={namePos.y}
                text={pin.name}
                fontSize={PIN_TEXT_SIZE * scale}
                fill="#00008B"
                fontFamily="sans-serif"
                align="left"
                verticalAlign="middle"
                scaleY={-1}
              />
            );
          }
          const numPos0 = toKonva(
            (p_start.x + p_end.x) / 2,
            p_start.y + PADDING * 2
          );
          pinNumberElement = (
            <Text
              x={numPos0.x}
              y={numPos0.y}
              text={pin.number}
              fontSize={PIN_TEXT_SIZE * scale}
              fill="#666"
              fontFamily="sans-serif"
              align="center"
              verticalAlign="top"
              scaleY={-1}
            />
          );
          break;

        case 180.0: // Right-side pins
          p_end.x -= p_len;
          if (pin.name !== "~") {
            const namePos = toKonva(p_end.x - PADDING, p_end.y);
            pinNameElement = (
              <Text
                x={namePos.x}
                y={namePos.y}
                text={pin.name}
                fontSize={PIN_TEXT_SIZE * scale}
                fill="#00008B"
                fontFamily="sans-serif"
                align="right"
                verticalAlign="middle"
                scaleY={-1}
              />
            );
          }
          const numPos180 = toKonva(
            (p_start.x + p_end.x) / 2,
            p_start.y + PADDING * 2
          );
          pinNumberElement = (
            <Text
              x={numPos180.x}
              y={numPos180.y}
              text={pin.number}
              fontSize={PIN_TEXT_SIZE * scale}
              fill="#666"
              fontFamily="sans-serif"
              align="center"
              verticalAlign="top"
              scaleY={-1}
            />
          );
          break;

        case 90.0: // Bottom-side pins
          p_end.y += p_len;
          if (pin.name !== "~") {
            const namePos = toKonva(p_end.x + PADDING, p_end.y + PADDING * 3);
            pinNameElement = (
              <Text
                x={namePos.x}
                y={namePos.y}
                text={pin.name}
                fontSize={PIN_TEXT_SIZE * scale}
                fill="#00008B"
                fontFamily="sans-serif"
                align="center"
                verticalAlign="middle"
                rotation={90}
                scaleY={-1}
              />
            );
          }
          const numPos90 = toKonva(
            p_start.x + PADDING * 2,
            (p_start.y + p_end.y) / 2
          );
          pinNumberElement = (
            <Text
              x={numPos90.x}
              y={numPos90.y}
              text={pin.number}
              fontSize={PIN_TEXT_SIZE * scale}
              fill="#666"
              fontFamily="sans-serif"
              align="center"
              verticalAlign="middle"
              rotation={90}
              scaleY={-1}
            />
          );
          break;

        case 270.0: // Top-side pins
          p_end.y -= p_len;
          if (pin.name !== "~") {
            const namePos = toKonva(p_end.x + PADDING, p_end.y - PADDING * 3);
            pinNameElement = (
              <Text
                x={namePos.x}
                y={namePos.y}
                text={pin.name}
                fontSize={PIN_TEXT_SIZE * scale}
                fill="#00008B"
                fontFamily="sans-serif"
                align="center"
                verticalAlign="middle"
                rotation={90}
                scaleY={-1}
              />
            );
          }
          const numPos270 = toKonva(
            p_start.x + PADDING * 2,
            (p_start.y + p_end.y) / 2
          );
          pinNumberElement = (
            <Text
              x={numPos270.x}
              y={numPos270.y}
              text={pin.number}
              fontSize={PIN_TEXT_SIZE * scale}
              fill="#666"
              fontFamily="sans-serif"
              align="center"
              verticalAlign="middle"
              rotation={90}
              scaleY={-1}
            />
          );
          break;
      }

      const endPos = toKonva(p_end.x, p_end.y);

      return (
        <Group key={`pin-group-${component.id}-${pin.number}`}>
          {/* Pin Line */}
          <Line
            points={[startPos.x, startPos.y, endPos.x, endPos.y]}
            stroke="black"
            strokeWidth={strokeWidth * scale}
          />

          {pinNameElement}
          {pinNumberElement}

          {/* Pin Hotspot */}
          <Circle
            x={startPos.x}
            y={startPos.y}
            radius={3}
            fill="rgba(0, 255, 0, 0.7)"
            stroke="#059669"
            strokeWidth={0.4}
            visible={showPins || isWireMode}
            // Store angle for smart wiring
            angle={pin.position.angle}
            onClick={() => handlePinClick(pin.number, startPos.x, startPos.y)}
            onMouseEnter={(e) => {
              if (isWireMode) {
                // Make pin larger and more visible on hover
                const circle = e.target as Konva.Circle;
                circle.radius(5);
                circle.fill("rgba(0, 255, 0, 0.9)");
                circle.strokeWidth(1);
                document.body.style.cursor = "crosshair";
              }
            }}
            onMouseLeave={(e) => {
              // Reset pin size
              const circle = e.target as Konva.Circle;
              circle.radius(3);
              circle.fill("rgba(0, 255, 0, 0.7)");
              circle.strokeWidth(0.4);
              document.body.style.cursor = isWireMode ? "crosshair" : "default";
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

  // Get dimensions for selection box (using raw coordinates now)
  const mainRect = component.symbol_data.graphics?.rectangles?.[0];

  const rectX = mainRect ? mainRect.start.x * scale : -50;
  const rectY = mainRect ? mainRect.start.y * scale : -50;
  const rectWidth = mainRect
    ? Math.abs(mainRect.end.x - mainRect.start.x) * scale
    : 100;
  const rectHeight = mainRect
    ? Math.abs(mainRect.end.y - mainRect.start.y) * scale
    : 100;

  return (
    <Group
      x={x}
      y={y}
      scaleY={-1} // Flip Y-axis to match index.html's ctx.scale(1, -1)
      draggable={!!onDragEnd && !isWireMode} // Only draggable if not in wire mode
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      onClick={onClick}
      // CRITICAL for Agent Discovery:
      name="component"
      id={component.id}
      componentName={component.componentName || component.name || "Unknown"}
      componentType={component.componentType || component.type || "component"}
      ref={(node) => {
        if (node) {
          (node as any).data = {
            componentId: component.id,
            componentName: component.name || "Unknown Component",
            componentType: component.type || "generic",
            uid: component.id,
          };
        }
      }}
    >
      {/* HIT AREA - Always present but invisible */}
      {/* This ensures users can click anywhere in the component bounds to select/drag it */}
      <Rect
        x={rectX}
        y={rectY}
        width={rectWidth}
        height={rectHeight}
        fill="transparent"
        stroke="transparent"
        strokeWidth={0}
        listening={true}
      />

      {/* Selection highlight (visual only) */}
      {isSelected && (
        <Rect
          x={rectX - scale * 0.5} // Position relative to the main rect
          y={rectY - scale * 0.5}
          width={rectWidth + scale} // Add padding
          height={rectHeight + scale}
          fill="transparent"
          stroke={isSelected ? "#0038DF" : "transparent"} // Blue highlight
          strokeWidth={scale * 0.3} // Visible border
          dash={[scale, scale]} // Dashed line style
          cornerRadius={2}
          listening={false} // Let the hit area handle events
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
