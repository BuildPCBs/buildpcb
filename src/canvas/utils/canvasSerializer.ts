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
      // Try to get complete component metadata from fabric object
      const componentData = (obj as any).componentData;

      if (componentData) {
        // Use complete metadata if available
        return {
          ...componentData,
          position: {
            x: obj.left || 0,
            y: obj.top || 0,
          },
          rotation: obj.angle || 0,
        };
      } else {
        // Fallback to legacy incomplete metadata (for backward compatibility)
        const legacyData = (obj as any).data || {};
        return {
          id: legacyData.id || `comp_${index}`,
          name: legacyData.componentName || `Component ${index + 1}`,
          type: legacyData.componentType || "unknown",
          category: "general",
          specifications: {},
          availability: "in-stock" as const,
          position: {
            x: obj.left || 0,
            y: obj.top || 0,
          },
          rotation: obj.angle || 0,
          properties: {},
          pins: legacyData.pins || [],
        };
      }
    });

  // Extract connections from canvas objects (wires)
  const connections: Connection[] = objects
    .filter((obj) => obj.type === "line" || obj.type === "path")
    .map((obj, index) => {
      const wireData = (obj as any).wireData || {};

      return {
        id: wireData.id || `conn_${index}`,
        from: wireData.from || { componentId: "", pin: "" },
        to: wireData.to || { componentId: "", pin: "" },
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
 * Serialize Fabric.js canvas to raw canvas data format
 */
export function serializeCanvasData(
  canvas: fabric.Canvas | null
): Record<string, any> {
  if (!canvas) return {};

  try {
    // Use the correct toJSON method without parameters for Fabric.js 6+
    const canvasData = canvas.toJSON();

    return {
      ...canvasData,
      viewport: {
        zoom: canvas.getZoom(),
        transform: canvas.viewportTransform,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Failed to serialize canvas:", error);
    return {};
  }
}

/**
 * Restore Fabric.js canvas from raw canvas data
 */
export function loadCanvasFromData(
  canvas: fabric.Canvas,
  canvasData: Record<string, any>
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      canvas.loadFromJSON(canvasData, () => {
        // Restore viewport settings
        if (canvasData.viewport) {
          if (canvasData.viewport.zoom) {
            canvas.setZoom(canvasData.viewport.zoom);
          }
          if (canvasData.viewport.transform) {
            canvas.setViewportTransform(canvasData.viewport.transform);
          }
        }

        canvas.renderAll();
        resolve();
      });
    } catch (error) {
      console.error("Failed to load canvas from data:", error);
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
