import * as fabric from "fabric";
import { Circuit, ConnectionModel } from "@/lib/schemas/circuit";
import { canvasCommandManager } from "../canvas-command-manager";
import { logger } from "@/lib/logger";

/**
 * Serialize Fabric.js canvas to Circuit format with proper component handling
 */
export function serializeCanvasToCircuit(
  canvas: fabric.Canvas | null
): Partial<Circuit> | null {
  if (!canvas) return null;

  const objects = canvas.getObjects();

  // Separate components from other objects (wires, etc.)
  const componentGroups: fabric.Group[] = [];
  const otherObjects: fabric.Object[] = [];

  objects.forEach((obj) => {
    // Check if this is a component sandwich (has component metadata)
    const objData = (obj as any).data;
    if (
      objData &&
      objData.type === "component" &&
      objData.isComponentSandwich
    ) {
      componentGroups.push(obj as fabric.Group);
    } else {
      otherObjects.push(obj);
    }
  });

  // Extract components from component groups and map to ComponentModel format
  const components: any[] = componentGroups.map((group, index) => {
    const componentData = (group as any).data || {};
    const dbMetadata =
      (group as any).componentMetadata || (group as any).databaseComponent;

    // Get the original database ID for proper restoration
    let componentId = `comp_${index}`; // fallback
    if (dbMetadata?.uid) {
      componentId = dbMetadata.uid; // Use database uid
    } else if (dbMetadata?.id) {
      componentId = dbMetadata.id; // Fallback to database id
    } else if (componentData.originalDatabaseId) {
      componentId = componentData.originalDatabaseId; // If stored in data
    }

    return {
      id: componentId,
      databaseId: componentId, // Store for restoration
      type:
        dbMetadata?.type ||
        componentData.componentType ||
        componentData.type ||
        "unknown",
      value:
        dbMetadata?.name ||
        componentData.componentName ||
        componentData.name ||
        `Component ${index + 1}`,
      position: {
        x: group.left || 0,
        y: group.top || 0,
      },
      explanation:
        dbMetadata?.description ||
        componentData.description ||
        "Component added to circuit",
      datasheet: dbMetadata?.datasheet,
      // Store additional metadata for recreation
      metadata: {
        category: dbMetadata?.category || componentData.category || "general",
        specifications:
          dbMetadata?.specifications || componentData.specifications || {},
        availability: componentData.availability || "in-stock",
        properties: componentData.properties || {},
        pins: dbMetadata?.pinConfiguration?.pins || componentData.pins || [],
        databaseComponent: dbMetadata,
        rotation: group.angle || 0,
      },
    };
  });

  // Extract connections from other objects (wires)
  const connections: ConnectionModel[] = otherObjects
    .filter(
      (obj) =>
        obj.type === "line" || obj.type === "path" || obj.type === "polyline"
    )
    .filter((obj) => (obj as any).wireType === "connection")
    .map((obj, index) => {
      const wireObj = obj as any;
      const wireData = wireObj.wireData || wireObj;

      return {
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
      };
    });

  return {
    mode: "full" as const,
    components: components as any,
    connections,
  };
}

/**
 * Serialize Fabric.js canvas to raw canvas data format with electrical metadata preservation
 */
export function serializeCanvasData(
  canvas: fabric.Canvas | null,
  netlist?: any[] | (() => any[])
): Record<string, any> {
  if (!canvas) return {};

  try {
    // Get the base canvas data
    const canvasData = canvas.toJSON();

    // Resolve netlist if it's a function
    const resolvedNetlist = typeof netlist === "function" ? netlist() : netlist;

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

          // Wire properties
          netId: fabricObj.netId,
          wireData: fabricObj.wireData,
          properties: fabricObj.properties || {},

          // Vertex information for complex wires
          isWireVertex: fabricObj.isWireVertex,
          vertexIndex: fabricObj.vertexIndex,
        };
      }

      // Preserve component metadata
      if (fabricObj.data && fabricObj.data.type === "component") {
        electricalMetadata[`component_${index}`] = {
          componentType: fabricObj.componentType,
          id: fabricObj.id,
          data: fabricObj.data,
          pins: fabricObj.data.pins || [],
          objectIndex: index,
        };
      }
    });

    // Add electrical metadata to canvas data
    const extendedCanvasData = {
      ...canvasData,
      electricalMetadata,
      netlist: resolvedNetlist || null,
    };

    logger.canvas("Canvas data serialized with electrical metadata", {
      objectCount: canvas.getObjects().length,
      electricalMetadataCount: Object.keys(electricalMetadata).length,
      hasNetlist: !!resolvedNetlist,
      netlistNetCount: resolvedNetlist?.length || 0,
    });

    return extendedCanvasData;
  } catch (error) {
    console.error("❌ Failed to serialize canvas data:", error);
    return {};
  }
}

/**
 * Load canvas from circuit data by recreating components using the component handler
 */
export async function loadCanvasFromCircuit(
  canvas: fabric.Canvas,
  circuit: Partial<Circuit>
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log("🔄 Loading canvas from circuit data:", {
        componentCount: circuit.components?.length || 0,
        connectionCount: circuit.connections?.length || 0,
      });

      // Clear existing canvas
      canvas.clear();

      // Note: Layout information (dimensions, zoom) should be loaded from canvasData separately

      // Recreate components using the component handler
      if (circuit.components && circuit.components.length > 0) {
        console.log(
          `��️ Recreating ${circuit.components.length} components...`
        );

        for (const component of circuit.components as any[]) {
          try {
            console.log(
              `🎯 Recreating component: ${component.value} at (${component.position.x}, ${component.position.y})`
            );

            // Use the canvas command manager to add the component
            // This will trigger the proper component creation with pins
            canvasCommandManager.executeCommand("component:add", {
              id: component.id,
              type: component.type,
              name: component.value, // Use value as name
              category: component.metadata?.category || "general",
              svgPath: component.metadata?.databaseComponent?.symbol_svg
                ? `data:image/svg+xml;base64,${btoa(
                    component.metadata.databaseComponent.symbol_svg
                  )}`
                : "", // We'll need to fetch this from database
              databaseComponent: component.metadata?.databaseComponent,
              x: component.position.x,
              y: component.position.y,
              rotation: component.metadata?.rotation || 0,
            });

            // Wait a bit for component creation to complete
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            console.error(
              `❌ Failed to recreate component ${component.value}:`,
              error
            );
          }
        }
      }

      // TODO: Recreate connections/wires
      if (circuit.connections && circuit.connections.length > 0) {
        console.log(
          `🔗 Would recreate ${circuit.connections.length} connections...`
        );
        // This will need to be implemented once wire recreation is working
      }

      console.log("✅ Canvas loaded from circuit data");
      canvas.renderAll();
      resolve();
    } catch (error) {
      console.error("❌ Failed to load canvas from circuit:", error);
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
