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
  preservedComponentId?: string; // For preserving component IDs during reload
}

let isComponentHandlerSetup = false;
let componentEventUnsubscribe: (() => void) | null = null;
// Remove the blocking flag - allow concurrent component processing
// let isProcessingComponent = false;

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
      // Remove blocking check - allow concurrent processing
      const currentCanvas = canvasCommandManager.getCanvas();
      if (!currentCanvas) {
        console.error("❌ ERROR: No active canvas available.");
        return;
      }

      logger.canvas(`===== STARTING COMPONENT CREATION: ${payload.name} =====`);

      // Check for duplicate components on canvas
      const existingComponents = currentCanvas.getObjects().filter((obj) => {
        const objData = (obj as any).data;
        return (
          objData?.type === "component" &&
          (objData?.originalDatabaseId === payload.id ||
            objData?.componentId === payload.preservedComponentId)
        );
      });

      if (existingComponents.length > 0) {
        logger.canvas(
          `🚫 Component already exists on canvas: ${payload.name} (${payload.id}), skipping duplicate`
        );
        logger.canvas(
          `Found ${existingComponents.length} existing component(s) with same ID`
        );
        return;
      }

      // Log current canvas state for debugging
      const totalObjects = currentCanvas.getObjects().length;
      const componentObjects = currentCanvas
        .getObjects()
        .filter((obj) => (obj as any).data?.type === "component").length;
      logger.canvas(
        `📊 Canvas state: ${totalObjects} total objects, ${componentObjects} components before adding ${payload.name}`
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
        // 1. Fetch component's SVG and pin configuration from the database with timeout
        const fetchPromise = supabase
          .from("components_v2")
          .select("symbol_svg, symbol_data")
          .eq("uid", payload.id)
          .single();

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`Database fetch timeout for component ${payload.id}`)
              ),
            8000
          )
        );

        const { data: dbComponent } = await Promise.race([
          fetchPromise,
          timeoutPromise,
        ]);

        const svgString = dbComponent?.symbol_svg;
        if (!svgString) {
          throw new Error(`No SVG found for component ID: ${payload.id}`);
        }

        // 2. Load the SVG string into Fabric.js objects with timeout
        const svgLoadPromise = fabric.loadSVGFromString(svgString);
        const svgTimeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`SVG loading timeout for component ${payload.name}`)
              ),
            5000
          )
        );

        const { objects: allSvgObjects } = await Promise.race([
          svgLoadPromise,
          svgTimeoutPromise,
        ]);

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
        // Use preserved component ID if available, otherwise generate new one
        const componentId =
          payload.preservedComponentId ||
          `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        if (payload.preservedComponentId) {
          logger.canvas(
            `🔗 Using preserved component ID: ${componentId} for ${payload.name}`
          );
        } else {
          logger.canvas(
            `🆕 Generated new component ID: ${componentId} for ${payload.name}`
          );
        }

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

            const center = obj.getCenterPoint();

            const interactivePin = new fabric.Circle({
              radius: 3, // Visual size of the connectable point
              fill: "rgba(0, 255, 0, 0.7)",
              stroke: "#059669",
              strokeWidth: 0.4,
              left: center.x,
              top: center.y,
              originX: "center",
              originY: "center",
              opacity: 0, // Hidden until mouse hover
              visible: false, // Initially not visible
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

        // Log final canvas state
        const finalTotalObjects = currentCanvas.getObjects().length;
        const finalComponentObjects = currentCanvas
          .getObjects()
          .filter((obj) => (obj as any).data?.type === "component").length;
        logger.canvas(
          `📊 Canvas state after adding: ${finalTotalObjects} total objects, ${finalComponentObjects} components`
        );

        logger.canvas(
          `✅ Successfully added ${payload.name} to canvas with ID ${componentId}.`
        );
      } catch (error) {
        console.error(
          `❌ COMPONENT CREATION FAILED for ${payload.name}:`,
          error
        );
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
