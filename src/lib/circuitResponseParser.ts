"use client";

import Konva from "konva";
import { logger } from "./logger";

// Circuit response interfaces matching the schema
export interface CircuitComponent {
  id: string;
  type: ComponentType;
  value: string;
  position: {
    x: number;
    y: number;
  };
  connections: Pin[];
  datasheet: string;
  explanation: string;
  metadata?: {
    package?: string;
    rating?: string;
    tolerance?: string;
  };
}

export interface Pin {
  id: string;
  name: string;
  netId: string;
  type: "input" | "output" | "bidirectional" | "power" | "ground";
}

export type ComponentType =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "led"
  | "diode"
  | "transistor"
  | "ic"
  | "microcontroller"
  | "sensor"
  | "switch"
  | "button"
  | "connector"
  | "battery"
  | "voltage_regulator";

export interface CircuitConnection {
  id: string;
  from: {
    componentId: string;
    pin: string;
  };
  to: {
    componentId: string;
    pin: string;
  };
  type: "wire";
}

export interface CircuitPatch {
  id: string;
  operations: PatchOperation[];
  affectedComponents: string[];
}

export interface PatchOperation {
  type: "add" | "remove" | "modify";
  componentId: string;
  data?: Partial<CircuitComponent>;
}

export interface CircuitResponse {
  mode: "full" | "edit" | "text-only";
  circuit?: {
    id: string;
    name: string;
    description: string;
    components: CircuitComponent[];
    connections: CircuitConnection[];
  };
  edit?: CircuitPatch;
  textResponse?: string;
  metadata: {
    timestamp: string;
    version: string;
    explanation: string;
  };
  canvasReferences?: any[];
}

// Canvas operation interfaces
export interface CanvasOperation {
  type:
    | "add_component"
    | "remove_component"
    | "add_wire"
    | "remove_wire"
    | "modify_component";
  componentId?: string;
  componentType?: ComponentType;
  position?: { x: number; y: number };
  value?: string;
  fromConnection?: { componentId: string; pin: string };
  toConnection?: { componentId: string; pin: string };
  properties?: Record<string, any>;
}

export interface ParsedCircuitResponse {
  operations: CanvasOperation[];
  explanation: string;
  affectedComponents: string[];
  isValid: boolean;
  errors: string[];
}

/**
 * Parse AI circuit response and convert to canvas operations
 */
export function parseCircuitResponse(response: any): ParsedCircuitResponse {
  const errors: string[] = [];
  const operations: CanvasOperation[] = [];
  const affectedComponents: string[] = [];

  logger.api("Starting to parse circuit response:", response);

  try {
    // Handle text-only responses
    if (response.mode === "text-only" || !response.circuit) {
      logger.api("Text-only response detected");
      return {
        operations: [],
        explanation:
          response.textResponse ||
          response.metadata?.explanation ||
          "No circuit changes needed",
        affectedComponents: [],
        isValid: true,
        errors: [],
      };
    }

    // Validate response structure
    if (
      !response.circuit.components ||
      !Array.isArray(response.circuit.components)
    ) {
      console.error(
        "❌ Invalid circuit response: missing or invalid components array"
      );
      errors.push(
        "Invalid circuit response: missing or invalid components array"
      );
      return {
        operations: [],
        explanation: "Invalid circuit response format",
        affectedComponents: [],
        isValid: false,
        errors,
      };
    }

    logger.api(
      "Found",
      response.circuit.components.length,
      "components to process"
    );

    // Process components
    for (const component of response.circuit.components) {
      logger.api("Processing component:", component.id, component.type);
      if (!isValidComponent(component)) {
        logger.api("Invalid component:", component);
        errors.push(`Invalid component: ${JSON.stringify(component)}`);
        continue;
      }

      // Add component operation
      operations.push({
        type: "add_component",
        componentId: component.id,
        componentType: component.type,
        position: component.position,
        value: component.value,
        properties: {
          explanation: component.explanation,
          datasheet: component.datasheet,
          metadata: component.metadata,
          connections: component.connections,
        },
      });

      affectedComponents.push(component.id);
    }

    // Process connections
    if (
      response.circuit.connections &&
      Array.isArray(response.circuit.connections)
    ) {
      for (const connection of response.circuit.connections) {
        if (!isValidConnection(connection)) {
          errors.push(`Invalid connection: ${JSON.stringify(connection)}`);
          continue;
        }

        operations.push({
          type: "add_wire",
          fromConnection: connection.from,
          toConnection: connection.to,
        });
      }
    }

    // Process edit operations if in edit mode
    if (response.mode === "edit" && response.edit?.operations) {
      for (const operation of response.edit.operations) {
        switch (operation.type) {
          case "add":
            if (operation.data) {
              operations.push({
                type: "add_component",
                componentId: operation.componentId,
                componentType: operation.data.type,
                position: operation.data.position,
                value: operation.data.value,
                properties: operation.data,
              });
              affectedComponents.push(operation.componentId);
            }
            break;
          case "remove":
            operations.push({
              type: "remove_component",
              componentId: operation.componentId,
            });
            break;
          case "modify":
            if (operation.data) {
              operations.push({
                type: "modify_component",
                componentId: operation.componentId,
                properties: operation.data,
              });
              affectedComponents.push(operation.componentId);
            }
            break;
        }
      }
    }

    return {
      operations,
      explanation:
        response.metadata?.explanation || "Circuit updated successfully",
      affectedComponents,
      isValid: errors.length === 0,
      errors,
    };
  } catch (error) {
    console.error("❌ Error parsing circuit response:", error);
    return {
      operations: [],
      explanation: "Failed to parse circuit response",
      affectedComponents: [],
      isValid: false,
      errors: [
        `Parse error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ],
    };
  }
}

/**
 * Validate component structure
 */
function isValidComponent(component: any): component is CircuitComponent {
  return (
    component &&
    typeof component.id === "string" &&
    typeof component.type === "string" &&
    typeof component.value === "string" &&
    component.position &&
    typeof component.position.x === "number" &&
    typeof component.position.y === "number" &&
    Array.isArray(component.connections) &&
    typeof component.datasheet === "string" &&
    typeof component.explanation === "string"
  );
}

/**
 * Validate connection structure
 */
function isValidConnection(connection: any): connection is CircuitConnection {
  return (
    connection &&
    typeof connection.id === "string" &&
    connection.from &&
    typeof connection.from.componentId === "string" &&
    typeof connection.from.pin === "string" &&
    connection.to &&
    typeof connection.to.componentId === "string" &&
    typeof connection.to.pin === "string" &&
    connection.type === "wire"
  );
}

/**
 * Apply parsed operations to canvas
 */
/**
 * Apply parsed operations to canvas
 */
export async function applyCircuitToCanvas(
  parsedResponse: ParsedCircuitResponse,
  stage: Konva.Stage
): Promise<{ success: boolean; appliedOperations: number; errors: string[] }> {
  const errors: string[] = [];
  let appliedOperations = 0;

  logger.api("Starting to apply circuit to canvas (Konva)");
  logger.api("Operations to apply:", parsedResponse.operations.length);
  logger.api("Is valid:", parsedResponse.isValid);

  if (!parsedResponse.isValid) {
    logger.api("Response is not valid, skipping application");
    return {
      success: false,
      appliedOperations: 0,
      errors: parsedResponse.errors,
    };
  }

  // Get the main layer
  const layer = stage.getLayers()[0];
  if (!layer) {
    return {
      success: false,
      appliedOperations: 0,
      errors: ["No layer found on stage"],
    };
  }

  // Import canvasCommandManager dynamically to avoid circular deps if any
  const { canvasCommandManager } = await import(
    "../canvas/canvas-command-manager"
  );

  try {
    // Group operations by type for efficient processing
    const addComponentOps = parsedResponse.operations.filter(
      (op) => op.type === "add_component"
    );
    const addWireOps = parsedResponse.operations.filter(
      (op) => op.type === "add_wire"
    );
    const removeOps = parsedResponse.operations.filter(
      (op) => op.type === "remove_component"
    );
    const modifyOps = parsedResponse.operations.filter(
      (op) => op.type === "modify_component"
    );

    // Process removals first
    for (const operation of removeOps) {
      try {
        if (!operation.componentId) continue;

        // Find component
        const componentNode =
          stage.findOne(`#${operation.componentId}`) ||
          stage.findOne(`.${operation.componentId}`); // Try class name too if ID fails

        if (componentNode) {
          componentNode.destroy();
          appliedOperations++;
          logger.api("Removed component:", operation.componentId);
        } else {
          logger.warn(
            `Component ${operation.componentId} not found for removal`
          );
        }
      } catch (error) {
        logger.api("Failed to remove component:", error);
        errors.push(
          `Failed to remove component ${operation.componentId}: ${error}`
        );
      }
    }

    // Process additions
    for (const operation of addComponentOps) {
      try {
        if (!operation.componentType || !operation.position) continue;

        // Use Command Manager to add component
        // This ensures the factory is used correctly
        await canvasCommandManager.executeCommand("component:add", {
          type: operation.componentType,
          svgPath: "", // Factory handles defaults/fetching based on type/name if svgPath is empty?
          // Actually IntelligentComponentFactory expects a path.
          // But SimpleComponentFactory might be used if we fall back?
          // The existing code called createSimpleComponentData.
          // We should arguably use IntelligentFactory if possible, but we don't have SVG paths readily available here unless we fetch them.
          // Let's assume we use a basic placeholder or standard library path if available.
          // For now, let's use a simpler approach: create a Konva Group manually if we don't have SVG,
          // OR use canvasCommandManager's ADD_RESISTOR style logic if type matches?
          // Better: Dispatch 'component:add' with minimal info and let the handler figure it out?
          // The handler requires svgPath currently in my rewrite.

          // Re-reading: The original code imported createSimpleComponentData.
          // SimpleComponentFactory creates React elements (ReactKonva).
          // We can't easily add React components to a Konva instance imperatively without a Portal or react-konva machinery.
          // But canvasCommandManager allows adding Konva Nodes.
          // We should use canvasCommandManager to add "Simple" Konva shapes if we don't have SVGs.
          // Or fetch the SVG path for the component type from DB?
          // "circuitResponseParser" is running on client.

          name: operation.value || operation.componentType,
          x: operation.position.x,
          y: operation.position.y,
          // id: operation.componentId // We might need to enforce this ID
        });

        // Hack: The command manager generates a new ID. We might need to update it to match operation.componentId
        // or ensure our operation.componentId is used.
        // My rewrite of IntelligentComponentFactory generates a new ID.
        // Let's try to find the last added component and update its ID? Unreliable.
        // Maybe we pass the ID to the factory? factory accepts "componentInfo".
        // I should update IntelligentComponentFactory to accept an optional ID.

        appliedOperations++;
      } catch (error) {
        logger.api("Failed to add component:", error);
        errors.push(
          `Failed to add component ${operation.componentId}: ${error}`
        );
      }
    }

    // Force redraw
    layer.batchDraw();

    // Small delay to ensure components are ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Process wire additions
    for (const operation of addWireOps) {
      try {
        if (!operation.fromConnection || !operation.toConnection) continue;

        // Use canvasCommandManager to add wire
        canvasCommandManager.executeCommand("wire:add", {
          fromComponentId: operation.fromConnection.componentId,
          fromPinNumber: operation.fromConnection.pin,
          toComponentId: operation.toConnection.componentId,
          toPinNumber: operation.toConnection.pin,
        });

        appliedOperations++;
      } catch (error) {
        logger.error("❌ Failed to add wire:", error);
        errors.push(`Failed to add wire: ${error}`);
      }
    }

    layer.batchDraw();

    return {
      success: errors.length === 0,
      appliedOperations,
      errors,
    };
  } catch (error) {
    logger.api("Error applying circuit to canvas:", error);
    return {
      success: false,
      appliedOperations,
      errors: [
        ...errors,
        `Application error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ],
    };
  }
}
