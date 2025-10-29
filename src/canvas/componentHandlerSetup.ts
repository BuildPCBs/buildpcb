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

// TODO: Remove this SVG generation - create Fabric objects directly from symbol_data
// This is a temporary solution until we fully convert to Konva.js

// Generate SVG from symbol_data
function generateSvgFromSymbolData(symbolData: any): string | null {
  console.log(`🔧 Generating SVG from symbol_data:`, symbolData);

  if (!symbolData || !symbolData.graphics) {
    console.warn(`⚠️ Invalid symbol_data structure:`, symbolData);
    return null;
  }

  const graphics = symbolData.graphics;
  let svgElements = "";
  let hasElements = false;

  // Add rectangles
  if (graphics.rectangles && Array.isArray(graphics.rectangles)) {
    graphics.rectangles.forEach((rect: any, index: number) => {
      if (rect && rect.start && rect.end) {
        const width = Math.abs(rect.end.x - rect.start.x);
        const height = Math.abs(rect.end.y - rect.start.y);
        const x = Math.min(rect.start.x, rect.end.x);
        const y = Math.min(rect.start.y, rect.end.y);
        const fill = rect.fill?.type === "background" ? "#f0f0f0" : "none";
        const stroke = rect.stroke?.type === "default" ? "#000" : "#000";
        const strokeWidth = rect.stroke?.width || 0.254;

        svgElements += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
        hasElements = true;
        console.log(`✅ Added rectangle ${index}:`, rect);
      }
    });
  }

  // Add circles
  if (graphics.circles && Array.isArray(graphics.circles)) {
    graphics.circles.forEach((circle: any, index: number) => {
      if (circle && circle.center && typeof circle.radius === "number") {
        const fill = circle.fill?.type === "background" ? "#f0f0f0" : "none";
        const stroke = circle.stroke?.type === "default" ? "#000" : "#000";
        const strokeWidth = circle.stroke?.width || 0.254;

        svgElements += `<circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
        hasElements = true;
        console.log(`✅ Added circle ${index}:`, circle);
      }
    });
  }

  // Add polylines
  if (graphics.polylines && Array.isArray(graphics.polylines)) {
    graphics.polylines.forEach((polyline: any, index: number) => {
      if (polyline && polyline.points && Array.isArray(polyline.points)) {
        const points = polyline.points
          .map((p: any) => `${p.x},${p.y}`)
          .join(" ");
        const fill = polyline.fill?.type === "none" ? "none" : "#000";
        const stroke = polyline.stroke?.type === "default" ? "#000" : "#000";
        const strokeWidth = polyline.stroke?.width || 0.254;

        svgElements += `<polyline points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
        hasElements = true;
        console.log(`✅ Added polyline ${index}:`, polyline);
      }
    });
  }

  if (!hasElements) {
    console.warn(`⚠️ No valid graphics elements found in symbol_data`);
    return null;
  }

  // Calculate viewBox
  const bounds = calculateBounds(symbolData.graphics);
  if (bounds.width === 0 || bounds.height === 0) {
    console.warn(`⚠️ Invalid bounds calculated:`, bounds);
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

// Calculate bounds of graphics elements
function calculateBounds(graphics: any) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let hasBounds = false;

  // Check rectangles
  if (graphics.rectangles && Array.isArray(graphics.rectangles)) {
    graphics.rectangles.forEach((rect: any) => {
      if (rect && rect.start && rect.end) {
        minX = Math.min(minX, rect.start.x, rect.end.x);
        minY = Math.min(minY, rect.start.y, rect.end.y);
        maxX = Math.max(maxX, rect.start.x, rect.end.x);
        maxY = Math.max(maxY, rect.start.y, rect.end.y);
        hasBounds = true;
      }
    });
  }

  // Check circles
  if (graphics.circles && Array.isArray(graphics.circles)) {
    graphics.circles.forEach((circle: any) => {
      if (circle && circle.center && typeof circle.radius === "number") {
        minX = Math.min(minX, circle.center.x - circle.radius);
        minY = Math.min(minY, circle.center.y - circle.radius);
        maxX = Math.max(maxX, circle.center.x + circle.radius);
        maxY = Math.max(maxY, circle.center.y + circle.radius);
        hasBounds = true;
      }
    });
  }

  // Check polylines
  if (graphics.polylines && Array.isArray(graphics.polylines)) {
    graphics.polylines.forEach((polyline: any) => {
      if (polyline && polyline.points && Array.isArray(polyline.points)) {
        polyline.points.forEach((point: any) => {
          if (
            point &&
            typeof point.x === "number" &&
            typeof point.y === "number"
          ) {
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

  if (!hasBounds) {
    console.warn(`⚠️ No valid bounds found, using defaults`);
    return { minX: -10, minY: -10, width: 20, height: 20 };
  }

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
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
          // 1. Fetch component's symbol_data from the database
          console.log(`🔍 Fetching component: ${payload.name}`);
          const { data: dbComponent, error: fetchError } = await supabase
            .from("components")
            .select("symbol_data")
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
            `✅ Found symbol_data for ${payload.name}:`,
            dbComponent.symbol_data
          );

          // Generate SVG from symbol_data
          const svgString = generateSvgFromSymbolData(dbComponent.symbol_data);
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
