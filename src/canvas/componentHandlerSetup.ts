"use client";

import * as fabric from "fabric";
import { supabase } from "@/lib/supabase";
import { canvasCommandManager } from "./canvas-command-manager";
import { logger } from "@/lib/logger";

// Define a type for the payload for better code quality and clarity
interface ComponentPayload {
  id: string;
  type: string;
  svgPath: string;
  name: string;
  databaseComponent?: any;
  x?: number;
  y?: number;
}

let isComponentHandlerSetup = false;
let componentEventUnsubscribe: (() => void) | null = null;
let isProcessingComponent = false;

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
      if (isProcessingComponent) {
        logger.canvas(`Processing is busy, skipping add for ${payload.name}`);
        return;
      }
      isProcessingComponent = true;

      const currentCanvas = canvasCommandManager.getCanvas();
      if (!currentCanvas) {
        console.error("❌ ERROR: No active canvas available.");
        isProcessingComponent = false;
        return;
      }

      logger.canvas(`===== STARTING COMPONENT CREATION: ${payload.name} =====`);

      // Check if this is a temporary component ID (components without proper database uid)
      if (payload.id.startsWith("temp_")) {
        logger.canvas(
          `Skipping component creation for temporary ID: ${payload.id}`
        );
        console.error(
          `Cannot create component with temporary ID: ${payload.id}. This component is missing from the database.`
        );
        isProcessingComponent = false;
        return;
      }

      try {
        // 1. Fetch component's SVG and pin configuration from the database
        const { data: dbComponent } = await supabase
          .from("components_v2")
          .select("symbol_svg, symbol_data")
          .eq("uid", payload.id)
          .single();

        const svgString = dbComponent?.symbol_svg;
        if (!svgString) {
          throw new Error(`No SVG found for component ID: ${payload.id}`);
        }

        // 2. Load the SVG string into Fabric.js objects
        const { objects: allSvgObjects } = await fabric.loadSVGFromString(
          svgString
        );

        // 3. Get Pin Metadata (name, type) from the database JSON
        let dbPins: any[] = [];
        try {
          if (dbComponent?.symbol_data) {
            let symbolData;
            if (typeof dbComponent.symbol_data === "string") {
              symbolData = JSON.parse(dbComponent.symbol_data);
            } else {
              // symbol_data is already an object
              symbolData = dbComponent.symbol_data;
            }
            dbPins = symbolData.pins || [];
          }
        } catch (error) {
          logger.canvas("Failed to parse symbol_data:", error);
        }

        // 4. Create Interactive Pins from the tagged SVG elements
        const componentId = `component_${Date.now()}`;
        const interactivePins: fabric.Circle[] = [];

        // We also separate the main symbol parts from the pin markers
        const symbolParts: fabric.Object[] = [];

        allSvgObjects.forEach((obj) => {
          // Check for the "signpost" ID added by the Python script
          // We cast `obj` to `any` to access the `id` property which is not in the default FabricObject type
          if (obj && (obj as any).id && (obj as any).id.startsWith("pin-")) {
            const pinNumber = (obj as any).id.split("-")[1];
            const pinDataFromDb =
              dbPins.find((p) => p.number === pinNumber) || {};

            // Debug: Log the pin object properties to understand its structure
            logger.canvas(`📍 DEBUG Pin ${pinNumber}:`, {
              type: obj.type,
              left: obj.left,
              top: obj.top,
              width: obj.width,
              height: obj.height,
              x1: (obj as any).x1,
              y1: (obj as any).y1,
              x2: (obj as any).x2,
              y2: (obj as any).y2,
              path: (obj as any).path,
            });

            // Calculate the proper pin connection point
            let connectionPoint: fabric.Point;

            if (obj.type === "line") {
              // For line objects, we want the endpoint that's furthest from component center
              const line = obj as fabric.Line;
              const point1 = new fabric.Point(line.x1 || 0, line.y1 || 0);
              const point2 = new fabric.Point(line.x2 || 0, line.y2 || 0);

              // For now, use x2,y2 as the connection point (typically the outer end)
              // TODO: We might need to determine which end is the "outer" end based on component bounds
              connectionPoint = point2;
              logger.canvas(
                `📍 Pin ${pinNumber} connection point: (${connectionPoint.x}, ${connectionPoint.y})`
              );
            } else {
              // Fallback to center point for non-line objects
              connectionPoint = obj.getCenterPoint();
              logger.canvas(
                `📍 Pin ${pinNumber} using center point: (${connectionPoint.x}, ${connectionPoint.y})`
              );
            }

            const interactivePin = new fabric.Circle({
              radius: 3, // Visual size of the connectable point
              fill: "rgba(0, 255, 0, 0.7)",
              stroke: "#059669",
              strokeWidth: 0.4,
              left: connectionPoint.x,
              top: connectionPoint.y,
              originX: "center",
              originY: "center",
              opacity: 1, // Make visible for debugging
              visible: true, // Make visible for debugging
            });

            interactivePin.set("data", {
              type: "pin",
              componentId: componentId,
              pinNumber: pinNumber,
              pinName: pinDataFromDb.name || `Pin ${pinNumber}`,
              electricalType: pinDataFromDb.electrical_type || "unknown",
              isConnectable: true,
            });

            interactivePins.push(interactivePin);

            // Hide the original SVG path for the pin line itself
            obj.visible = false;
          }

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

        // 7. Attach metadata and add the final object to the canvas
        componentSandwich.set("data", {
          type: "component",
          componentId: componentId,
          componentName: payload.name,
          isComponentSandwich: true,
          originalDatabaseId: payload.id, // Store the original database ID for serialization
        });

        // Set componentType as a direct property for canvas event handlers
        componentSandwich.set("componentType", "component");
        componentSandwich.set("id", componentId); // Set ID as direct property for reliable access

        if (dbComponent) {
          componentSandwich.set("databaseComponent", dbComponent);
        }

        currentCanvas.add(componentSandwich);
        currentCanvas.requestRenderAll();

        logger.canvas(`✅ Successfully added ${payload.name} to canvas.`);
      } catch (error) {
        console.error(
          `❌ COMPONENT CREATION FAILED for ${payload.name}:`,
          error
        );
      } finally {
        isProcessingComponent = false;
      }
    }
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
