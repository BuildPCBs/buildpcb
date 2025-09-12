import * as fabric from "fabric";
import { Circuit, Connection } from "@/types";

// Logical component configuration for proper wiring restoration
interface LogicalComponent {
  id: string; // Database component ID
  databaseId: string; // Reference to database component
  position: { x: number; y: number };
  rotation: number;
  properties: Record<string, any>;
  pinConfiguration?: any; // From database
}

/**
 * Serialize canvas to logical component configuration (NOT visual vectors)
 * This preserves wiring capability by saving component relationships, not visual data
 */
export function serializeCanvasToLogicalCircuit(
  canvas: fabric.Canvas | null
): Partial<Circuit> | null {
  if (!canvas) return null;

  const objects = canvas.getObjects();
  const logicalComponents: LogicalComponent[] = [];
  const connections: Connection[] = [];

  console.log("🔧 Serializing to LOGICAL circuit format (not vectors)");

  // Extract logical component data from canvas objects
  objects
    .filter((obj) => obj.type !== "line" && obj.type !== "path") // Exclude wires
    .forEach((obj, index) => {
      const fabricObj = obj as any;

      // Get database component reference
      const dbComponent =
        fabricObj.databaseComponent || fabricObj.componentMetadata;
      const componentId =
        dbComponent?.id || fabricObj.data?.componentId || `comp_${index}`;

      if (dbComponent) {
        logicalComponents.push({
          id: componentId,
          databaseId: dbComponent.id,
          position: {
            x: obj.left || 0,
            y: obj.top || 0,
          },
          rotation: obj.angle || 0,
          properties: fabricObj.data || {},
          pinConfiguration: dbComponent.pin_configuration,
        });

        console.log(
          `💾 Saved logical component: ${dbComponent.name} (${componentId})`
        );
      } else {
        console.warn(
          `⚠️ Component ${index} has no database reference, skipping`
        );
      }
    });

  // Extract wiring connections
  objects
    .filter(
      (obj) =>
        obj.type === "line" || obj.type === "path" || obj.type === "polyline"
    )
    .filter((obj) => (obj as any).wireType === "connection")
    .forEach((obj, index) => {
      const wireObj = obj as any;
      const wireData = wireObj.wireData || wireObj;

      connections.push({
        id: wireData.id || wireObj.id || `conn_${index}`,
        from: {
          componentId: wireObj.startComponentId || "",
          pin:
            wireObj.startPinIndex !== undefined
              ? wireObj.startPinIndex.toString()
              : "",
        },
        to: {
          componentId: wireObj.endComponentId || "",
          pin:
            wireObj.endPinIndex !== undefined
              ? wireObj.endPinIndex.toString()
              : "",
        },
        type: "wire" as const,
        properties: {
          netId: wireObj.netId,
          path: wireObj.path, // Save wire path for visual restoration
        },
      });

      console.log(
        `🔗 Saved wire connection: ${wireObj.startComponentId} → ${wireObj.endComponentId}`
      );
    });

  return {
    components: logicalComponents as any,
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
 * Restore canvas from logical component configuration
 * This reconstructs visual representation from database components
 */
export async function loadCanvasFromLogicalCircuit(
  canvas: fabric.Canvas,
  circuit: Partial<Circuit>
): Promise<void> {
  if (!circuit.components || !Array.isArray(circuit.components)) {
    console.warn("No components to load");
    return;
  }

  console.log("🔄 Loading from LOGICAL circuit format");

  // Clear existing canvas
  canvas.clear();

  // Import required functions
  const { canvasCommandManager } = await import("../canvas-command-manager");
  const { supabase } = await import("../../lib/supabase");

  // Process components
  for (const component of circuit.components as any[]) {
    try {
      console.log(`🔍 Loading component: ${component.databaseId}`);

      // Fetch component from database
      const { data: dbComponent, error } = await supabase
        .from("components")
        .select("*")
        .eq("id", component.databaseId)
        .single();

      if (error || !dbComponent) {
        console.error(
          `❌ Failed to load component ${component.databaseId}:`,
          error
        );
        continue;
      }

      // Add component to canvas using the command system
      canvasCommandManager.executeCommand("component:add", {
        id: dbComponent.id,
        type: dbComponent.type,
        svgPath: dbComponent.image || "",
        name: dbComponent.name,
        category: dbComponent.category,
        description: dbComponent.description,
        manufacturer: dbComponent.manufacturer,
        partNumber: dbComponent.part_number,
        pinCount: dbComponent.pin_configuration?.pins?.length || 0,
        databaseComponent: dbComponent,
        x: component.position.x,
        y: component.position.y,
      });

      console.log(
        `✅ Added component: ${dbComponent.name} at (${component.position.x}, ${component.position.y})`
      );
    } catch (error) {
      console.error(
        `❌ Error loading component ${component.databaseId}:`,
        error
      );
    }
  }

  // Wait for components to be fully loaded
  await new Promise((resolve) => setTimeout(resolve, 500));

  // TODO: Restore wire connections
  // TODO: Restore wire connections
  // This will require mapping the logical connections to the newly created visual components
  if (circuit.connections && circuit.connections.length > 0) {
    console.log(
      `🔗 TODO: Restore ${circuit.connections.length} wire connections`
    );
    // Wire restoration logic will be implemented next
  }

  canvas.renderAll();
  console.log("✅ Canvas restoration complete");
}

/**
 * Universal project loader that handles both logical and vector-based saves
 * This ensures backward compatibility while enabling logical component restoration
 */
export async function loadProjectToCanvas(
  canvas: fabric.Canvas,
  projectData: any
): Promise<void> {
  console.log("🔄 Loading project to canvas");

  // Clear existing canvas
  canvas.clear();

  // Check if this is a logical circuit (new format) or vector data (old format)
  if (
    projectData.components &&
    Array.isArray(projectData.components) &&
    projectData.components[0]?.databaseId
  ) {
    // New logical format - use logical loader
    console.log("📋 Detected logical circuit format, using logical loader");
    await loadCanvasFromLogicalCircuit(canvas, projectData);
  } else if (projectData.objects || projectData.canvasData) {
    // Old vector format - use traditional loader
    console.log("📋 Detected vector format, using traditional loader");
    const { loadCanvasFromData } = await import("./canvasSerializer");
    await loadCanvasFromData(canvas, projectData.canvasData || projectData);
  } else {
    console.warn("⚠️ Unknown project format");
  }

  console.log("✅ Project loading complete");
}
