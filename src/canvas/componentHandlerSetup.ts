"use client";

import * as fabric from "fabric";
import { supabase } from "@/lib/supabase";
import { canvasCommandManager } from "./canvas-command-manager";
import { logger } from "@/lib/logger";
import { refDesService } from "@/lib/refdes-service";

// Define a type for the payload for better code quality and clarity
interface ComponentPayload {
  id: string;
  type: string;
  svgPath: string;
  name: string;
  databaseComponent?: any;
  x?: number;
  y?: number;
  preservedComponentId?: string; // For maintaining component IDs during restoration
}

let isComponentHandlerSetup = false;
let componentEventUnsubscribe: (() => void) | null = null;
// Removed isProcessingComponent - allowing concurrent component creation during restoration

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
          // 1. Fetch component's SVG and pin configuration from the database
          const { data: dbComponent } = await supabase
            .from("components_v2")
            .select("symbol_svg, symbol_data")
            .eq("name", payload.name)
            .single();

          let svgString = dbComponent?.symbol_svg;
          if (!svgString) {
            throw new Error(`No SVG found for component name: ${payload.name}`);
          }

          // 2. Load the SVG string into Fabric.js objects
          console.log(
            `📦 Loading SVG for ${payload.name}, svgLength: ${svgString.length}`
          );
          const svgLoadResult = await fabric.loadSVGFromString(svgString);
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
          // Generate or use preserved component ID for wire connections
          const componentId =
            payload.preservedComponentId || `component_${Date.now()}`;

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

            // Find and update the existing text element (make it visible and change text)
            logger.canvas(
              `🔍 Searching through ${allSvgObjects.length} SVG objects`
            );

            let refDesTextObj: any = null;
            allSvgObjects.forEach((obj: any, index: number) => {
              logger.canvas(
                `Object ${index}: type=${obj.type}, text="${obj.text}", opacity=${obj.opacity}`
              );

              if (obj.type === "text" && obj.text && obj.text.includes("?")) {
                refDesTextObj = obj;
                logger.canvas(
                  `📝 Found RefDes text at index ${index}: (${obj.left}, ${obj.top}), opacity: ${obj.opacity}, fontSize: ${obj.fontSize}`
                );

                // Update the text and make it visible
                obj.set({
                  text: assignedRefDes,
                  opacity: 1,
                  fill: "#000080",
                  fontWeight: "bold",
                  visible: true,
                });

                logger.canvas(
                  `✅ Updated text object to: "${obj.text}", opacity: ${obj.opacity}`
                );
              }
            });

            if (!refDesTextObj) {
              logger.canvas(
                `❌ ERROR: Could not find any text element with "?" in ${allSvgObjects.length} objects`
              );
            }
          } else {
            logger.canvas(
              `⚠️ No RefDes prefix found in SVG for ${payload.name}`
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
