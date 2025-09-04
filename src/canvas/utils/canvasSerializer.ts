import * as fabric from "fabric";
import { Circuit, Connection } from "@/types";

// Simplified component format for canvas serialization
interface CanvasComponent {
  id: string;
  name: string;
  type: string;
  category: string;
  specifications: Record<string, any>;
  availability: "in-stock" | "out-of-stock" | "discontinued";
  position: { x: number; y: number };
  rotation: number;
  properties: Record<string, any>;
  pins: any[];
}

/**
 * Serialize Fabric.js canvas to Circuit format
 */
export function serializeCanvasToCircuit(
  canvas: fabric.Canvas | null
): Partial<Circuit> | null {
  if (!canvas) return null;

  const objects = canvas.getObjects();

  // Extract components from canvas objects
  const components: CanvasComponent[] = objects
    .filter((obj) => obj.type !== "line" && obj.type !== "path") // Exclude wires
    .map((obj, index) => {
      // Get component metadata from fabric object
      const componentData =
        (obj as any).data || (obj as any).componentData || {};

      return {
        id: componentData.id || `comp_${index}`,
        name:
          componentData.componentName ||
          componentData.name ||
          `Component ${index + 1}`,
        type: componentData.componentType || componentData.type || "unknown",
        category: componentData.category || "general",
        specifications: componentData.specifications || {},
        availability: componentData.availability || ("in-stock" as const),
        position: {
          x: obj.left || 0,
          y: obj.top || 0,
        },
        rotation: obj.angle || 0,
        properties: componentData.properties || {},
        pins: componentData.pins || [],
      };
    });

  // Extract connections from canvas objects (wires)
  const connections: Connection[] = objects
    .filter(
      (obj) =>
        obj.type === "line" || obj.type === "path" || obj.type === "polyline"
    )
    .filter((obj) => (obj as any).wireType === "connection")
    .map((obj, index) => {
      const wireObj = obj as any;
      const wireData = wireObj.wireData || wireObj;

      return {
        id: wireData.id || wireObj.id || `conn_${index}`,
        from: wireData.from || {
          componentId: wireObj.startComponentId || "",
          pin:
            wireObj.startPinIndex !== undefined
              ? wireObj.startPinIndex.toString()
              : "",
        },
        to: wireData.to || {
          componentId: wireObj.endComponentId || "",
          pin:
            wireObj.endPinIndex !== undefined
              ? wireObj.endPinIndex.toString()
              : "",
        },
        type: wireData.type || ("wire" as const),
        properties: wireData.properties || {},
      };
    });

  return {
    components: components as any, // Type assertion for database compatibility
    connections,
    layout: {
      layers: [],
      dimensions: {
        width: canvas.getWidth(),
        height: canvas.getHeight(),
      },
      grid: { size: 10, visible: true },
      zoom: canvas.getZoom(),
      viewBox: {
        x: 0,
        y: 0,
        width: canvas.getWidth(),
        height: canvas.getHeight(),
      },
    },
  };
}

/**
 * Serialize Fabric.js canvas to raw canvas data format with electrical metadata preservation
 */
export function serializeCanvasData(
  canvas: fabric.Canvas | null
): Record<string, any> {
  if (!canvas) return {};

  try {
    // Get the base canvas data
    const canvasData = canvas.toJSON();

    // Extract and preserve electrical metadata for wires
    const electricalMetadata: Record<string, any> = {};

    canvas.getObjects().forEach((obj, index) => {
      const fabricObj = obj as any;

      // Check if this is a wire with electrical properties
      if (
        fabricObj.wireType === "connection" ||
        fabricObj.wireType === "junction"
      ) {
        electricalMetadata[`wire_${index}`] = {
          // Core wire identification
          wireType: fabricObj.wireType,
          id: fabricObj.id,

          // Pin connections
          startPin: fabricObj.startPin,
          endPin: fabricObj.endPin,
          startComponentId: fabricObj.startComponentId,
          endComponentId: fabricObj.endComponentId,
          startPinIndex: fabricObj.startPinIndex,
          endPinIndex: fabricObj.endPinIndex,
          startComponent: fabricObj.startComponent,
          endComponent: fabricObj.endComponent,

          // Electrical net information
          netId: fabricObj.netId,

          // Junction information
          endsAtJunction: fabricObj.endsAtJunction,
          junctionWire: fabricObj.junctionWire,
          junctionPoint: fabricObj.junctionPoint,
          junctionDot: fabricObj.junctionDot,
          connectedWires: fabricObj.connectedWires,
          junctionDots: fabricObj.junctionDots,

          // Wire editing properties
          isWireEndpoint: fabricObj.isWireEndpoint,
          isWireVertex: fabricObj.isWireVertex,
          vertexIndex: fabricObj.vertexIndex,

          // Original object index for restoration
          objectIndex: index,
        };

        console.log(`🔌 Preserving electrical metadata for wire ${index}:`, {
          wireType: fabricObj.wireType,
          netId: fabricObj.netId,
          startComponentId: fabricObj.startComponentId,
          endComponentId: fabricObj.endComponentId,
        });
      }

      // Also preserve component metadata and pin information
      if (fabricObj.componentType) {
        electricalMetadata[`component_${index}`] = {
          componentType: fabricObj.componentType,
          id: fabricObj.id,
          data: fabricObj.data,
          objectIndex: index,
        };

        // If this is a group component, preserve pin information
        if (fabricObj.type === "group") {
          const groupObjects = (fabricObj as fabric.Group).getObjects();
          const pinInfo: any[] = [];

          groupObjects.forEach((groupObj: any, groupIndex: number) => {
            if (
              groupObj.pin ||
              (groupObj.data && groupObj.data.type === "pin")
            ) {
              pinInfo.push({
                pinId: groupObj.data?.pinId || `pin_${groupIndex}`,
                pin: groupObj.pin,
                data: groupObj.data,
                type: groupObj.type,
                radius: groupObj.radius,
                fill: groupObj.fill,
                stroke: groupObj.stroke,
                strokeWidth: groupObj.strokeWidth,
                left: groupObj.left,
                top: groupObj.top,
                originX: groupObj.originX,
                originY: groupObj.originY,
              });
            }
          });

          if (pinInfo.length > 0) {
            electricalMetadata[`component_${index}`].pins = pinInfo;
            console.log(
              `🔌 Preserving ${pinInfo.length} pins for component ${fabricObj.componentType}:`,
              pinInfo.map((p) => p.pinId)
            );
          }
        }
      }
    });

    return {
      ...canvasData,
      viewport: {
        zoom: canvas.getZoom(),
        transform: canvas.viewportTransform,
      },
      electricalMetadata,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to serialize canvas:", error);
    return {};
  }
}

/**
 * Restore Fabric.js canvas from raw canvas data with electrical metadata restoration
 */
export function loadCanvasFromData(
  canvas: fabric.Canvas,
  canvasData: Record<string, any>
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("🔄 Loading canvas from data:", {
        objectCount: canvasData.objects?.length || 0,
        hasViewport: !!canvasData.viewportTransform,
        zoom: canvasData.zoom,
        hasElectricalMetadata: !!canvasData.electricalMetadata,
      });

      canvas.loadFromJSON(canvasData, async () => {
        console.log(
          "📊 Canvas loaded, objects on canvas:",
          canvas.getObjects().length
        );

        // Restore electrical metadata for wires and components
        if (canvasData.electricalMetadata) {
          const objects = canvas.getObjects();

          for (const [key, metadata] of Object.entries(
            canvasData.electricalMetadata
          ) as [string, any][]) {
            if (
              metadata.objectIndex !== undefined &&
              objects[metadata.objectIndex]
            ) {
              const obj = objects[metadata.objectIndex] as any;

              // Restore wire electrical properties
              if (key.startsWith("wire_")) {
                console.log(
                  `🔌 Restoring electrical metadata for wire at index ${metadata.objectIndex}`
                );

                // Core wire identification
                obj.wireType = metadata.wireType;
                obj.id = metadata.id;

                // Pin connections
                obj.startPin = metadata.startPin;
                obj.endPin = metadata.endPin;
                obj.startComponentId = metadata.startComponentId;
                obj.endComponentId = metadata.endComponentId;
                obj.startPinIndex = metadata.startPinIndex;
                obj.endPinIndex = metadata.endPinIndex;
                obj.startComponent = metadata.startComponent;
                obj.endComponent = metadata.endComponent;

                // Electrical net information
                obj.netId = metadata.netId;

                // Junction information
                obj.endsAtJunction = metadata.endsAtJunction;
                obj.junctionWire = metadata.junctionWire;
                obj.junctionPoint = metadata.junctionPoint;
                obj.junctionDot = metadata.junctionDot;
                obj.connectedWires = metadata.connectedWires;
                obj.junctionDots = metadata.junctionDots;

                // Wire editing properties
                obj.isWireEndpoint = metadata.isWireEndpoint;
                obj.isWireVertex = metadata.isWireVertex;
                obj.vertexIndex = metadata.vertexIndex;

                // Ensure wire is selectable and interactive
                obj.selectable = true;
                obj.evented = true;
                obj.lockMovementX = true;
                obj.lockMovementY = true;
                obj.lockRotation = true;
                obj.lockScalingX = true;
                obj.lockScalingY = true;
                obj.hasControls = false;
                obj.hasBorders = true;

                console.log(`✅ Wire electrical properties restored:`, {
                  wireType: obj.wireType,
                  netId: obj.netId,
                  startComponentId: obj.startComponentId,
                  endComponentId: obj.endComponentId,
                });
              }

              // Restore component metadata
              if (key.startsWith("component_")) {
                obj.componentType = metadata.componentType;
                obj.id = metadata.id;
                obj.data = metadata.data;

                // Ensure component is selectable and interactive
                obj.selectable = true;
                obj.evented = true;
                obj.lockUniScaling = true;
                obj.hasControls = true;
                obj.hasBorders = true;
                obj.centeredRotation = true;

                // Restore pin properties if they were preserved
                if (metadata.pins && obj.type === "group") {
                  const groupObjects = (obj as fabric.Group).getObjects();

                  metadata.pins.forEach((pinData: any) => {
                    // Find the pin by pinId instead of index
                    const pinObj = groupObjects.find(
                      (groupObj: any) =>
                        groupObj.data && groupObj.data.pinId === pinData.pinId
                    ) as any;

                    if (pinObj) {
                      pinObj.pin = pinData.pin;
                      pinObj.data = pinData.data;
                      console.log(
                        `✅ Restored pin properties for pin ${pinData.pinId}`
                      );
                    } else {
                      console.warn(
                        `⚠️ Could not find pin with ID ${pinData.pinId} in component ${obj.componentType}`
                      );
                    }
                  });

                  console.log(
                    `✅ Restored ${metadata.pins.length} pins for component ${obj.componentType}`
                  );
                }

                // Check if this component needs pin recreation (fallback)
                if (obj.type === "group" && obj.componentType) {
                  console.log(
                    `🔌 Checking pins for component ${obj.componentType} at index ${metadata.objectIndex}`
                  );

                  // Check if the component has pins
                  const groupObjects = (obj as fabric.Group).getObjects();
                  const hasPins = groupObjects.some(
                    (groupObj: any) =>
                      groupObj.pin ||
                      (groupObj.data && groupObj.data.type === "pin")
                  );

                  if (!hasPins) {
                    console.log(
                      `⚠️ Component ${obj.componentType} missing pins, attempting recreation`
                    );

                    // Try to recreate pins for this component
                    try {
                      // Import the SVG component factory dynamically
                      const { recreateComponentPins } = await import(
                        "../SVGComponentFactory"
                      );
                      const recreatedComponent = recreateComponentPins(
                        obj as fabric.Group,
                        canvas
                      );

                      if (recreatedComponent && recreatedComponent !== obj) {
                        // Replace the old component with the recreated one
                        const index = canvas.getObjects().indexOf(obj);
                        if (index !== -1) {
                          canvas.remove(obj);
                          canvas.add(recreatedComponent);
                          console.log(
                            `✅ Successfully recreated pins for component ${obj.componentType}`
                          );
                        }
                      }
                    } catch (error) {
                      console.error(
                        `❌ Failed to recreate pins for component ${obj.componentType}:`,
                        error
                      );
                    }
                  } else {
                    console.log(
                      `✅ Component ${obj.componentType} already has pins`
                    );
                  }
                }
              }
            }
          }

          console.log(
            `🔌 Electrical metadata restoration completed for ${
              Object.keys(canvasData.electricalMetadata).length
            } objects`
          );
        } // Preserve the grid background if it was set
        const currentBg = canvas.backgroundColor;
        if (!currentBg || typeof currentBg === "string") {
          // Create and apply grid pattern if background is not already a pattern
          const patternCanvas = document.createElement("canvas");
          const patternCtx = patternCanvas.getContext("2d");
          if (patternCtx) {
            patternCanvas.width = 10;
            patternCanvas.height = 10;
            patternCtx.strokeStyle = "#CCCCCC";
            patternCtx.lineWidth = 1;
            patternCtx.beginPath();
            patternCtx.moveTo(10, 0);
            patternCtx.lineTo(10, 10);
            patternCtx.moveTo(0, 10);
            patternCtx.lineTo(10, 10);
            patternCtx.stroke();

            const gridPattern = new fabric.Pattern({
              source: patternCanvas,
              repeat: "repeat",
            });
            canvas.backgroundColor = gridPattern;
          }
        }

        // Restore viewport settings
        if (canvasData.viewport) {
          if (canvasData.viewport.zoom) {
            canvas.setZoom(canvasData.viewport.zoom);
          }
          if (canvasData.viewport.transform) {
            canvas.setViewportTransform(canvasData.viewport.transform);
          }
        } else if (canvasData.viewportTransform) {
          canvas.setViewportTransform(canvasData.viewportTransform);
        }
        if (canvasData.zoom) {
          canvas.setZoom(canvasData.zoom);
        }

        canvas.renderAll();
        console.log("✅ Canvas restoration completed with electrical metadata");

        // Trigger pin visibility update after restoration
        // This ensures pins are properly shown/hidden based on current wiring tool state
        setTimeout(() => {
          const objects = canvas.getObjects();
          let pinCount = 0;

          objects.forEach((obj) => {
            // Handle new Component Sandwich architecture
            if (
              (obj as any).data?.isComponentSandwich &&
              obj.type === "group"
            ) {
              const componentSandwich = obj as fabric.Group;
              const sandwichLayers = componentSandwich.getObjects();

              sandwichLayers.forEach((layer) => {
                if ((layer as any).pin && layer.type === "circle") {
                  pinCount++;
                  // Set default pin visibility (will be overridden by wiring tool if active)
                  layer.set({
                    opacity: 0.8, // Default visible state
                    strokeWidth: 1,
                    fill: "#10B981", // Default green
                    stroke: "#059669",
                    visible: true,
                  });
                }
              });
            }

            // Legacy support for old component structure
            else if ((obj as any).componentType && obj.type === "group") {
              const group = obj as fabric.Group;
              const groupObjects = group.getObjects();

              groupObjects.forEach((groupObj) => {
                if ((groupObj as any).pin) {
                  pinCount++;
                  groupObj.set({
                    opacity: 0.8,
                    strokeWidth: 1,
                    fill: "#10B981",
                    stroke: "#059669",
                    visible: true,
                  });
                }
              });
            }
          });

          if (pinCount > 0) {
            canvas.renderAll();
            console.log(
              `✅ PIN RESTORATION: Made ${pinCount} pins visible after canvas load`
            );
          }
        }, 100); // Small delay to ensure everything is settled

        resolve();
      });
    } catch (error) {
      console.error("❌ Failed to load canvas from data:", error);
      reject(error);
    }
  });
}

/**
 * Create a thumbnail image of the canvas
 */
export function generateCanvasThumbnail(
  canvas: fabric.Canvas | null,
  width = 200,
  height = 150
): string | null {
  if (!canvas) return null;

  try {
    return canvas.toDataURL({
      format: "jpeg",
      quality: 0.8,
      multiplier: Math.min(
        width / canvas.getWidth(),
        height / canvas.getHeight()
      ),
    });
  } catch (error) {
    console.error("Failed to generate thumbnail:", error);
    return null;
  }
}
