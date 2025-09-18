"use client";

import * as fabric from "fabric";
import { ComponentData, ConnectionData } from "../hooks/useCanvasState";
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
export async function applyCircuitToCanvas(
  parsedResponse: ParsedCircuitResponse,
  canvas: fabric.Canvas
): Promise<{ success: boolean; appliedOperations: number; errors: string[] }> {
  const errors: string[] = [];
  let appliedOperations = 0;

  logger.api("Starting to apply circuit to canvas");
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

    logger.api("Operation breakdown:");
    logger.api("  - Add components:", addComponentOps.length);
    logger.api("  - Add wires:", addWireOps.length);
    logger.api("  - Remove components:", removeOps.length);
    logger.api("  - Modify components:", modifyOps.length);

    // Process removals first
    for (const operation of removeOps) {
      try {
        logger.api("Removing component:", operation.componentId);
        await removeComponentFromCanvas(operation.componentId!, canvas);
        appliedOperations++;
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
        logger.api(
          "Adding component:",
          operation.componentId,
          operation.componentType
        );
        await addComponentToCanvas(operation, canvas);
        appliedOperations++;
      } catch (error) {
        logger.api("Failed to add component:", error);
        errors.push(
          `Failed to add component ${operation.componentId}: ${error}`
        );
      }
    }

    // Process modifications
    for (const operation of modifyOps) {
      try {
        await modifyComponentOnCanvas(operation, canvas);
        appliedOperations++;
      } catch (error) {
        errors.push(
          `Failed to modify component ${operation.componentId}: ${error}`
        );
      }
    }

    // Small delay to ensure components are fully added before creating wires
    logger.api("Waiting for components to be fully added...");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Force canvas render to ensure all components are visible
    canvas.renderAll();

    // Process wire additions last
    for (const operation of addWireOps) {
      try {
        logger.api(
          "Adding wire from",
          operation.fromConnection,
          "to",
          operation.toConnection
        );
        await addWireToCanvas(operation, canvas);
        appliedOperations++;
      } catch (error) {
        console.error("❌ Failed to add wire:", error);
        errors.push(`Failed to add wire: ${error}`);
      }
    }

    logger.api("Circuit application complete:");
    logger.api("  - Applied operations:", appliedOperations);
    logger.api("  - Errors:", errors.length);

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

/**
 * Add component to canvas using component factory
 */
async function addComponentToCanvas(
  operation: CanvasOperation,
  canvas: fabric.Canvas
): Promise<void> {
  logger.api(
    "Creating component:",
    operation.componentType,
    "at position:",
    operation.position
  );

  if (!operation.componentType || !operation.position) {
    logger.api("Missing component type or position");
    throw new Error("Missing component type or position");
  }

  // Import component factory dynamically to avoid circular dependencies
  const { createSimpleComponent } = await import(
    "../canvas/SimpleComponentFactory"
  );

  logger.api("Calling createSimpleComponent with:", {
    type: operation.componentType,
    name: operation.value || operation.componentType,
    x: operation.position.x,
    y: operation.position.y,
  });

  // Create component using factory (it adds to canvas internally)
  createSimpleComponent(canvas, {
    type: operation.componentType,
    svgPath: "", // We'll use the default styling
    name: operation.value || operation.componentType,
    x: operation.position.x,
    y: operation.position.y,
    id: operation.componentId, // Pass the component ID for wire connections
  });

  logger.api("Component created and added to canvas");

  // The function adds to canvas internally, so we just need to render
  canvas.renderAll();
}

/**
 * Remove component from canvas with proper wire cleanup
 */
async function removeComponentFromCanvas(
  componentId: string,
  canvas: fabric.Canvas
): Promise<void> {
  const objects = canvas.getObjects();
  const componentToRemove = objects.find(
    (obj) =>
      obj.get("id") === componentId || obj.get("objectId") === componentId
  );

  if (componentToRemove) {
    // Trigger a custom event that the canvas can handle with proper cleanup
    const deleteEvent = new CustomEvent("deleteComponent", {
      detail: { componentId, component: componentToRemove },
    });
    window.dispatchEvent(deleteEvent);

    // Fallback: basic removal if no event handler
    canvas.remove(componentToRemove);
    canvas.renderAll();

    console.log(`Component ${componentId} removed from canvas`);
  } else {
    console.warn(`Component ${componentId} not found on canvas`);
  }
}

/**
 * Modify existing component on canvas
 */
async function modifyComponentOnCanvas(
  operation: CanvasOperation,
  canvas: fabric.Canvas
): Promise<void> {
  if (!operation.componentId) {
    throw new Error("Missing component ID for modification");
  }

  const objects = canvas.getObjects();
  const componentToModify = objects.find(
    (obj) =>
      obj.get("id") === operation.componentId ||
      obj.get("objectId") === operation.componentId
  );

  if (componentToModify && operation.properties) {
    // Apply property changes
    Object.keys(operation.properties).forEach((key) => {
      componentToModify.set(key, operation.properties![key]);
    });

    canvas.renderAll();
  } else {
    throw new Error(
      `Component ${operation.componentId} not found or no properties to modify`
    );
  }
}

/**
 * Add wire connection to canvas
 */
async function addWireToCanvas(
  operation: CanvasOperation,
  canvas: fabric.Canvas
): Promise<void> {
  if (!operation.fromConnection || !operation.toConnection) {
    throw new Error("Missing connection information for wire");
  }

  // Find the actual component objects on canvas
  const objects = canvas.getObjects();
  logger.api("Looking for components on canvas:");
  logger.api("  - Total objects on canvas:", objects.length);
  logger.api(
    "  - Looking for fromComponent:",
    operation.fromConnection!.componentId
  );
  logger.api(
    "  - Looking for toComponent:",
    operation.toConnection!.componentId
  );

  // Debug: List all component IDs on canvas
  objects.forEach((obj, index) => {
    const objId = obj.get("id") || obj.get("objectId");
    const componentType = obj.get("componentType");
    if (objId || componentType) {
      logger.api(`  - Object ${index}: id=${objId}, type=${componentType}`);
    }
  });

  const fromComponent = objects.find(
    (obj) =>
      obj.get("id") === operation.fromConnection!.componentId ||
      obj.get("objectId") === operation.fromConnection!.componentId
  );

  const toComponent = objects.find(
    (obj) =>
      obj.get("id") === operation.toConnection!.componentId ||
      obj.get("objectId") === operation.toConnection!.componentId
  );

  logger.api("Search results:");
  logger.api("  - fromComponent found:", !!fromComponent);
  logger.api("  - toComponent found:", !!toComponent);

  if (fromComponent && toComponent) {
    // Create a simple wire between component centers for now
    const fromCenter = fromComponent.getCenterPoint();
    const toCenter = toComponent.getCenterPoint();

    // Create wire points (simple straight line for now)
    const points = [
      new fabric.Point(fromCenter.x, fromCenter.y),
      new fabric.Point(toCenter.x, toCenter.y),
    ];

    // Create the wire
    const wire = new fabric.Polyline(points, {
      fill: "transparent",
      stroke: "#888888",
      strokeWidth: 2,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      selectable: true,
      evented: true,
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      hasControls: false,
      hasBorders: true,
      wireType: "connection",
      startComponent: fromComponent,
      endComponent: toComponent,
      clipPath: undefined,
      objectCaching: false,
    } as any);

    canvas.add(wire);
    canvas.renderAll();
  } else {
    throw new Error("Could not find components for wire connection");
  }
}
