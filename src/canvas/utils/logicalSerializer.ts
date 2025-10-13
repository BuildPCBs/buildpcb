import * as fabric from "fabric";
import { Circuit, Connection } from "@/types";
import { refDesService } from "@/lib/refdes-service";
import { logger } from "@/lib/logger";

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
  netlistData?: any[], // NEW: Netlist data parameter
  refDesAssignments?: any[] // RefDes assignments to restore
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

    // Clear existing canvas and RefDes service, then wait for completion
    canvas.clear();
    refDesService.clear(); // Reset RefDes counters for new project/load

    // Restore RefDes assignments if provided
    if (
      refDesAssignments &&
      Array.isArray(refDesAssignments) &&
      refDesAssignments.length > 0
    ) {
      refDesService.loadAssignments(refDesAssignments);
      logger.canvas(
        `✅ Restored ${refDesAssignments.length} RefDes assignments`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay to ensure clearing is complete

    const totalComponents = circuit.components?.length || 0;

    // DEBUGGING: Check for duplicate component IDs that could cause overwrites
    const componentIds = circuit.components?.map((c) => c.id) || [];
    const uniqueIds = new Set(componentIds);
    if (componentIds.length !== uniqueIds.size) {
      console.error(`🚨 DUPLICATE COMPONENT IDs DETECTED!`, {
        totalComponents: componentIds.length,
        uniqueIds: uniqueIds.size,
        duplicates: componentIds.filter(
          (id, index) => componentIds.indexOf(id) !== index
        ),
      });
    }

    console.log(
      `🧹 Canvas cleared, starting component loading with ${totalComponents} components`
    );
    console.log(`📋 Component IDs to load:`, componentIds);

    // CRITICAL TEST: This log should ALWAYS appear
    console.log(
      `🔥 LOGICALSERIALIZER: Starting component batch processing - THIS LOG SHOULD ALWAYS APPEAR`
    );

    // Import required functions
    const { canvasCommandManager } = await import("../canvas-command-manager");
    const { supabase } = await import("../../lib/supabase");

    // Process components in smaller batches with better timing control
    const MAX_CONCURRENT_COMPONENTS = 2; // Reduced to prevent overload
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
              }`,
              {
                originalId: component.id,
                databaseId: component.databaseId,
                position: component.position,
              }
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

              // CRITICAL CHECK: Monitor canvas state before component addition
              const canvasBeforeAdd = canvas.getObjects();
              console.log(
                `📊 BEFORE adding component ${globalIndex + 1}: ${
                  canvasBeforeAdd.length
                } objects on canvas`
              );

              console.log(
                `🎯 EXECUTING component:add command for ${dbComponent.name}`
              );
              const commandResult = canvasCommandManager.executeCommand(
                "component:add",
                {
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
                }
              );

              console.log(
                `🎯 executeCommand result for ${dbComponent.name}:`,
                commandResult
              );

              // Add immediate canvas check after command
              const canvasAfterCommand = canvas.getObjects();
              console.log(
                `📊 IMMEDIATELY after executeCommand: ${canvasAfterCommand.length} objects on canvas`
              );

              console.log(
                `🆔 Component ${globalIndex + 1}: db=${
                  dbComponent.uid
                }, preserved=${component.id}, position=(${
                  component.position.x
                }, ${component.position.y})`
              );

              // CRITICAL CHECK: Ensure database UIDs are unique
              console.log(
                `🔍 Database UID check: ${
                  dbComponent.uid
                }, type: ${typeof dbComponent.uid}`
              );

              // Poll for component to appear on canvas (Fabric.js async rendering)
              let attempts = 0;
              const maxAttempts = 20; // 2 seconds total (20 * 100ms)
              const checkInterval = setInterval(() => {
                attempts++;
                const canvasObjects = canvas.getObjects();
                const foundComponent = canvasObjects.find(
                  (obj: any) => obj.data?.componentId === component.id
                );

                if (foundComponent) {
                  console.log(
                    `✅ Component ${component.id} found on canvas after ${
                      attempts * 100
                    }ms`
                  );
                  clearTimeout(timeout);
                  clearInterval(checkInterval);
                  resolve();
                } else if (attempts >= maxAttempts) {
                  console.warn(
                    `⚠️ Component ${component.id} not found after ${
                      attempts * 100
                    }ms, continuing anyway`
                  );
                  clearTimeout(timeout);
                  clearInterval(checkInterval);
                  resolve(); // Resolve anyway to not block restoration
                }
              }, 100); // Check every 100ms
            });

            await addPromise;

            // DEBUGGING: Check if component was actually added to canvas
            const canvasObjects = canvas.getObjects();
            const justAddedComponent = canvasObjects.find(
              (obj: any) => obj.data?.componentId === component.id
            );

            console.log(
              `🎯 Canvas verification: instance=${
                (canvas as any)._id || "no-id"
              }, component=${component.id}`
            );

            console.log(
              `✅ Added component ${globalIndex + 1}/${totalComponents}: ${
                dbComponent.name
              } at (${component.position.x}, ${component.position.y})`
            );
            console.log(
              `🔍 Component verification: ${component.id} found on canvas:`,
              !!justAddedComponent
            );
            console.log(
              `📊 Canvas state: ${canvasObjects.length} total objects, ${
                canvasObjects.filter((obj: any) => obj.data?.componentId).length
              } components`
            );

            if (!justAddedComponent) {
              console.warn(
                `⚠️ Component ${component.id} verification failed - may appear after render cycle completes`
              );
              // Extra debugging - show all objects on canvas
              console.log(
                `🔍 All canvas objects (${canvasObjects.length}):`,
                canvasObjects.map((obj: any, idx) => ({
                  index: idx,
                  type: obj.type,
                  componentId: obj.data?.componentId,
                  hasData: !!obj.data,
                }))
              );
            }
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

      // Add delay between batches to prevent system overload
      if (i + MAX_CONCURRENT_COMPONENTS < totalComponents) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Wait for all component loading to complete
    const results = await Promise.allSettled(componentPromises);

    // CRITICAL TEST: This should appear when components finish processing
    console.log(
      `🔥🔥🔥 COMPONENT PROCESSING FINISHED - LOOK FOR THIS LOG! 🔥🔥🔥`
    );
    console.log(
      `🔥 Results status:`,
      results.map((r) => r.status)
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(
      `📊 Component loading results: ${successful} successful, ${failed} failed`
    );

    // DEBUG: Check what components are actually on the canvas
    const canvasObjects = canvas.getObjects();
    const componentObjects = canvasObjects.filter(
      (obj: any) => obj.data?.type === "component" || obj.type === "group"
    );
    console.log("🔍 Components found on canvas after loading:", {
      totalCanvasObjects: canvasObjects.length,
      componentCount: componentObjects.length,
      componentDetails: componentObjects.map((obj: any) => ({
        type: obj.type,
        componentId: obj.data?.componentId,
        dataType: obj.data?.type,
        hasData: !!obj.data,
      })),
    });

    // Add a longer delay to ensure all components are fully processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(
      `📊 Component loading complete: ${successful} successful, ${failed} failed out of ${totalComponents} total`
    );

    if (failed > 0) {
      console.warn(
        `⚠️ ${failed} components failed to load. Check console for details.`
      );
    }

    // DISABLED: Wire connections are now handled by netlist restoration system
    // Wire restoration happens via custom event 'netlistRestored' dispatched from ProjectContext
    // This prevents duplicate wire creation and ID conflicts
    if (circuit.connections && circuit.connections.length > 0) {
      console.log(
        `🔗 Skipping ${circuit.connections.length} wire connections - handled by netlist event system`
      );
    }

    // NOTE: netlistData parameter is not used here
    // Wire restoration happens via custom event 'netlistRestored' dispatched from ProjectContext
    // which triggers wire recreation in IDEFabricCanvas.tsx
    if (netlistData && netlistData.length > 0) {
      console.log(
        `🕸️ Netlist data available (${netlistData.length} nets) - will be restored via custom event`
      );
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
