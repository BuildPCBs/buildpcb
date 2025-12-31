"use client";

import * as fabric from "fabric";
import { supabase } from "@/lib/supabase";
import { canvasCommandManager } from "./canvas-command-manager";
import { logger } from "@/lib/logger";
import { refDesService } from "@/lib/refdes-service";
import type { KiCadComponent, SymbolData, Graphics } from "@/types/kicad";

// Define a type for the payload for better code quality and clarity
interface ComponentPayload {
  id: string;
  type: string;
  svgPath: string;
  name: string;
  databaseComponent?: KiCadComponent;
  x?: number;
  y?: number;
  preservedComponentId?: string; // For maintaining component IDs during restoration
}

let isComponentHandlerSetup = false;
let componentEventUnsubscribe: (() => void) | null = null;
// Removed isProcessingComponent - allowing concurrent component creation during restoration

// TODO: Migrate this entire file from Fabric.js to Konva
// This file still uses Fabric.js (fabric.Canvas, fabric.Group, fabric.Circle, etc.)
// Need to:
// 1. Replace Fabric imports with Konva imports
// 2. Convert fabric.Canvas → Konva.Stage + Konva.Layer
// 3. Convert Fabric objects (fabric.Group, fabric.Circle, fabric.Text) → Konva equivalents
// 4. Create Konva shapes directly from symbol_data (skip SVG generation for better performance)
// 5. Update event handlers to use Konva's event system
// Status: canvas-command-manager.ts already migrated to Konva ✅

// Generate SVG from component
function generateSvgFromSymbolData(component: KiCadComponent): string | null {
  logger.canvas("Generating SVG from component", { component: component.name });

  const symbolData = component.symbol_data;
  if (!symbolData || !symbolData.graphics) {
    logger.warn("Invalid symbol_data structure", { component: component.name });
    return null;
  }

  const graphics: Graphics = symbolData.graphics;
  let svgElements = "";
  let hasElements = false;

  // Add rectangles - EXACTLY matching index.html logic
  if (graphics.rectangles && Array.isArray(graphics.rectangles)) {
    graphics.rectangles.forEach((rect: any, index: number) => {
      if (rect && rect.start && rect.end) {
        // EXACT index.html logic:
        const x = rect.start.x;
        const y = rect.start.y;
        const width = Math.abs(rect.end.x - rect.start.x);
        const drawHeight = rect.end.y - rect.start.y; // Can be NEGATIVE like index.html

        const fill = rect.fill?.type === "background" ? "#f0f0f0" : "none";
        const stroke = rect.stroke?.type === "default" ? "#000" : "#000";
        const strokeWidth = rect.stroke?.width || 0.254;

        // For SVG: convert negative height to positive and adjust y
        const svgY = drawHeight < 0 ? y + drawHeight : y;
        const svgHeight = Math.abs(drawHeight);

        svgElements += `<rect x="${x}" y="${-svgY}" width="${width}" height="${svgHeight}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
        hasElements = true;
        console.log(
          `✅ Added rectangle ${index}: x=${x}, y=${y}, width=${width}, drawHeight=${drawHeight}`
        );
      }
    });
  }

  // Add circles - EXACTLY matching index.html logic
  if (graphics.circles && Array.isArray(graphics.circles)) {
    graphics.circles.forEach((circle: any, index: number) => {
      if (circle && circle.center && typeof circle.radius === "number") {
        const fill = circle.fill?.type === "background" ? "#f0f0f0" : "none";
        const stroke = circle.stroke?.type === "default" ? "#000" : "#000";
        const strokeWidth = circle.stroke?.width || 0.254;

        // EXACT index.html: ctx.arc(circle.center.x, circle.center.y, circle.radius, ...)
        // For SVG, we need to flip Y
        svgElements += `<circle cx="${circle.center.x}" cy="${-circle.center
          .y}" r="${
          circle.radius
        }" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
        hasElements = true;
        console.log(
          `✅ Added circle ${index}: cx=${circle.center.x}, cy=${circle.center.y}, r=${circle.radius}`
        );
      }
    });
  }

  // Add polylines - EXACTLY matching index.html logic
  if (graphics.polylines && Array.isArray(graphics.polylines)) {
    graphics.polylines.forEach((polyline: any, index: number) => {
      if (polyline && polyline.points && Array.isArray(polyline.points)) {
        // EXACT index.html: ctx.lineTo(polyline.points[i].x, polyline.points[i].y)
        // For SVG, flip Y coordinates
        const points = polyline.points
          .map((p: any) => `${p.x},${-p.y}`)
          .join(" ");
        const fill = polyline.fill?.type === "none" ? "none" : "none"; // index.html doesn't fill polylines
        const stroke = polyline.stroke?.type === "default" ? "#000" : "#000";
        const strokeWidth = polyline.stroke?.width || 0.254;

        svgElements += `<polyline points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
        hasElements = true;
        console.log(
          `✅ Added polyline ${index}: ${polyline.points.length} points`
        );
      }
    });
  }

  // Add pins as visual line elements - EXACTLY matching index.html logic
  if (symbolData.pins && Array.isArray(symbolData.pins)) {
    symbolData.pins.forEach((pin: any, index: number) => {
      if (!pin.position || pin.name === "Unused") return;

      // EXACT index.html logic
      const p_start = pin.position; // Connection point (outside)
      const p_len = pin.length || 2.54;
      let p_end = { x: p_start.x, y: p_start.y }; // Body point (inside)

      // Calculate pin end point based on angle - EXACT index.html switch statement
      switch (pin.position.angle) {
        case 0.0: // Left-side pins (extend right)
          p_end.x += p_len;
          break;
        case 180.0: // Right-side pins (extend left)
          p_end.x -= p_len;
          break;
        case 90.0: // Bottom-side pins (extend up in data coords)
          p_end.y += p_len;
          break;
        case 270.0: // Top-side pins (extend down in data coords)
          p_end.y -= p_len;
          break;
      }

      // Add pin line (flip Y coordinates for SVG since we don't have ctx.scale(1,-1))
      svgElements += `<line x1="${p_start.x}" y1="${-p_start.y}" x2="${
        p_end.x
      }" y2="${-p_end.y}" stroke="#000" stroke-width="0.152"/>`;

      // Add pin name text (if not "~") - matching index.html positioning
      if (pin.name !== "~") {
        let textX = p_end.x;
        let textY = p_end.y;
        let textAnchor = "middle";
        const PADDING = 0.5; // index.html constant

        switch (pin.position.angle) {
          case 0.0: // Left-side pins
            textX = p_end.x + PADDING;
            textAnchor = "left";
            break;
          case 180.0: // Right-side pins
            textX = p_end.x - PADDING;
            textAnchor = "right";
            break;
          case 90.0: // Bottom-side pins
            textX = p_end.x + PADDING;
            textY = p_end.y + PADDING * 3;
            break;
          case 270.0: // Top-side pins
            textX = p_end.x + PADDING;
            textY = p_end.y - PADDING * 3;
            break;
        }

        svgElements += `<text x="${textX}" y="${-textY}" font-size="1.0" fill="#00008B" text-anchor="${textAnchor}" dominant-baseline="middle">${
          pin.name
        }</text>`;
      }

      // Add pin number text - matching index.html positioning
      let numTextX = (p_start.x + p_end.x) / 2;
      let numTextY = p_start.y;
      const PADDING = 0.5;

      switch (pin.position.angle) {
        case 0.0: // Left-side pins
        case 180.0: // Right-side pins
          numTextY = p_start.y + PADDING * 2;
          break;
        case 90.0: // Bottom-side pins
        case 270.0: // Top-side pins
          numTextX = p_start.x + PADDING * 2;
          numTextY = (p_start.y + p_end.y) / 2;
          break;
      }

      svgElements += `<text x="${numTextX}" y="${-numTextY}" font-size="1.0" fill="#666" text-anchor="middle" dominant-baseline="middle">${
        pin.number
      }</text>`;

      hasElements = true;
      console.log(
        `✅ Added pin ${index}: ${pin.name} at (${p_start.x}, ${p_start.y}), angle=${pin.position.angle}`
      );
    });
  }

  // Add component fields (reference and value) - EXACTLY matching index.html logic
  if (component.fields) {
    const NAME_TEXT_SIZE = 1.5; // index.html constant
    const DESC_TEXT_SIZE = 2.0; // index.html constant

    // Draw reference field (component name/ID)
    if (component.fields.reference && component.fields.reference.position) {
      const refPos = component.fields.reference.position;
      const refValue = component.fields.reference.value || component.name;
      const refAngle = refPos.angle || 0;

      // EXACT index.html: ctx.translate(refPos.x, refPos.y) then ctx.rotate(angle) then drawText(0, 0)
      const refTransform = refAngle
        ? `transform="rotate(${refAngle} ${refPos.x} ${-refPos.y})"`
        : "";
      svgElements += `<text x="${
        refPos.x
      }" y="${-refPos.y}" font-size="${NAME_TEXT_SIZE}" fill="blue" text-anchor="center" dominant-baseline="middle" ${refTransform}>${refValue}</text>`;
      hasElements = true;
      logger.canvas(`Added reference field: ${refValue}`, { position: refPos });
    }

    // Draw value field (component value/description)
    if (component.fields.value && component.fields.value.position) {
      const valuePos = component.fields.value.position;
      const valueText = component.fields.value.value || component.name;
      const valueAngle = valuePos.angle || 0;

      // Only draw if different from reference to avoid duplication - EXACT index.html logic
      const refValue = component.fields.reference?.value || component.name;
      if (valueText !== refValue) {
        const valueTransform = valueAngle
          ? `transform="rotate(${valueAngle} ${valuePos.x} ${-valuePos.y})"`
          : "";
        svgElements += `<text x="${
          valuePos.x
        }" y="${-valuePos.y}" font-size="${DESC_TEXT_SIZE}" fill="green" text-anchor="center" dominant-baseline="middle" ${valueTransform}>${valueText}</text>`;
        hasElements = true;
        logger.canvas(`Added value field: ${valueText}`, {
          position: valuePos,
        });
      }
    }
  }

  if (!hasElements) {
    logger.warn("No valid graphics elements found in symbol_data");
    return null;
  }

  // Calculate viewBox
  const bounds = calculateBounds(
    symbolData.graphics,
    symbolData.pins,
    symbolData.graphics?.text,
    component.fields
  );
  if (bounds.width === 0 || bounds.height === 0) {
    logger.warn("Invalid bounds calculated", { bounds });
    // Fallback viewBox
    const viewBox = "-10 -10 20 20";
    return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`;
  }

  const viewBox = `${bounds.minX - 2} ${bounds.minY - 2} ${bounds.width + 4} ${
    bounds.height + 4
  }`;

  const result = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`;
  console.log(`✅ Generated SVG:`, result);
  return result;
}

// Calculate bounds of graphics elements - EXACTLY matching index.html fitToView logic
function calculateBounds(
  graphics: any,
  pins?: any[],
  textElements?: any[],
  fields?: any
) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let hasBounds = false;

  // Check rectangles - EXACT index.html logic
  if (graphics.rectangles && Array.isArray(graphics.rectangles)) {
    graphics.rectangles.forEach((rect: any) => {
      if (rect && rect.start && rect.end) {
        // index.html: Math.min(minX, rect.start.x, rect.end.x)
        minX = Math.min(minX, rect.start.x, rect.end.x);
        minY = Math.min(minY, rect.start.y, rect.end.y);
        maxX = Math.max(maxX, rect.start.x, rect.end.x);
        maxY = Math.max(maxY, rect.start.y, rect.end.y);
        hasBounds = true;
      }
    });
  }

  // Check circles - EXACT index.html logic
  if (graphics.circles && Array.isArray(graphics.circles)) {
    graphics.circles.forEach((circle: any) => {
      if (circle && circle.center && typeof circle.radius === "number") {
        // index.html uses original coordinates (no Y flip in bounds calculation)
        const cx = circle.center.x;
        const cy = circle.center.y;
        const r = circle.radius;
        minX = Math.min(minX, cx - r);
        minY = Math.min(minY, cy - r);
        maxX = Math.max(maxX, cx + r);
        maxY = Math.max(maxY, cy + r);
        hasBounds = true;
      }
    });
  }

  // Check polylines - EXACT index.html logic
  if (graphics.polylines && Array.isArray(graphics.polylines)) {
    graphics.polylines.forEach((polyline: any) => {
      if (polyline && polyline.points && Array.isArray(polyline.points)) {
        polyline.points.forEach((point: any) => {
          if (
            point &&
            typeof point.x === "number" &&
            typeof point.y === "number"
          ) {
            // index.html uses original coordinates
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
            hasBounds = true;
          }
        });
      }
    });
  }

  // Check pins - EXACT index.html logic
  if (pins && Array.isArray(pins)) {
    pins.forEach((pin: any) => {
      if (!pin.position) return;

      // Skip unused pins from bounds calculation
      if (pin.name === "Unused") return;

      const pos = pin.position;
      const length = pin.length || 2.54;

      // EXACT index.html calculation
      const endX =
        pos.x +
        (pin.position.angle === 0
          ? length
          : pin.position.angle === 180
          ? -length
          : 0);
      const endY =
        pos.y +
        (pin.position.angle === 90
          ? length
          : pin.position.angle === 270
          ? -length
          : 0);

      // index.html uses original coordinates
      minX = Math.min(minX, pos.x, endX);
      minY = Math.min(minY, pos.y, endY);
      maxX = Math.max(maxX, pos.x, endX);
      maxY = Math.max(maxY, pos.y, endY);
      hasBounds = true;
    });
  }

  // Check text elements - EXACT index.html logic
  if (textElements && Array.isArray(textElements)) {
    textElements.forEach((textElement: any) => {
      if (textElement.position && textElement.content) {
        // Estimate text bounds (rough approximation) - matching index.html
        const textWidth = textElement.content.length * 1.5;
        const textHeight = 2.5;

        const pos = textElement.position;
        const angle = pos.angle || 0;
        const angleRad = (angle * Math.PI) / 180;

        // Calculate corners of text bounding box
        const corners = [
          { x: -textWidth / 2, y: -textHeight / 2 },
          { x: textWidth / 2, y: -textHeight / 2 },
          { x: textWidth / 2, y: textHeight / 2 },
          { x: -textWidth / 2, y: textHeight / 2 },
        ];

        corners.forEach((corner) => {
          const rotatedX =
            corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad);
          const rotatedY =
            corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad);

          // index.html uses original coordinates (no Y flip)
          const worldX = pos.x + rotatedX;
          const worldY = pos.y + rotatedY;

          minX = Math.min(minX, worldX);
          minY = Math.min(minY, worldY);
          maxX = Math.max(maxX, worldX);
          maxY = Math.max(maxY, worldY);
        });
        hasBounds = true;
      }
    });
  }

  // Check component fields
  if (fields) {
    // Reference field
    if (fields.reference && fields.reference.position) {
      const pos = fields.reference.position;
      const textWidth = (fields.reference.value || "").length * 1.5;
      const textHeight = 1.5;
      minX = Math.min(minX, pos.x - textWidth / 2);
      minY = Math.min(minY, pos.y - textHeight / 2);
      maxX = Math.max(maxX, pos.x + textWidth / 2);
      maxY = Math.max(maxY, pos.y + textHeight / 2);
      hasBounds = true;
    }

    // Value field
    if (fields.value && fields.value.position) {
      const pos = fields.value.position;
      const textWidth = (fields.value.value || "").length * 2.0;
      const textHeight = 2.0;
      minX = Math.min(minX, pos.x - textWidth / 2);
      minY = Math.min(minY, pos.y - textHeight / 2);
      maxX = Math.max(maxX, pos.x + textWidth / 2);
      maxY = Math.max(maxY, pos.y + textHeight / 2);
      hasBounds = true;
    }
  }

  if (!hasBounds) {
    console.warn(`⚠️ No valid bounds found, using defaults`);
    return { minX: -10, minY: -10, width: 20, height: 20 };
  }

  // Now convert to SVG viewBox (Y-down)
  // SVG viewBox needs: x, y (top-left), width, height
  const width = maxX - minX;
  const height = maxY - minY;

  // For SVG: flip the Y-axis
  // Top in data coords (maxY) becomes top in SVG (-maxY)
  return {
    minX,
    minY: -maxY, // Flip Y: use negative of max Y
    width,
    height,
  };
}

export function setupComponentHandler(canvas: fabric.Canvas) {
  if ((canvas as any)._componentHandlersSetup) {
    logger.canvas(
      "Component handlers already set up for this canvas, skipping."
    );
    return;
  }
  (canvas as any)._componentHandlersSetup = true;

  logger.canvas("Setting up new SVG component handler...");

  // Clean up any previous event listeners to prevent duplicates
  if (componentEventUnsubscribe) {
    componentEventUnsubscribe();
  }

  componentEventUnsubscribe = canvasCommandManager.on(
    "component:add",
    async (payload: ComponentPayload) => {
      console.log(
        `🚀 COMPONENT HANDLER CALLED: ${payload.name}, preservedId: ${payload.preservedComponentId}`
      );

      try {
        // Remove global processing lock to allow concurrent component creation during restoration
        // This enables multiple components to be loaded simultaneously without blocking

        const currentCanvas = canvasCommandManager.getCanvas();
        if (!currentCanvas) {
          console.error("❌ ERROR: No active canvas available.");
          return;
        }

        console.log(
          `🎯 Component creation started: ${payload.name}, canvas instance: ${
            (currentCanvas as any)._id || "no-id"
          }, preservedId: ${payload.preservedComponentId}`
        );

        logger.canvas(
          `===== STARTING COMPONENT CREATION: ${payload.name} =====`
        );

        // Check if this is a temporary component ID (components without proper database uid)
        if (payload.id.startsWith("temp_")) {
          logger.canvas(
            `Skipping component creation for temporary ID: ${payload.id}`
          );
          console.error(
            `Cannot create component with temporary ID: ${payload.id}. This component is missing from the database.`
          );
          return;
        }

        try {
          // 1. Fetch component data from the database
          console.log(`🔍 Fetching component: ${payload.name}`);
          const { data: dbComponent, error: fetchError } = await supabase
            .from("components")
            .select(
              "id, name, library, description, datasheet, keywords, pin_count, symbol_data, footprint_filter, fields"
            )
            .eq("name", payload.name)
            .single();

          if (fetchError) {
            console.error(`❌ Database error for ${payload.name}:`, fetchError);
            throw new Error(`Component ${payload.name} not found in database`);
          }

          if (!dbComponent?.symbol_data) {
            console.error(
              `❌ No symbol_data for ${payload.name}:`,
              dbComponent
            );
            throw new Error(
              `No symbol_data found for component name: ${payload.name}`
            );
          }

          console.log(
            `✅ Found component data for ${payload.name}:`,
            dbComponent
          );

          // Generate SVG from component
          const svgString = generateSvgFromSymbolData(
            dbComponent as KiCadComponent
          );
          if (!svgString) {
            console.error(
              `❌ SVG generation failed for ${payload.name}, symbol_data:`,
              dbComponent.symbol_data
            );
            throw new Error(
              `Failed to generate SVG for component name: ${payload.name}`
            );
          }

          console.log(
            `✅ Generated SVG for ${payload.name}, length: ${svgString.length}`
          );

          // 2. Load the SVG string into Fabric.js objects
          console.log(
            `📦 Loading SVG for ${payload.name}, svgLength: ${svgString.length}`
          );
          // Clean the SVG string to remove namespace prefixes like 'ns0:'
          const cleanedSvgString = svgString
            .replace(/ns0:/g, "")
            .replace(/xmlns:ns0="[^"]+"/g, "");
          const svgLoadResult = await fabric.loadSVGFromString(
            cleanedSvgString
          );
          const allSvgObjects = svgLoadResult.objects;

          // Disable image smoothing on all SVG objects for crisp rendering at all zoom levels
          allSvgObjects.forEach((obj: any) => {
            if (obj) {
              obj.imageSmoothing = false;
              // If it's an image, ensure crisp rendering
              if (obj.type === "image") {
                obj.set({
                  imageSmoothing: false,
                  objectCaching: true,
                });
              }
            }
          });

          console.log(`📦 SVG loaded: ${allSvgObjects.length} objects created`);

          // 3. Get Pin Metadata from symbol_data
          let dbPins: any[] = [];
          try {
            if (dbComponent?.symbol_data) {
              // symbol_data should already be an object in the new schema
              const symbolData = dbComponent.symbol_data;
              dbPins = symbolData.pins || [];
            }
          } catch (error) {
            logger.canvas("Failed to parse symbol_data:", error);
          }

          // 4. Create Interactive Pins from the tagged SVG elements
          // Generate or use preserved component ID for wire connections
          // Use crypto.randomUUID() for guaranteed uniqueness instead of Date.now()
          const componentId =
            payload.preservedComponentId || `component_${crypto.randomUUID()}`;

          if (payload.preservedComponentId) {
            logger.canvas(
              `Using preserved component ID: ${payload.preservedComponentId}`
            );
          } else {
            logger.canvas(`Generated new component ID: ${componentId}`);
          }

          // 4b. Extract RefDes prefix from SVG and assign number (e.g., U? → U1)
          logger.canvas(
            `🔍 Attempting to extract RefDes from SVG for ${payload.name}`
          );

          const refdesPrefix = refDesService.getRefDesFromSVG(svgString);
          logger.canvas(`🏷️ Extracted prefix: ${refdesPrefix || "none"}`);

          let assignedRefDes: string | null = null;

          if (refdesPrefix) {
            assignedRefDes = refDesService.assignRefDes(
              componentId,
              refdesPrefix
            );
            logger.canvas(
              `✅ Assigned RefDes: ${assignedRefDes} to ${payload.name}`
            );

            // Find and update the RefDes text in the SVG, hide the stroked-text rendering
            logger.canvas(
              `🔍 Searching through ${allSvgObjects.length} SVG objects`
            );

            // Log ALL text elements to see what we have
            logger.canvas("📋 ALL text elements found:");
            allSvgObjects.forEach((obj: any, index: number) => {
              if (obj.type === "text" && obj.text) {
                logger.canvas(
                  `  [${index}] "${obj.text}" at (${obj.left}, ${obj.top}), visible=${obj.visible}, opacity=${obj.opacity}`
                );
              }
            });

            let updatedTextCount = 0;
            let hiddenPathCount = 0;
            let foundTextIndex = -1;
            let nextTextIndex = -1;

            // First pass: find the RefDes text and the next text element
            allSvgObjects.forEach((obj: any, index: number) => {
              if (obj.type === "text" && obj.text) {
                if (obj.text.includes("?") && foundTextIndex === -1) {
                  foundTextIndex = index;
                } else if (foundTextIndex !== -1 && nextTextIndex === -1) {
                  // This is the next text element after RefDes (e.g., "R_Variable_US")
                  nextTextIndex = index;
                }
              }
            });

            logger.canvas(
              `🔍 Text element positions: RefDes at ${foundTextIndex}, Next text at ${nextTextIndex}`
            );

            // Second pass: update RefDes and hide only its stroked-text paths
            allSvgObjects.forEach((obj: any, index: number) => {
              // Update the RefDes text element with "?"
              if (obj.type === "text" && obj.text && obj.text.includes("?")) {
                logger.canvas(
                  `📝 Found RefDes text at index ${index}: "${obj.text}"`
                );

                // Update the text content to our RefDes (R1, C1, etc.)
                obj.set({
                  text: assignedRefDes,
                  opacity: 1,
                  visible: true,
                  fill: "#006464",
                  stroke: "#006464",
                  strokeWidth: 0.1524,
                });
                updatedTextCount++;

                logger.canvas(`✅ Updated RefDes text to: "${assignedRefDes}"`);
              }

              // Hide ONLY path objects between RefDes text and next text element
              // This ensures we only hide "R?" paths, not "R_Variable_US" paths
              if (foundTextIndex !== -1 && obj.type === "path") {
                const shouldHide =
                  nextTextIndex !== -1
                    ? index > foundTextIndex && index < nextTextIndex // Hide paths between RefDes and component name
                    : index > foundTextIndex && index < foundTextIndex + 20; // Fallback: hide 20 paths if no next text

                if (shouldHide) {
                  obj.set({ visible: false, opacity: 0 });
                  hiddenPathCount++;
                }
              }
            });

            // If no RefDes text was found in the loaded SVG (outside viewBox),
            // create a new text object for the RefDes
            if (foundTextIndex === -1) {
              logger.canvas(
                `⚠️ RefDes text "${assignedRefDes}" not found in loaded SVG - creating new text object`
              );

              const refDesText = new fabric.Text(assignedRefDes, {
                left: 0,
                top: -5, // Position above the component
                fontSize: 12,
                fill: "#006464",
                stroke: "#006464",
                strokeWidth: 0.1,
                fontFamily: "Arial",
                selectable: false,
                evented: false,
              });

              allSvgObjects.push(refDesText);
              updatedTextCount++;
              logger.canvas(`✅ Created new RefDes text: "${assignedRefDes}"`);
            }

            logger.canvas(
              `📊 Updated ${updatedTextCount} text elements, hidden ${hiddenPathCount} stroked-text paths`
            );
          } else {
            logger.canvas(
              `⚠️ No RefDes prefix found in SVG for ${payload.name}`
            );
          }

          const interactivePins: fabric.Circle[] = [];

          // We also separate the main symbol parts from the pin markers
          const symbolParts: fabric.Object[] = [];

          // Create interactive pins from database pin data (not from SVG markers)
          dbPins.forEach((pin: any) => {
            if (!pin.position || pin.name === "Unused") return;

            // The connection point is at pin.position (the outer end of the pin line)
            const connectionPoint = pin.position;

            const interactivePin = new fabric.Circle({
              radius: 3, // Visual size of the connectable point
              fill: "rgba(0, 255, 0, 0.7)",
              stroke: "#059669",
              strokeWidth: 0.4,
              left: connectionPoint.x,
              top: connectionPoint.y,
              originX: "center",
              originY: "center",
              opacity: 0, // Hidden until mouse hover
              visible: false, // Initially not visible
            });

            interactivePin.set("data", {
              type: "pin",
              componentId: componentId,
              pinNumber: pin.number,
              pinName: pin.name || `Pin ${pin.number}`,
              electricalType: pin.electrical_type || "unknown",
              isConnectable: true,
            });

            interactivePins.push(interactivePin);
          });

          // Add all SVG objects to symbol parts (no pin markers to filter out)
          allSvgObjects.forEach((obj) => {
            if (obj) {
              symbolParts.push(obj);
            }
          });

          logger.canvas(
            `Created ${interactivePins.length} interactive pins for ${payload.name}.`
          );

          // 5. Position the final component on the canvas
          let { x: componentX, y: componentY } = payload;
          if (componentX === undefined || componentY === undefined) {
            const vpCenter = currentCanvas.getVpCenter();
            componentX = vpCenter.x;
            componentY = vpCenter.y;
          }

          // 6. Create the final "Component Sandwich" group
          // This group includes all original SVG parts plus our new interactive pins.
          // Fabric.js handles the internal coordinate system automatically.
          console.log(
            `🥪 Creating component group with ${symbolParts.length} symbol parts and ${interactivePins.length} pins`
          );

          const componentSandwich = new fabric.Group(
            [...symbolParts, ...interactivePins],
            {
              left: componentX,
              top: componentY,
              originX: "center",
              originY: "center",
              hasControls: false,
              hasBorders: true,
              lockScalingX: true,
              lockScalingY: true,
            }
          );

          console.log(
            `🥪 Component group created successfully, type: ${componentSandwich.type}`
          );

          // 7. Attach metadata and add the final object to the canvas
          console.log(
            `🏷️ Setting component data: componentId=${componentId}, componentName=${
              payload.name
            }, refDes=${assignedRefDes || "none"}`
          );
          componentSandwich.set("data", {
            type: "component",
            componentId: componentId,
            componentName: payload.name,
            refDes: assignedRefDes, // Store the assigned RefDes (U1, R1, etc.)
            isComponentSandwich: true,
            originalDatabaseId: payload.id, // Store the original database ID for serialization
          });

          // Set componentType as a direct property for canvas event handlers
          componentSandwich.set("componentType", "component");
          componentSandwich.set("id", componentId); // Set ID as direct property for reliable access

          // Set databaseComponent metadata - prefer payload.componentMetadata if available (from agent),
          // otherwise use the queried dbComponent (from manual component library)
          if ((payload as any).componentMetadata) {
            componentSandwich.set(
              "databaseComponent",
              (payload as any).componentMetadata
            );
            logger.canvas(
              `📋 Using component metadata from payload (agent-added)`
            );
          } else if (dbComponent) {
            componentSandwich.set("databaseComponent", dbComponent);
            logger.canvas(`📋 Using component metadata from database query`);
          }

          console.log(`➕ Adding component to canvas: ${componentId}`);
          currentCanvas.add(componentSandwich);
          console.log(
            `➕ Component added to canvas, canvas now has ${
              currentCanvas.getObjects().length
            } objects`
          );

          // 8. Add hover event handlers to show/hide pins
          console.log(`🎯 Setting up pin hover handlers for ${componentId}`);

          // Function to show pins on component hover
          const showPins = () => {
            if (!(currentCanvas as any).wireMode) return; // Only show pins in wire mode
            if (
              componentSandwich.lockMovementX ||
              componentSandwich.lockMovementY
            )
              return; // Don't show during drag
            interactivePins.forEach((pin) => {
              pin.set({
                visible: true,
                opacity: 1,
                evented: true,
              });
            });
            currentCanvas.renderAll();
          };

          // Function to hide pins when not hovering
          const hidePins = () => {
            if ((currentCanvas as any).wireMode) return; // Don't hide pins in wire mode
            interactivePins.forEach((pin) => {
              pin.set({
                visible: false,
                opacity: 0,
                evented: false,
              });
            });
            currentCanvas.renderAll();
          };

          // Add hover event handlers to the component group
          componentSandwich.on("mouseover", showPins);
          componentSandwich.on("mouseout", hidePins);

          // Hide pins when component starts moving
          componentSandwich.on("moving", () => {
            interactivePins.forEach((pin) => {
              pin.set({
                visible: false,
                opacity: 0,
                evented: false,
              });
            });
          });

          // Re-evaluate pin visibility when component stops moving
          componentSandwich.on("modified", () => {
            // Force pins to hidden state after move
            hidePins();
          });

          // Also add hover handlers to individual pins to keep them visible when hovering directly on pins
          interactivePins.forEach((pin) => {
            pin.on("mouseover", showPins);
            pin.on("mouseout", (e: any) => {
              // Only hide pins if mouse is not over the component group
              const pointer = currentCanvas.getPointer(e.e);
              const componentBounds = componentSandwich.getBoundingRect();
              const isOverComponent =
                pointer.x >= componentBounds.left &&
                pointer.x <= componentBounds.left + componentBounds.width &&
                pointer.y >= componentBounds.top &&
                pointer.y <= componentBounds.top + componentBounds.height;

              if (!isOverComponent) {
                hidePins();
              }
            });
          });

          // DEBUGGING: Verify the component was actually added and doesn't conflict
          const canvasObjects = currentCanvas.getObjects();
          const componentCount = canvasObjects.filter(
            (obj: any) => obj.data?.componentId
          ).length;
          const thisComponent = canvasObjects.find(
            (obj: any) => obj.data?.componentId === componentId
          );

          console.log(
            `🔍 Component added verification: ID=${componentId}, found=${!!thisComponent}, total components=${componentCount}`
          );
          console.log(`📊 Canvas state after adding ${componentId}:`, {
            totalObjects: canvasObjects.length,
            lastAddedObject: canvasObjects[canvasObjects.length - 1]?.type,
            lastAddedData: (canvasObjects[canvasObjects.length - 1] as any)
              ?.data,
            allComponentIds: canvasObjects
              .filter((obj: any) => obj.data?.componentId)
              .map((obj: any) => obj.data.componentId),
          });

          // Extra verification - check if component exists with different data structure
          const componentByType = canvasObjects.find(
            (obj: any) =>
              obj.data?.type === "component" &&
              obj.data?.componentId === componentId
          );
          console.log(`🔍 Component by type check: ${!!componentByType}`);

          currentCanvas.requestRenderAll();

          logger.canvas(`✅ Successfully added ${payload.name} to canvas.`);
        } catch (error) {
          console.error(
            `❌ CRITICAL ERROR in component handler for ${payload.name}:`,
            error
          );
          console.error(
            `❌ COMPONENT CREATION FAILED for ${payload.name}:`,
            error
          );
        } finally {
          // No longer needed: isProcessingComponent = false;
        }
      } catch (handlerError) {
        console.error(
          `❌ HANDLER-LEVEL ERROR for ${payload?.name || "unknown"}:`,
          handlerError
        );
        // No longer needed: isProcessingComponent = false;
      }
    }
  );

  console.log(`✅ Component handler registered successfully for canvas`);
  logger.canvas("✅ Component event listener registered successfully");

  // CRITICAL TEST: This log should ALWAYS appear
  console.log(
    `🔥 COMPONENTHANDLER: Handler setup completed - THIS LOG SHOULD ALWAYS APPEAR`
  );

  return () => {
    logger.canvas(
      "Cleaning up component event listener from setupComponentHandler."
    );
    if (componentEventUnsubscribe) {
      componentEventUnsubscribe();
      componentEventUnsubscribe = null;
    }
    isComponentHandlerSetup = false;
  };
}
