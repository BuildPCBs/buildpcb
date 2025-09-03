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
      const componentData = (obj as any).componentData || {};

      return {
        id: componentData.id || `comp_${index}`,
        name: componentData.name || `Component ${index + 1}`,
        type: componentData.type || "unknown",
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
      const wireData = wireObj.wireData || {};

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
      console.log("🔄 Loading canvas from data:", {
        objectCount: canvasData.objects?.length || 0,
        hasViewport: !!canvasData.viewportTransform,
        zoom: canvasData.zoom,
      });

      canvas.loadFromJSON(canvasData, () => {
        console.log(
          "📊 Canvas loaded, objects on canvas:",
          canvas.getObjects().length
        );

        // Preserve the grid background if it was set
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
        console.log("✅ Canvas restoration completed");
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
