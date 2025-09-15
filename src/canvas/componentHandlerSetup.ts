"use client";

import * as fabric from "fabric";
import { supabase } from "@/lib/supabase";
import { canvasCommandManager } from "./canvas-command-manager";
import { logger } from "@/lib/logger";

// SIMPLE COMPONENT HANDLER - Add this at the end
let isComponentHandlerSetup = false;
let componentEventUnsubscribe: (() => void) | null = null;
let isProcessingComponent = false; // Flag to prevent duplicate component creation

export function setupComponentHandler(canvas: fabric.Canvas) {
  // Use canvas instance ID to prevent duplicate setup for the same canvas
  const canvasElement = canvas.getElement();
  const canvasId = canvasElement?.id || `canvas-${Date.now()}`;

  if (canvasElement && !canvasElement.id) {
    canvasElement.id = canvasId;
  }

  // Clean up previous event listener if it exists
  if (componentEventUnsubscribe) {
    logger.canvas("Cleaning up previous component event listener");
    componentEventUnsubscribe();
    componentEventUnsubscribe = null;
  }

  // Check if this canvas already has component handlers set up
  if ((canvas as any)._componentHandlersSetup) {
    logger.canvas(
      "Component handlers already set up for this canvas, skipping..."
    );
    return;
  }

  logger.canvas("Setting up SVG component handler with fresh canvas...");

  // Mark this canvas as having handlers set up
  (canvas as any)._componentHandlersSetup = true;

  // Store the unsubscribe function for cleanup
  componentEventUnsubscribe = canvasCommandManager.on(
    "component:add",
    async (payload: {
      id: string;
      type: string;
      svgPath: string;
      name: string;
      category?: string;
      description?: string;
      manufacturer?: string;
      partNumber?: string;
      pinCount?: number;
      databaseComponent?: any;
      x?: number;
      y?: number;
    }) => {
      logger.canvas("Component command received for", payload.name);

      // New intelligent component creation logic with database metadata
      const createComponent = async (componentInfo: typeof payload) => {
        logger.canvas(
          `===== STARTING COMPONENT CREATION FOR ${componentInfo.name} =====`
        );

        // Prevent duplicate processing
        if (isProcessingComponent) {
          logger.canvas(
            `Component creation already in progress, skipping ${componentInfo.name}`
          );
          return;
        }

        isProcessingComponent = true;
        const currentCanvas = canvasCommandManager.getCanvas();
        if (!currentCanvas) {
          console.error(
            `❌ ERROR: No canvas available from command manager for component ${componentInfo.name}`
          );
          isProcessingComponent = false;
          return;
        }

        try {
          // Fetch full component data from database using the component ID
          logger.canvas(
            `Fetching database component data for ID: ${componentInfo.id}`
          );
          const { data: dbComponent, error: dbError } = await supabase
            .from("components")
            .select("*")
            .eq("id", componentInfo.id)
            .single();

          if (dbError) {
            logger.canvas(`Could not fetch database component data:`, dbError);
          } else if (dbComponent) {
            logger.canvas(`Retrieved full database component data.`);
            // Merge database data with provided info
            componentInfo = {
              ...componentInfo,
              category: dbComponent.category || componentInfo.category,
              description: dbComponent.description || componentInfo.description,
              manufacturer:
                dbComponent.manufacturer || componentInfo.manufacturer,
              partNumber: dbComponent.part_number || componentInfo.partNumber,
              pinCount:
                dbComponent.pin_configuration?.pins?.length ||
                componentInfo.pinCount,
              svgPath: dbComponent.symbol_svg
                ? `data:image/svg+xml;base64,${btoa(dbComponent.symbol_svg)}`
                : componentInfo.svgPath,
              databaseComponent: dbComponent,
            };
          }

          // Handle SVG loading
          let svgPromise: Promise<string>;
          if (componentInfo.svgPath.startsWith("data:image/svg+xml;base64,")) {
            const base64Data = componentInfo.svgPath.split(",")[1];
            const svgString = atob(base64Data);
            svgPromise = Promise.resolve(svgString);
          } else if (componentInfo.svgPath.startsWith("data:image/svg+xml")) {
            const urlData = componentInfo.svgPath.split(",")[1];
            const svgString = decodeURIComponent(urlData);
            svgPromise = Promise.resolve(svgString);
          } else {
            svgPromise = fetch(componentInfo.svgPath).then((response) => {
              if (!response.ok)
                throw new Error(
                  `HTTP ${response.status}: ${response.statusText}`
                );
              return response.text();
            });
          }

          svgPromise
            .then((svgString) => {
              logger.canvas(`SVG loaded (${svgString.length} chars)`);
              return fabric.loadSVGFromString(svgString);
            })
            .then((result) => {
              const objects = result.objects.filter((obj) => !!obj);
              const symbolParts: fabric.FabricObject[] = objects;

              // Extract pin and bbox data from the database component
              let dbPins: any[] = [];
              let componentBbox: any = null;
              try {
                const pinConfig =
                  componentInfo.databaseComponent?.pin_configuration;
                if (typeof pinConfig === "string") {
                  const parsedConfig = JSON.parse(pinConfig);
                  dbPins = parsedConfig.pins || [];
                  componentBbox = parsedConfig.bbox || null;
                } else if (pinConfig && typeof pinConfig === "object") {
                  dbPins = (pinConfig as any).pins || [];
                  componentBbox = (pinConfig as any).bbox || null;
                }
                logger.canvas(`Parsed pin configuration:`, {
                  parsedPins: dbPins.length,
                  hasBbox: !!componentBbox,
                });
              } catch (error) {
                logger.canvas(`Error parsing pin configuration:`, error);
              }

              // PIN COORDINATE TRANSFORMATION
              const MM_TO_PX = 3.78;
              const invisiblePinData = dbPins.map((dbPin: any) => {
                let bboxCenterX_mm = 0;
                let bboxCenterY_mm = 0;

                if (componentBbox) {
                  bboxCenterX_mm =
                    (componentBbox.minX + componentBbox.maxX) / 2;
                  bboxCenterY_mm =
                    (componentBbox.minY + componentBbox.maxY) / 2;
                }

                const adjustedX_mm = dbPin.x - bboxCenterX_mm;
                const adjustedY_mm = dbPin.y - bboxCenterY_mm;

                const pinX = adjustedX_mm * MM_TO_PX;
                // <<< FINAL FIX IS HERE: Removed the negative sign to prevent vertical flip
                const pinY = adjustedY_mm * MM_TO_PX;

                return {
                  originalX: pinX,
                  originalY: pinY,
                  pinId: `pin${dbPin.number}`,
                  pinNumber: dbPin.number,
                  pinName: dbPin.name || `Pin ${dbPin.number}`,
                  electricalType: dbPin.electrical_type || "unknown",
                  orientation: dbPin.orientation || -90,
                };
              });

              // Create the main component symbol
              const svgSymbol = new fabric.Group(symbolParts, {
                originX: "center",
                originY: "center",
              });

              // Nudge the symbol so its visual center is at the group's (0,0) origin
              const svgBounds = svgSymbol.getBoundingRect();
              const svgCenterX = svgBounds.left + svgBounds.width / 2;
              const svgCenterY = svgBounds.top + svgBounds.height / 2;
              svgSymbol.left = -svgCenterX;
              svgSymbol.top = -svgCenterY;

              // Create interactive pin objects
              const componentId = `component_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`;
              const interactivePins = invisiblePinData.map((pinInfo: any) => {
                const interactivePin = new fabric.Circle({
                  radius: 4,
                  fill: "rgba(0, 255, 0, 0.8)",
                  stroke: "#059669",
                  strokeWidth: 1,
                  left: pinInfo.originalX,
                  top: pinInfo.originalY,
                  originX: "center",
                  originY: "center",
                  opacity: 0,
                  visible: false,
                });

                interactivePin.set("data", {
                  type: "pin",
                  componentId: componentId,
                  pinId: pinInfo.pinId,
                  pinNumber: pinInfo.pinNumber,
                  pinName: pinInfo.pinName,
                  isConnectable: true,
                });
                return interactivePin;
              });

              // Position the component on the canvas
              let componentX = componentInfo.x;
              let componentY = componentInfo.y;
              if (componentX === undefined || componentY === undefined) {
                const vpCenter = currentCanvas.getVpCenter();
                componentX = vpCenter.x;
                componentY = vpCenter.y;
              }

              // Create the final "Component Sandwich" group
              const componentSandwich = new fabric.Group(
                [svgSymbol, ...interactivePins],
                {
                  left: componentX,
                  top: componentY,
                  originX: "center",
                  originY: "center",
                  hasControls: true,
                  hasBorders: true,
                }
              );

              // Attach metadata to the final group
              componentSandwich.set("data", {
                type: "component",
                componentId: componentId,
                componentName: componentInfo.name,
                isComponentSandwich: true,
              });

              if (componentInfo.databaseComponent) {
                componentSandwich.set(
                  "databaseComponent",
                  componentInfo.databaseComponent
                );
              }

              currentCanvas.add(componentSandwich);
              currentCanvas.renderAll();

              logger.canvas(
                `COMPONENT SANDWICH: Added ${componentInfo.name} with ${interactivePins.length} permanently attached pins!`
              );
              isProcessingComponent = false;
            })
            .catch((error) => {
              console.error(
                `❌ INTELLIGENT: Failed to load ${componentInfo.svgPath}:`,
                error
              );
              isProcessingComponent = false;
            });
        } catch (error) {
          console.error(
            `❌ COMPONENT CREATION: Failed to create component ${componentInfo.name}:`,
            error
          );
          isProcessingComponent = false;
        }
      };

      createComponent(payload);
    }
  );

  isComponentHandlerSetup = true;

  return () => {
    logger.canvas(
      "Cleaning up component event listener from setupComponentHandler"
    );
    if (componentEventUnsubscribe) {
      componentEventUnsubscribe();
      componentEventUnsubscribe = null;
    }
    isComponentHandlerSetup = false;
  };
}
