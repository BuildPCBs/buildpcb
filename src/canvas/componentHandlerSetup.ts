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
      logger.canvas("Full payload:", payload);
      logger.canvas("SVG path length:", payload.svgPath?.length);
      logger.canvas(
        "SVG path preview:",
        payload.svgPath?.substring(0, 200) + "..."
      );

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
          return;
        }

        try {
          // Fetch full component data from database using the component ID
          console.log(
            `🔍 Fetching database component data for ID: ${componentInfo.id}`
          );
          const { data: dbComponent, error: dbError } = await supabase
            .from("components")
            .select("*")
            .eq("id", componentInfo.id)
            .single();

          if (dbError) {
            logger.canvas(`Could not fetch database component data:`, dbError);
            logger.canvas(`Proceeding with provided component info only`);
          } else if (dbComponent) {
            logger.canvas(`Retrieved full database component data:`, {
              name: dbComponent.name,
              manufacturer: dbComponent.manufacturer,
              partNumber: dbComponent.part_number,
              category: dbComponent.category,
              hasPins: dbComponent.pin_configuration ? "checking..." : false,
              pinConfigKeys:
                typeof dbComponent.pin_configuration === "string"
                  ? "JSON string"
                  : Object.keys(dbComponent.pin_configuration || {}),
              pinConfigType: typeof dbComponent.pin_configuration,
              pinConfigSample:
                typeof dbComponent.pin_configuration === "string"
                  ? (() => {
                      try {
                        return (
                          JSON.parse(dbComponent.pin_configuration).pins?.[0] ||
                          "parse error"
                        );
                      } catch (e) {
                        return "invalid json";
                      }
                    })()
                  : dbComponent.pin_configuration?.pins?.[0] || "no pins",
            });

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
              // Use database SVG if available, otherwise keep the provided svgPath
              svgPath: dbComponent.symbol_svg
                ? `data:image/svg+xml;base64,${btoa(dbComponent.symbol_svg)}`
                : componentInfo.svgPath,
              // Store full database component for later use
              databaseComponent: dbComponent,
            };
          }

          // Check for duplicate components at the same position (more lenient)
          const existingComponents = currentCanvas
            .getObjects()
            .filter(
              (obj: any) =>
                obj.data?.componentName === componentInfo.name &&
                obj.data?.componentType === componentInfo.type &&
                Math.abs((obj.left || 0) - (componentInfo.x || 0)) < 5 &&
                Math.abs((obj.top || 0) - (componentInfo.y || 0)) < 5
            );

          if (existingComponents.length > 0) {
            logger.canvas(
              `Very similar component detected for ${componentInfo.name} at same position, skipping creation`
            );
            isProcessingComponent = false; // Reset flag since we're not processing
            return;
          }

          logger.canvas(`Using current canvas from command manager`);
          logger.canvas(`Canvas exists: ${!!currentCanvas}`);
          logger.canvas(`Canvas width: ${currentCanvas.width}`);
          logger.canvas(`Canvas height: ${currentCanvas.height}`);
          logger.canvas(
            `Canvas objects count: ${currentCanvas.getObjects().length}`
          );
          logger.canvas(`Canvas disposed: ${currentCanvas.disposed || false}`);

          // Additional canvas validation
          if (currentCanvas.disposed) {
            console.error(
              `❌ ERROR: Current canvas is disposed when creating component ${componentInfo.name}`
            );
            return;
          }

          if (!currentCanvas.getElement()) {
            console.error(
              `❌ ERROR: Current canvas element is not available when creating component ${componentInfo.name}`
            );
            return;
          }

          // Handle SVG loading - support both URLs and data URLs
          let svgPromise: Promise<string>;

          if (componentInfo.svgPath.startsWith("data:image/svg+xml;base64,")) {
            // Handle data URL - extract SVG content directly
            const base64Data = componentInfo.svgPath.split(",")[1];
            const svgString = atob(base64Data);
            svgPromise = Promise.resolve(svgString);
            console.log(
              `SVG extracted from data URL (${svgString.length} chars)`
            );
            logger.canvas(`SVG preview:`, svgString.substring(0, 200) + "...");
          } else if (componentInfo.svgPath.startsWith("data:image/svg+xml")) {
            // Handle URL-encoded data URL
            const urlData = componentInfo.svgPath.split(",")[1];
            const svgString = decodeURIComponent(urlData);
            svgPromise = Promise.resolve(svgString);
            logger.canvas(
              `SVG extracted from URL-encoded data URL (${svgString.length} chars)`
            );
            logger.canvas(`SVG preview:`, svgString.substring(0, 200) + "...");
          } else {
            // Handle regular URL - fetch from server
            logger.canvas(`Fetching SVG from URL: ${componentInfo.svgPath}`);
            svgPromise = fetch(componentInfo.svgPath).then((response) => {
              console.log(
                `📄 Fetch response: ${response.status} ${response.statusText}`
              );
              if (!response.ok) {
                throw new Error(
                  `HTTP ${response.status}: ${response.statusText}`
                );
              }
              return response.text();
            });
            console.log(`📄 SVG fetched from URL: ${componentInfo.svgPath}`);
          }

          svgPromise
            .then((svgString) => {
              console.log(`📄 SVG loaded (${svgString.length} chars)`);
              console.log(
                `📄 SVG content preview:`,
                svgString.substring(0, 300) + "..."
              );
              return fabric.loadSVGFromString(svgString);
            })
            .then((result) => {
              console.log(`🔍 Fabric loadSVGFromString result:`, result);
              const objects = result.objects.filter((obj) => !!obj);
              console.log(`🔍 Parsed ${objects.length} SVG objects`);
              console.log(
                `🔍 Objects details:`,
                objects.map((obj, i) => ({
                  index: i,
                  type: obj.type,
                  visible: obj.visible,
                  width: obj.width,
                  height: obj.height,
                }))
              );
              const pinsFromSVG: fabric.FabricObject[] = [];
              const symbolParts: fabric.FabricObject[] = [];

              // 1. Separate the loaded parts into PINS and SYMBOL pieces
              objects.forEach((obj: any, index: number) => {
                console.log(`🎯 DEBUG: Processing object ${index}:`, {
                  type: obj?.type,
                  id: obj?.id,
                  left: obj?.left,
                  top: obj?.top,
                  visible: obj?.visible,
                  opacity: obj?.opacity,
                  hasEl: !!obj?.el,
                  // Log the actual element attributes if available
                  elementId: obj?.el?.id,
                  elementClass: obj?.el?.className,
                  elementTag: obj?.el?.tagName,
                });

                if (obj && obj.id === "pin") {
                  // This is a connection point. Save it.
                  console.log(`📍 Found PIN at x=${obj.left}, y=${obj.top}`);
                  pinsFromSVG.push(obj);
                } else if (obj) {
                  // This is part of the visual symbol.
                  symbolParts.push(obj);
                }
              });

              // BOTTOM BREAD: Original, invisible pin data (stores true location and database pin info)
              let dbPins = [];
              try {
                const pinConfig =
                  componentInfo.databaseComponent?.pin_configuration;
                if (typeof pinConfig === "string") {
                  const parsedConfig = JSON.parse(pinConfig);
                  dbPins = parsedConfig.pins || [];
                } else if (pinConfig && typeof pinConfig === "object") {
                  dbPins = pinConfig.pins || [];
                }
                console.log(`🔍 Parsed pin configuration:`, {
                  pinConfigType: typeof pinConfig,
                  parsedPins: dbPins.length,
                });
              } catch (error) {
                console.error(`❌ Error parsing pin configuration:`, error);
                dbPins = [];
              }

              // PIN COORDINATE TRANSFORMATION: Convert KiCad mm coordinates to canvas px
              // KiCad uses mm with Y flipped compared to canvas coordinates
              const MM_TO_PX = 3.78; // 96 DPI / 25.4 mm per inch ≈ 3.78 px per mm

              const invisiblePinData = dbPins.map(
                (dbPin: any, index: number) => {
                  // Transform coordinates: scale mm→px, flip Y, store as relative to component center
                  const pinX = dbPin.x * MM_TO_PX;
                  const pinY = -dbPin.y * MM_TO_PX; // Flip Y coordinate

                  return {
                    originalX: pinX, // Store transformed coordinates
                    originalY: pinY,
                    pinId: `pin${dbPin.number}`,
                    pinNumber: dbPin.number,
                    pinName: dbPin.name || `Pin ${dbPin.number}`,
                    electricalType: dbPin.electrical_type || "unknown",
                    orientation: dbPin.orientation || 0,
                  };
                }
              );
              console.log(
                `🔌 Found ${pinsFromSVG.length} pins in SVG and ${invisiblePinData.length} pins in database`
              );

              // DEBUG: Log details about pins found
              if (invisiblePinData.length === 0) {
                console.log(
                  "⚠️ WARNING: No pins found in database! This component won't be wireable."
                );
                console.log(
                  "⚠️ Check database component data for pin_configuration.pins"
                );
              } else {
                console.log(
                  "✅ Found pins in database:",
                  invisiblePinData.map((pin: any, i: number) => ({
                    index: i,
                    number: pin.pinNumber,
                    name: pin.pinName,
                    rawPosition: `(${dbPins[i].x}, ${dbPins[i].y})mm`, // Show original mm coordinates
                    canvasPosition: `(${pin.originalX}, ${pin.originalY})px`, // Show transformed px coordinates
                  }))
                );
              }

              // THE FILLING: Main component symbol (the SVG shape)
              console.log(
                `🎯 DEBUG: Creating SVG symbol with ${symbolParts.length} parts`
              );
              console.log(
                `🎯 DEBUG: Symbol parts:`,
                symbolParts.map((part, i) => ({
                  index: i,
                  type: part?.type,
                  id: (part as any)?.id,
                  hasEl: !!(part as any)?.el,
                }))
              );

              const svgSymbol = new fabric.Group(symbolParts, {
                originX: "center",
                originY: "center",
              });

              console.log(
                `🎯 DEBUG: SVG Symbol created with ${symbolParts.length} parts`
              );
              const svgBounds = svgSymbol.getBoundingRect();
              console.log(`🎯 DEBUG: SVG Symbol bounds:`, {
                left: svgBounds.left,
                top: svgBounds.top,
                width: svgBounds.width,
                height: svgBounds.height,
                centerX: svgBounds.left + svgBounds.width / 2,
                centerY: svgBounds.top + svgBounds.height / 2,
              });

              // Calculate SVG center offset - pins should be relative to SVG center, not group center
              const svgCenterX = svgBounds.left + svgBounds.width / 2;
              const svgCenterY = svgBounds.top + svgBounds.height / 2;
              console.log(
                `🎯 DEBUG: SVG center offset: (${svgCenterX}, ${svgCenterY})`
              );

              // DEBUG: Ensure all symbol parts are visible
              symbolParts.forEach((part, index) => {
                if (part.opacity === 0 || part.opacity === undefined) {
                  part.set("opacity", 1);
                  console.log(
                    `🎯 DEBUG: Set opacity to 1 for symbol part ${index}`
                  );
                }
                if (part.visible === false) {
                  part.set("visible", true);
                  console.log(
                    `🎯 DEBUG: Set visible to true for symbol part ${index}`
                  );
                }
              });
              svgSymbol.set("opacity", 1);
              svgSymbol.set("visible", true);

              console.log(
                `🎯 DEBUG: SVG Symbol created with ${symbolParts.length} parts`
              );
              console.log(
                `🎯 DEBUG: SVG Symbol bounds:`,
                svgSymbol.getBoundingRect()
              );
              console.log(
                `🎯 DEBUG: Symbol parts:`,
                symbolParts.map((part) => ({
                  type: part.type,
                  visible: part.visible,
                  opacity: part.opacity,
                }))
              );

              // TOP BREAD: Visible, interactive pin circles (transparent green)
              console.log(
                `🎯 DEBUG: Creating ${invisiblePinData.length} interactive pins from database`
              );

              // Generate a single component ID for all pins in this component
              const componentId = `component_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`;

              const interactivePins = invisiblePinData.map(
                (pinInfo: any, index: number) => {
                  // Position pins relative to SVG center, not component center
                  const pinLeft = pinInfo.originalX - svgCenterX;
                  const pinTop = pinInfo.originalY - svgCenterY;

                  console.log(
                    `🎯 DEBUG: Creating pin ${index + 1} (${
                      pinInfo.pinNumber
                    }) at (${pinInfo.originalX}, ${
                      pinInfo.originalY
                    }) -> relative (${pinLeft}, ${pinTop}) [SVG center: ${svgCenterX}, ${svgCenterY}]`
                  );

                  const interactivePin = new fabric.Circle({
                    radius: 4,
                    fill: "rgba(0, 255, 0, 0.8)", // Bright green for visibility
                    stroke: "#059669",
                    strokeWidth: 1,
                    left: pinLeft,
                    top: pinTop,
                    originX: "center",
                    originY: "center",
                    // PART 3: PIN VISIBILITY RULE - Start hidden
                    opacity: 0,
                    visible: false,
                  });

                  console.log(
                    `🎯 DEBUG: Pin ${index + 1} created at relative position (${
                      pinInfo.originalX
                    }, ${pinInfo.originalY})`
                  );
                  console.log(
                    `🎯 DEBUG: Pin center point:`,
                    interactivePin.getCenterPoint()
                  );

                  // Add the pin metadata that the wiring tool expects
                  const pinData = {
                    ...pinInfo,
                    originalX: pinLeft, // Update to use SVG-relative coordinates
                    originalY: pinTop,
                  };
                  interactivePin.set("pin", true);
                  interactivePin.set("pinData", pinData);
                  interactivePin.set("componentId", componentId);
                  interactivePin.set("data", {
                    type: "pin",
                    componentId: componentId,
                    pinId: pinData.pinId,
                    pinNumber: pinData.pinNumber,
                    pinName: pinData.pinName,
                    electricalType: pinData.electricalType,
                    isConnectable: true,
                  });

                  return interactivePin;
                }
              );

              // THE GOLDEN RULE: Lock all three layers together into ONE inseparable group
              // This is the COMPONENT SANDWICH - it moves as one unit forever

              // Calculate position - try to use screen center if no specific coordinates provided
              let componentX = componentInfo.x;
              let componentY = componentInfo.y;

              if (!componentX || !componentY) {
                // Get the center of the visible canvas area in screen coordinates
                try {
                  const canvasElement = currentCanvas.getElement();
                  if (canvasElement) {
                    const canvasRect = canvasElement.getBoundingClientRect();
                    const centerX = canvasRect.width / 2;
                    const centerY = canvasRect.height / 2;

                    // Convert screen coordinates to canvas coordinates using viewport transform
                    const vpt = currentCanvas.viewportTransform;
                    const zoom = currentCanvas.getZoom();
                    componentX = (centerX - vpt[4]) / zoom;
                    componentY = (centerY - vpt[5]) / zoom;

                    console.log(
                      `📍 Component positioned at center: (${componentX.toFixed(
                        0
                      )}, ${componentY.toFixed(0)})`
                    );
                  } else {
                    // Fallback: use canvas viewport center
                    console.log(
                      `📍 Using viewport center (canvas element unavailable)`
                    );
                    const vpCenter = currentCanvas.getVpCenter();
                    componentX = vpCenter.x;
                    componentY = vpCenter.y;
                  }
                } catch (error) {
                  console.error(
                    `❌ ERROR: Failed to get canvas position:`,
                    error
                  );
                  // Ultimate fallback: use canvas viewport center
                  const vpCenter = currentCanvas.getVpCenter();
                  componentX = vpCenter.x;
                  componentY = vpCenter.y;
                }
              }

              const componentSandwich = new fabric.Group(
                [svgSymbol, ...interactivePins],
                {
                  left: componentX,
                  top: componentY,
                  originX: "center",
                  originY: "center",
                  selectable: true,
                  evented: true,
                  lockScalingX: true,
                  lockScalingY: true,
                  hasControls: true,
                  hasBorders: true,
                  centeredRotation: true,
                }
              );

              // DEBUG: Log component positioning
              const vpCenter = canvas.getVpCenter();
              console.log(
                `📍 Canvas center: (${vpCenter.x.toFixed(
                  0
                )}, ${vpCenter.y.toFixed(0)})`
              );
              console.log(
                `📍 Component position: (${componentSandwich.left?.toFixed(
                  0
                )}, ${componentSandwich.top?.toFixed(0)})`
              );

              // Check if component is within visible bounds
              const bounds = componentSandwich.getBoundingRect();
              const canvasWidth = canvas.getWidth();
              const canvasHeight = canvas.getHeight();
              console.log(
                `📐 Component bounds: (${bounds.left.toFixed(
                  0
                )}, ${bounds.top.toFixed(0)}) ${bounds.width.toFixed(
                  0
                )}x${bounds.height.toFixed(0)}`
              );

              // Store the invisible pin data and component metadata
              componentSandwich.set("componentType", componentInfo.type);
              componentSandwich.set("invisiblePinData", invisiblePinData);
              componentSandwich.set("data", {
                type: "component",
                componentId: componentId,
                componentType: componentInfo.type,
                componentName: componentInfo.name,
                pins: interactivePins.map(
                  (_: any, index: number) => `pin${index + 1}`
                ),
                isComponentSandwich: true, // Mark this as a proper sandwich
              });

              console.log("✅ Component sandwich created with metadata:", {
                componentId,
                componentName: componentInfo.name,
                pinCount: interactivePins.length,
                isComponentSandwich: true,
                hasInvisiblePinData: !!invisiblePinData,
                pins: interactivePins.map((pin: any, i: number) => ({
                  index: i,
                  hasPinProperty: !!(pin as any).pin,
                  visible: pin.visible,
                  opacity: pin.opacity,
                })),
              });

              // Attach full database component metadata for proper serialization
              if (componentInfo.databaseComponent) {
                componentSandwich.set(
                  "databaseComponent",
                  componentInfo.databaseComponent
                );
                componentSandwich.set("componentMetadata", {
                  id: componentInfo.databaseComponent.id,
                  name: componentInfo.databaseComponent.name,
                  type: componentInfo.databaseComponent.type,
                  category: componentInfo.databaseComponent.category,
                  description: componentInfo.databaseComponent.description,
                  manufacturer: componentInfo.databaseComponent.manufacturer,
                  partNumber: componentInfo.databaseComponent.part_number,
                  specifications:
                    componentInfo.databaseComponent.specifications,
                  pinConfiguration:
                    componentInfo.databaseComponent.pin_configuration,
                  kicadSymRaw: componentInfo.databaseComponent.kicad_sym_raw,
                  kicadLibrarySource:
                    componentInfo.databaseComponent.kicad_library_source,
                  datasheetUrl: componentInfo.databaseComponent.datasheet_url,
                  keywords: componentInfo.databaseComponent.keywords,
                });
                console.log(
                  `💾 Attached database metadata to component: ${componentInfo.name}`
                );
              }

              // 5. Add the COMPONENT SANDWICH to the canvas - physically impossible to separate
              console.log(
                `🎯 Adding ${componentInfo.name} to canvas (${
                  currentCanvas.getObjects().length
                } objects currently)`
              );

              currentCanvas.add(componentSandwich);
              currentCanvas.renderAll();

              console.log(
                `✅ ${componentInfo.name} added to canvas (${
                  currentCanvas.getObjects().length
                } total objects)`
              );

              // Check component properties
              console.log(
                `📐 Component bounds: (${bounds.left.toFixed(
                  0
                )}, ${bounds.top.toFixed(0)}) ${bounds.width.toFixed(
                  0
                )}x${bounds.height.toFixed(0)}`
              );

              // Check if component is within canvas viewport
              const viewportBounds = {
                left:
                  -currentCanvas.viewportTransform[4] / currentCanvas.getZoom(),
                top:
                  -currentCanvas.viewportTransform[5] / currentCanvas.getZoom(),
                right:
                  (-currentCanvas.viewportTransform[4] +
                    currentCanvas.getWidth()) /
                  currentCanvas.getZoom(),
                bottom:
                  (-currentCanvas.viewportTransform[5] +
                    currentCanvas.getHeight()) /
                  currentCanvas.getZoom(),
              };
              const componentBounds = componentSandwich.getBoundingRect();
              const isVisible =
                componentBounds.left < viewportBounds.right &&
                componentBounds.left + componentBounds.width >
                  viewportBounds.left &&
                componentBounds.top < viewportBounds.bottom &&
                componentBounds.top + componentBounds.height >
                  viewportBounds.top;
              console.log(`🎯 DEBUG: Viewport bounds:`, viewportBounds);
              console.log(
                `🎯 DEBUG: Is component within viewport: ${isVisible}`
              );

              // Check if component is still there after a short delay
              setTimeout(() => {
                console.log(
                  `🎯 DEBUG: Component still in canvas after delay: ${currentCanvas
                    .getObjects()
                    .includes(componentSandwich)}`
                );
                console.log(
                  `🎯 DEBUG: Total objects after delay: ${
                    currentCanvas.getObjects().length
                  }`
                );
                if (currentCanvas.getObjects().includes(componentSandwich)) {
                  console.log(
                    `🎯 DEBUG: Component bounds after delay:`,
                    componentSandwich.getBoundingRect()
                  );
                  console.log(
                    `🎯 DEBUG: Component position after delay: left=${componentSandwich.left}, top=${componentSandwich.top}`
                  );
                  console.log(
                    `🎯 DEBUG: Component visible after delay: ${componentSandwich.visible}`
                  );
                  console.log(
                    `🎯 DEBUG: Component opacity after delay: ${componentSandwich.opacity}`
                  );
                }
              }, 100);

              console.log(
                `🥪 COMPONENT SANDWICH: Added ${componentInfo.name} with ${interactivePins.length} permanently attached pins!`
              );

              console.log(
                `🎯 DEBUG: ===== COMPONENT CREATION COMPLETED FOR ${componentInfo.name} =====`
              );

              // Reset processing flag
              isProcessingComponent = false;
            })
            .catch((error) => {
              console.error(
                `❌ INTELLIGENT: Failed to load ${componentInfo.svgPath}:`,
                error
              );

              // Reset processing flag on error
              isProcessingComponent = false;

              // Fallback: Try to create a simple component instead
              console.log(
                `🔄 FALLBACK: Attempting to create simple component for ${componentInfo.name}`
              );
              try {
                const simpleComponent = new fabric.Rect({
                  left: 200,
                  top: 200,
                  width: 60,
                  height: 30,
                  fill: "#E8E8E8",
                  stroke: "#333333",
                  strokeWidth: 2,
                });

                simpleComponent.set("componentType", componentInfo.type);
                simpleComponent.set("data", {
                  type: "component",
                  componentType: componentInfo.type,
                  componentName: componentInfo.name,
                });

                currentCanvas.add(simpleComponent);
                currentCanvas.renderAll();

                console.log(
                  `✅ FALLBACK: Simple component created for ${componentInfo.name}`
                );
              } catch (fallbackError) {
                console.error(
                  `❌ FALLBACK: Failed to create simple component:`,
                  fallbackError
                );

                // Reset processing flag on fallback error
                isProcessingComponent = false;
              }
            });
        } catch (error) {
          console.error(
            `❌ COMPONENT CREATION: Failed to create component ${componentInfo.name}:`,
            error
          );
          isProcessingComponent = false;
        }
      };

      // Use the new createComponent function
      createComponent(payload);
    }
  );

  isComponentHandlerSetup = true;

  // Return cleanup function
  return () => {
    console.log(
      "🧹 Cleaning up component event listener from setupComponentHandler"
    );
    if (componentEventUnsubscribe) {
      componentEventUnsubscribe();
      componentEventUnsubscribe = null;
    }
    isComponentHandlerSetup = false;
    isProcessingComponent = false;
  };
}
