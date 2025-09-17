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

      // Get database component reference and actual component ID
      const dbComponent =
        fabricObj.databaseComponent || fabricObj.componentMetadata;

      // CRITICAL: Use the actual componentId from the object's data, not the database ID
      const componentId =
        fabricObj.data?.componentId || fabricObj.id || `comp_${index}`;

      if (dbComponent) {
        logicalComponents.push({
          id: componentId, // This is the canvas component ID that wires reference
          databaseId: dbComponent.uid || dbComponent.id, // This is the database reference
          position: {
            x: obj.left || 0,
            y: obj.top || 0,
          },
          rotation: obj.angle || 0,
          properties: fabricObj.data || {},
          pinConfiguration: dbComponent.pin_configuration,
        });

        console.log(
          `💾 Saved logical component: ${
            dbComponent.name
          } (canvas ID: ${componentId}, db ID: ${
            dbComponent.uid || dbComponent.id
          })`
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

// Loading state management to prevent duplicate loads
let isCurrentlyLoading = false;

/**
 * Restore canvas from logical component configuration
 * This reconstructs visual representation from database components
 */
export async function loadCanvasFromLogicalCircuit(
  canvas: fabric.Canvas,
  circuit: Partial<Circuit>,
  netlistData?: any[] // NEW: Netlist data parameter
): Promise<void> {
  if (isCurrentlyLoading) {
    console.warn(
      "⚠️ Canvas loading already in progress, skipping duplicate load request"
    );
    return;
  }

  if (!circuit.components || !Array.isArray(circuit.components)) {
    console.warn("No components to load");
    return;
  }

  isCurrentlyLoading = true;

  try {
    console.log("🔄 Loading from LOGICAL circuit format", {
      componentCount: circuit.components.length,
      connectionCount: circuit.connections?.length || 0,
      netlistCount: netlistData?.length || 0,
    });

    // Clear existing canvas and wait for completion
    canvas.clear();
    await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay to ensure clearing is complete

    const totalComponents = circuit.components?.length || 0;
    console.log(
      `🧹 Canvas cleared, starting component loading with ${totalComponents} components`
    );

    // Import required functions
    const { canvasCommandManager } = await import("../canvas-command-manager");
    const { supabase } = await import("../../lib/supabase");

    // Process components in parallel with concurrency control
    const MAX_CONCURRENT_COMPONENTS = 5; // Limit concurrent operations
    const componentPromises: Promise<void>[] = [];

    for (let i = 0; i < totalComponents; i += MAX_CONCURRENT_COMPONENTS) {
      const batch = circuit.components!.slice(i, i + MAX_CONCURRENT_COMPONENTS);

      // Process batch in parallel
      const batchPromises = batch.map(
        async (component: any, batchIndex: number) => {
          const globalIndex = i + batchIndex;
          try {
            console.log(
              `🔍 Loading component ${globalIndex + 1}/${totalComponents}: ${
                component.databaseId
              }`
            );

            // Fetch component from database with timeout
            const fetchPromise = supabase
              .from("components_v2")
              .select("*")
              .eq("uid", component.databaseId || component.id)
              .single();

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `Database query timeout for component ${component.databaseId}`
                    )
                  ),
                10000
              )
            );

            const { data: dbComponent, error } = await Promise.race([
              fetchPromise,
              timeoutPromise,
            ]);

            if (error || !dbComponent) {
              console.error(
                `❌ Failed to load component ${component.databaseId}:`,
                error?.message || "Component not found in database"
              );
              // Log additional context for debugging
              console.error(`Component data:`, {
                databaseId: component.databaseId,
                id: component.id,
                position: component.position,
              });
              return; // Skip this component but continue with others
            }

            // Add component to canvas using the command system with timeout
            const addPromise = new Promise<void>((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(
                  new Error(`Component add timeout for ${dbComponent.name}`)
                );
              }, 15000); // 15 second timeout for component addition

              canvasCommandManager.executeCommand("component:add", {
                id: dbComponent.uid,
                type: dbComponent.type,
                svgPath: dbComponent.symbol_svg || "",
                name: dbComponent.name,
                category: dbComponent.category,
                description: dbComponent.description,
                manufacturer: dbComponent.manufacturer,
                partNumber: dbComponent.part_number,
                pinCount: dbComponent.symbol_data?.pins?.length || 0,
                databaseComponent: dbComponent,
                x: component.position.x,
                y: component.position.y,
                // CRITICAL: Pass the saved component ID to maintain wire connections
                preservedComponentId: component.id,
              });

              // Listen for completion (this is a simplified approach - in practice you'd need a proper completion signal)
              setTimeout(() => {
                clearTimeout(timeout);
                resolve();
              }, 100); // Small delay to allow command to start processing
            });

            await addPromise;

            console.log(
              `✅ Added component ${globalIndex + 1}/${totalComponents}: ${
                dbComponent.name
              } at (${component.position.x}, ${component.position.y})`
            );
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown error";
            console.error(
              `❌ Error loading component ${
                globalIndex + 1
              }/${totalComponents} (${component.databaseId}): ${errorMessage}`
            );
            // Log component details for debugging
            console.error(`Failed component details:`, {
              databaseId: component.databaseId,
              position: component.position,
              error: errorMessage,
            });
            // Continue with other components even if this one fails
          }
        }
      );

      componentPromises.push(...batchPromises);

      // Wait for current batch to complete before starting next batch
      await Promise.allSettled(batchPromises);
    }

    // Wait for all component loading to complete
    const results = await Promise.allSettled(componentPromises);
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(
      `📊 Component loading complete: ${successful} successful, ${failed} failed out of ${totalComponents} total`
    );

    if (failed > 0) {
      console.warn(
        `⚠️ ${failed} components failed to load. Check console for details.`
      );
    }

    // Restore wire connections after a delay to ensure components are fully loaded
    if (circuit.connections && circuit.connections.length > 0) {
      console.log(
        `🔗 Restoring ${circuit.connections.length} wire connections`
      );

      // Wait for components to be properly added to canvas before restoring wires
      await new Promise((resolve) => setTimeout(resolve, 200));

      for (const connection of circuit.connections) {
        try {
          console.log(
            `🔗 Restoring wire: ${connection.from.componentId}:${connection.from.pin} → ${connection.to.componentId}:${connection.to.pin}`
          );

          // Find the actual components on the canvas to verify they exist
          const canvasObjects = canvas.getObjects();
          const fromComponent = canvasObjects.find((obj) => {
            const objData = (obj as any).data;
            return objData?.componentId === connection.from.componentId;
          });
          const toComponent = canvasObjects.find((obj) => {
            const objData = (obj as any).data;
            return objData?.componentId === connection.to.componentId;
          });

          if (!fromComponent) {
            console.error(
              `❌ Source component not found: ${connection.from.componentId}`
            );
            continue;
          }
          if (!toComponent) {
            console.error(
              `❌ Target component not found: ${connection.to.componentId}`
            );
            continue;
          }

          console.log(`✅ Found both components for wire restoration`);

          // Execute wire:add command
          const success = canvasCommandManager.executeCommand("wire:add", {
            fromComponentId: connection.from.componentId,
            fromPinNumber: connection.from.pin,
            toComponentId: connection.to.componentId,
            toPinNumber: connection.to.pin,
            netId: (connection as any).properties?.netId,
            path: (connection as any).properties?.path,
          });

          if (!success) {
            console.error(
              `❌ Failed to restore wire: ${connection.from.componentId} → ${connection.to.componentId}`
            );
          } else {
            console.log(
              `✅ Restored wire: ${connection.from.componentId} → ${connection.to.componentId}`
            );
          }
        } catch (error) {
          console.error(`❌ Error restoring wire ${connection.id}:`, error);
        }
      }
    }

    // NEW: Restore netlist data if provided
    if (netlistData && netlistData.length > 0) {
      console.log(`🕸️ Restoring ${netlistData.length} nets to netlist hook`);
      // This will be handled by the calling code that has access to the netlist hook
    }

    canvas.renderAll();
    console.log("✅ Canvas restoration complete");
  } finally {
    isCurrentlyLoading = false;
  }
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
    // For old vector format, use Fabric.js built-in loader
    if (canvas && (projectData.canvasData || projectData)) {
      await new Promise<void>((resolve) => {
        canvas.loadFromJSON(projectData.canvasData || projectData, () => {
          console.log("✅ Loaded canvas from vector data");
          resolve();
        });
      });
    }
    console.warn("⚠️ Unknown project format");
  }

  console.log("✅ Project loading complete");
}
