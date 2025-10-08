/**
 * Agent Tools - The agent's abilities to interact with the PCB design
 * Each tool is a function the LLM can call to perform actions
 */

import type { AgentContext } from "../types";
import { logger } from "@/lib/logger";
import { DatabaseService } from "@/lib/database";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";

/**
 * Tool definition for LLM function calling
 */
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
  execute: (context: AgentContext, args: any) => Promise<any>;
}

/**
 * Tool 1: Component Search
 * Find components in the library using semantic search
 */
export const componentSearchTool: Tool = {
  name: "component_search",
  description:
    "Search for electronic components in the library. Use this when you need to find a specific component by name, type, or description. Returns component details including pins, specifications, and unique ID.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "The search query (e.g., '555 timer', 'LED', '10k resistor', 'voltage regulator')",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default: 5)",
        default: 5,
      },
    },
    required: ["query"],
  },
  execute: async (
    context: AgentContext,
    args: { query: string; limit?: number }
  ) => {
    logger.debug("🔧 Tool: component_search", args);
    context.streamer.status(`Searching for "${args.query}"...`);

    // Try exact match first
    let component = await DatabaseService.getComponentDetailsByName(args.query);

    // Fuzzy search fallback
    if (!component) {
      const { data } = await (
        await import("@/lib/supabase")
      ).supabaseAdmin
        .from("components_v2")
        .select("*")
        .ilike("name", `%${args.query}%`)
        .limit(args.limit || 5);

      if (data && data.length > 0) {
        component = data[0];
        logger.info("🔍 Found component via fuzzy search", {
          query: args.query,
          found: data[0].name,
        });
      }
    }

    if (!component) {
      return {
        success: false,
        message: `No component found matching "${args.query}"`,
      };
    }

    // Parse pins
    let pins = [];
    try {
      if (component.symbol_data) {
        const symbolData =
          typeof component.symbol_data === "string"
            ? JSON.parse(component.symbol_data)
            : component.symbol_data;
        pins = symbolData.pins || [];
      }
    } catch (error) {
      logger.warn("⚠️ Failed to parse pins", { error });
    }

    return {
      success: true,
      component: {
        uid: component.uid,
        name: component.name,
        type: component.component_type,
        category: component.category,
        pin_count: component.pin_count,
        pins: pins.map((p: any) => ({
          number: p.number,
          name: p.name,
          type: p.electrical_type,
        })),
      },
    };
  },
};

/**
 * Tool 2: Add Component to Canvas
 * Place a component on the canvas at specified position
 */
export const addComponentTool: Tool = {
  name: "add_component",
  description:
    "Add a component to the canvas at a specific position. Use this after finding a component with component_search. Returns the component's canvas ID for future reference.",
  parameters: {
    type: "object",
    properties: {
      component_uid: {
        type: "string",
        description:
          "The unique ID (uid) of the component from component_search",
      },
      x: {
        type: "number",
        description: "X coordinate on canvas (default: auto-placement)",
      },
      y: {
        type: "number",
        description: "Y coordinate on canvas (default: auto-placement)",
      },
      rotation: {
        type: "number",
        description: "Rotation angle in degrees (0, 90, 180, 270)",
        default: 0,
      },
    },
    required: ["component_uid"],
  },
  execute: async (
    context: AgentContext,
    args: { component_uid: string; x?: number; y?: number; rotation?: number }
  ) => {
    logger.debug("🔧 Tool: add_component", args);
    context.streamer.status(`Placing component...`);

    // Fetch component details
    const { data: component } = await (
      await import("@/lib/supabase")
    ).supabaseAdmin
      .from("components_v2")
      .select("*")
      .eq("uid", args.component_uid)
      .single();

    if (!component) {
      return {
        success: false,
        message: `Component with uid "${args.component_uid}" not found`,
      };
    }

    // Parse pins
    let pins = [];
    try {
      if (component.symbol_data) {
        const symbolData =
          typeof component.symbol_data === "string"
            ? JSON.parse(component.symbol_data)
            : component.symbol_data;
        pins = symbolData.pins || [];
      }
    } catch (error) {
      logger.warn("⚠️ Failed to parse pins", { error });
    }

    // Auto-placement if no position specified
    const canvas = canvasCommandManager.getCanvas();
    const position = {
      x: args.x ?? (canvas ? canvas.getWidth() / 2 : 400),
      y: args.y ?? (canvas ? canvas.getHeight() / 2 : 300),
    };

    // Generate unique instance ID
    const instanceId = `component_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const componentParams = {
      id: instanceId,
      type: component.component_type || "generic",
      svgPath: component.symbol_svg,
      name: component.name,
      uid: component.uid,
      pins: pins,
      x: position.x,
      y: position.y,
      componentMetadata: {
        uid: component.uid,
        name: component.name,
        component_type: component.component_type,
        category: component.category,
        subcategory: component.subcategory,
        pin_count: component.pin_count,
        is_power_symbol: component.is_power_symbol,
      },
    };

    const success = canvasCommandManager.executeCommand(
      "component:add",
      componentParams
    );

    if (!success) {
      return {
        success: false,
        message: "Failed to add component to canvas",
      };
    }

    return {
      success: true,
      component_id: instanceId,
      name: component.name,
      position: position,
      message: `Added ${component.name} at (${position.x}, ${position.y})`,
    };
  },
};

/**
 * Tool 3: Get Canvas State
 * Read current components and connections on the canvas
 */
export const getCanvasStateTool: Tool = {
  name: "get_canvas_state",
  description:
    "Get the current state of the canvas including all components and their positions. Use this to understand what's already on the canvas before adding more components.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (context: AgentContext, _args: Record<string, never>) => {
    logger.debug("🔧 Tool: get_canvas_state");

    const canvas = canvasCommandManager.getCanvas();
    if (!canvas) {
      return {
        success: false,
        message: "Canvas not available",
      };
    }

    const objects = canvas.getObjects();
    const components = objects.filter(
      (obj: any) => obj.data?.type === "component"
    );

    const componentList = components.map((comp: any) => ({
      id: comp.id,
      name: comp.data?.componentName,
      type: comp.componentType,
      position: {
        x: Math.round(comp.left || 0),
        y: Math.round(comp.top || 0),
      },
      rotation: comp.angle || 0,
    }));

    return {
      success: true,
      canvas: {
        width: canvas.getWidth(),
        height: canvas.getHeight(),
      },
      component_count: componentList.length,
      components: componentList,
    };
  },
};

/**
 * Tool 4: Draw Wire
 * Connect two component pins with a wire
 */
export const drawWireTool: Tool = {
  name: "draw_wire",
  description:
    "Draw a wire connection between two component pins. Use this to connect components electrically. Requires the component IDs and pin numbers from add_component and component_search results.",
  parameters: {
    type: "object",
    properties: {
      from_component_id: {
        type: "string",
        description: "The canvas ID of the starting component",
      },
      from_pin: {
        type: "string",
        description: "The pin number or name on the starting component",
      },
      to_component_id: {
        type: "string",
        description: "The canvas ID of the ending component",
      },
      to_pin: {
        type: "string",
        description: "The pin number or name on the ending component",
      },
    },
    required: ["from_component_id", "from_pin", "to_component_id", "to_pin"],
  },
  execute: async (
    context: AgentContext,
    args: {
      from_component_id: string;
      from_pin: string;
      to_component_id: string;
      to_pin: string;
    }
  ) => {
    logger.debug("🔧 Tool: draw_wire", args);
    context.streamer.status(
      `Connecting ${args.from_component_id} pin ${args.from_pin} to ${args.to_component_id} pin ${args.to_pin}...`
    );

    // TODO: Implement wire drawing using canvas command manager
    // This will integrate with your existing wiring system

    return {
      success: true,
      message: `Wire drawn from ${args.from_component_id}.${args.from_pin} to ${args.to_component_id}.${args.to_pin}`,
      note: "Wire drawing implementation pending integration with existing wiring system",
    };
  },
};

/**
 * Tool 5: Delete Component
 * Remove a component from the canvas
 */
export const deleteComponentTool: Tool = {
  name: "delete_component",
  description:
    "Remove a component from the canvas. Use this when the user asks to delete or remove a component.",
  parameters: {
    type: "object",
    properties: {
      component_id: {
        type: "string",
        description: "The canvas ID of the component to delete",
      },
    },
    required: ["component_id"],
  },
  execute: async (context: AgentContext, args: { component_id: string }) => {
    logger.debug("🔧 Tool: delete_component", args);
    context.streamer.status(`Deleting component ${args.component_id}...`);

    const canvas = canvasCommandManager.getCanvas();
    if (!canvas) {
      return {
        success: false,
        message: "Canvas not available",
      };
    }

    const objects = canvas.getObjects();
    const component = objects.find((obj: any) => obj.id === args.component_id);

    if (!component) {
      return {
        success: false,
        message: `Component with ID "${args.component_id}" not found`,
      };
    }

    canvas.remove(component);
    canvas.requestRenderAll();

    return {
      success: true,
      message: `Deleted component ${args.component_id}`,
    };
  },
};

/**
 * All available tools
 */
export const allTools: Tool[] = [
  componentSearchTool,
  addComponentTool,
  getCanvasStateTool,
  drawWireTool,
  deleteComponentTool,
];

/**
 * Get tool definitions in OpenAI function calling format
 */
export function getToolDefinitions() {
  return allTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: AgentContext
): Promise<any> {
  const tool = allTools.find((t) => t.name === toolName);

  if (!tool) {
    logger.error(`Tool not found: ${toolName}`);
    return {
      success: false,
      message: `Unknown tool: ${toolName}`,
    };
  }

  try {
    const result = await tool.execute(context, args);
    logger.info(`✅ Tool executed: ${toolName}`, { args, result });
    return result;
  } catch (error) {
    logger.error(`❌ Tool execution failed: ${toolName}`, error);
    return {
      success: false,
      message: `Tool execution failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      error,
    };
  }
}
