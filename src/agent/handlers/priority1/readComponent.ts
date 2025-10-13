import { AgentContext, AgentResult } from "../../types";
import { logger } from "@/lib/logger";

/**
 * READ_COMPONENT Handler
 * Reads component properties including metadata, pins, connections, position, and symbol
 */
export async function readComponent(
  context: AgentContext,
  prompt: string
): Promise<AgentResult> {
  logger.component("🔍 READ_COMPONENT handler started", { prompt });

  try {
    // Step 1: Find the component to read
    context.streamer.think("Looking for the component...");

    const canvasContext = context.canvas;
    if (!canvasContext.canvas) {
      const errorMsg = "Canvas not available. Please try again.";
      context.streamer.error(errorMsg);
      return { status: "error", message: errorMsg };
    }

    // Check for selected component first
    const activeObjects = canvasContext.getActiveObjects();
    let targetComponent: any = null;

    if (activeObjects.length > 0) {
      const activeObject = activeObjects[0];
      if ((activeObject as any).data?.type === "component") {
        targetComponent = activeObject;
        logger.debug("✅ Found selected component", {
          id: (activeObject as any).id,
          name: (activeObject as any).data?.name,
        });
      }
    }

    if (!targetComponent) {
      // Try to extract component name from prompt
      const componentName = extractComponentIdentifier(prompt);
      if (componentName) {
        // Search canvas for component by name
        const allObjects = canvasContext.getObjects();
        targetComponent = allObjects.find((obj: any) => {
          if (obj.data?.type === "component") {
            const objName = obj.data?.name || obj.componentType || "";
            return objName.toLowerCase().includes(componentName.toLowerCase());
          }
          return false;
        });
      }
    }

    if (!targetComponent) {
      const errorMsg =
        "No component selected or found. Please select a component or specify its name.";
      context.streamer.error(errorMsg);
      logger.warn("❌ No component found", { prompt });
      return { status: "error", message: errorMsg };
    }

    const componentData = (targetComponent as any).data;
    const componentId = (targetComponent as any).id;
    const componentName = componentData?.name || "Unknown component";

    context.streamer.status(`Reading ${componentName}...`);

    // Step 2: Gather component information
    const properties = {
      metadata: {
        id: componentId,
        name: componentName,
        type:
          componentData?.componentType ||
          (targetComponent as any).componentType,
        uid: componentData?.uid,
        category: componentData?.category,
        subcategory: componentData?.subcategory,
        pinCount: componentData?.pins?.length || 0,
      },
      position: {
        x: Math.round(targetComponent.left || 0),
        y: Math.round(targetComponent.top || 0),
      },
      pins: componentData?.pins || [],
    };

    // Step 3: Find connections from netlist
    context.streamer.status("Checking connections...");

    const connections: Array<{
      fromPin: string;
      toComponent: string;
      toPin: string;
      netId?: string;
    }> = [];

    // Get netlist from context (if available via project or canvas state)
    // For now, search canvas for wires connected to this component
    const allObjects = canvasContext.getObjects();
    const wires = allObjects.filter(
      (obj: any) => obj.wireType === "connection" && obj.connectionData
    );

    wires.forEach((wire: any) => {
      const connData = wire.connectionData;
      if (!connData) return;

      if (connData.fromComponentId === componentId) {
        connections.push({
          fromPin: connData.fromPinNumber,
          toComponent: connData.toComponentId,
          toPin: connData.toPinNumber,
        });
      } else if (connData.toComponentId === componentId) {
        connections.push({
          fromPin: connData.toPinNumber,
          toComponent: connData.fromComponentId,
          toPin: connData.fromPinNumber,
        });
      }
    });

    // Step 4: Format the response
    const hasConnections = connections.length > 0;

    let responseMessage = `**${componentName}** (${
      componentData?.componentType || "Component"
    })\\n`;
    responseMessage += `📍 Position: (${properties.position.x}, ${properties.position.y})\\n`;
    responseMessage += `🔌 Pins: ${properties.metadata.pinCount}\\n\\n`;

    if (hasConnections) {
      responseMessage += `**Connections (${connections.length}):**\\n`;

      // Group connections by pin
      const pinGroups = new Map<
        string,
        Array<{ toComponent: string; toPin: string }>
      >();
      connections.forEach((conn) => {
        if (!pinGroups.has(conn.fromPin)) {
          pinGroups.set(conn.fromPin, []);
        }
        pinGroups.get(conn.fromPin)!.push({
          toComponent: conn.toComponent,
          toPin: conn.toPin,
        });
      });

      pinGroups.forEach((targets, pin) => {
        responseMessage += `\\n• Pin ${pin}:\\n`;
        targets.forEach((target) => {
          // Try to find the target component name
          const targetObj = allObjects.find(
            (obj: any) => obj.id === target.toComponent
          );
          const targetName =
            (targetObj as any)?.data?.name || target.toComponent;
          responseMessage += `  → ${targetName} (Pin ${target.toPin})\\n`;
        });
      });
    } else {
      responseMessage += `**No connections found.** This component is not wired to any other components.`;
    }

    context.streamer.success(responseMessage);

    logger.info("✅ Component read successfully", {
      componentId,
      componentName,
      connectionCount: connections.length,
    });

    return {
      status: "success",
      message: responseMessage,
      data: {
        ...properties,
        connections,
        hasConnections,
      },
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error occurred";
    context.streamer.error(`Error reading component: ${errorMsg}`);
    logger.error("❌ READ_COMPONENT handler error", error);

    return {
      status: "error",
      message: `Failed to read component: ${errorMsg}`,
      error: error instanceof Error ? error : new Error(errorMsg),
    };
  }
}

/**
 * Extract component identifier from prompt
 */
function extractComponentIdentifier(prompt: string): string | null {
  const lowerPrompt = prompt.toLowerCase();

  // Common patterns for reading component info
  const patterns = [
    /(?:what(?:'s| is)?|tell me about|show|info(?:rmation)? (?:about|on|for)|read|check)\s+(?:the\s+)?([a-z0-9_\-]+)/i,
    /(?:component|part)\s+([a-z0-9_\-]+)/i,
    /([a-z0-9_\-]+)\s+(?:component|connections|info)/i,
    /this\s+(?:one|component)/i, // "this one" means selected component
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
    // Special case: "this one" returns null to use selected component
    if (pattern.test(lowerPrompt) && lowerPrompt.includes("this")) {
      return null; // Will use selected component
    }
  }

  return null;
}
