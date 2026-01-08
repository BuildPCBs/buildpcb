/**
 * Agent Tools - The agent's abilities to interact with the PCB design
 * Each tool is a function the LLM can call to perform actions
 */

import type { AgentContext } from "../types";
import { logger } from "@/lib/logger";
import { DatabaseService } from "@/lib/database";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";
import Konva from "konva";

/**
 * Transform user-friendly queries into database-friendly search terms
 * Maps common component names to technical database naming patterns
 */
function transformComponentQuery(userQuery: string): string {
  const lower = userQuery.toLowerCase().trim();

  // Common component aliases - map user terms to database prefixes
  const aliases: Record<string, string> = {
    // Timers
    "555 timer": "NE555",
    "555": "NE555",
    timer: "NE555",

    // Voltage regulators
    "voltage regulator": "LM78",
    "7805": "LM7805",
    lm7805: "LM7805",

    // Power
    battery: "BATT",
    "9v battery": "BATT",
    "power supply": "BATT",

    // LEDs
    led: "LED",
    "light emitting diode": "LED",

    // Resistors
    resistor: "R",
    resistance: "R",

    // Capacitors
    capacitor: "C",
    cap: "C",

    // Transistors
    transistor: "Q",
    bjt: "Q",
    mosfet: "Q",

    // Op-amps
    "op amp": "LM",
    opamp: "LM",
    "operational amplifier": "LM",

    // Diodes
    diode: "D",

    // Connectors
    connector: "CONN",
    header: "CONN",
  };

  // Check for exact alias match first
  if (aliases[lower]) {
    return aliases[lower];
  }

  // Check if query contains any alias (partial match)
  for (const [alias, dbTerm] of Object.entries(aliases)) {
    if (lower.includes(alias)) {
      // If user query has additional info (like "10k resistor"), keep it
      return lower.replace(alias, dbTerm);
    }
  }

  // No transformation needed
  return userQuery;
}

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
 * Find components in the library using semantic search.
 * Returns MULTIPLE matching components with descriptions so LLM can choose the best variant.
 */
export const componentSearchTool: Tool = {
  name: "component_search",
  description:
    "Search for electronic components in the library. Returns MULTIPLE matching variants (e.g., DIP vs SMD packages, different models) with descriptions, keywords, and specifications. The LLM should review all variants and choose the most appropriate one based on the user's context (e.g., breadboard = DIP, PCB = SMD). Use this first before adding components.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Natural language search query (e.g., '555 timer', 'voltage regulator for 5V', 'LED', 'laptop components')",
      },
      limit: {
        type: "number",
        description:
          "Maximum number of variants to return (default: 8, max: 20)",
        default: 8,
      },
    },
    required: ["query"],
  },
  execute: async (
    context: AgentContext,
    args: { query: string; limit?: number }
  ) => {
    logger.debug("🔧 Tool: component_search", args);
    // Status message already shown by orchestrator

    const limit = Math.min(args.limit || 8, 20); // Max 20 variants

    // Transform user query to match database naming patterns
    const transformedQuery = transformComponentQuery(args.query);

    // Use both original and transformed keywords
    const originalKeywords = args.query.toLowerCase().split(/\s+/);
    const transformedKeywords = transformedQuery.toLowerCase().split(/\s+/);
    const allKeywords = [
      ...new Set([...originalKeywords, ...transformedKeywords]),
    ];

    // Search components_index (has rich metadata: descriptions, keywords, categories)
    const { data: indexData } = await (
      await import("@/lib/supabase")
    ).supabaseAdmin
      .from("components_index")
      .select(
        "uid, name, description, keywords, category, subcategory, pin_count, component_type"
      )
      .or(
        allKeywords
          .map(
            (keyword) =>
              `name.ilike.%${keyword}%,description.ilike.%${keyword}%,keywords.ilike.%${keyword}%`
          )
          .join(",")
      )
      .limit(limit * 2); // Get more results for better scoring

    if (!indexData || indexData.length === 0) {
      return {
        success: false,
        message: `No components found matching "${args.query}". Try different keywords like: component type, part number, or function (e.g., "555 timer", "voltage regulator", "LED").`,
      };
    }

    // Score and rank results
    const scored = indexData.map((comp: any) => {
      const nameMatches = allKeywords.filter((kw) =>
        comp.name.toLowerCase().includes(kw)
      ).length;
      const descMatches = allKeywords.filter((kw) =>
        comp.description?.toLowerCase().includes(kw)
      ).length;
      const keywordMatches = allKeywords.filter((kw) =>
        comp.keywords?.toLowerCase().includes(kw)
      ).length;
      return {
        ...comp,
        score: nameMatches * 3 + descMatches * 2 + keywordMatches,
      };
    });

    // Sort by score and take top results
    scored.sort((a, b) => b.score - a.score);
    const topResults = scored.filter((r) => r.score > 0).slice(0, limit);

    if (topResults.length === 0) {
      return {
        success: false,
        message: `No relevant components found for "${args.query}".`,
      };
    }

    logger.info("🔍 Found components via search", {
      query: args.query,
      transformed: transformedQuery,
      resultsCount: topResults.length,
      topMatch: topResults[0]?.name,
    });

    // Show user-friendly success message
    if (topResults.length === 1) {
      context.streamer.status(`✅ Found ${topResults[0].name}`);
    } else {
      context.streamer.status(`✅ Found ${topResults.length} options`);
    }

    // Return multiple variants for LLM to choose from
    return {
      success: true,
      message: `Found ${topResults.length} matching components. Review the variants below and choose the most appropriate one based on the user's needs (e.g., DIP for breadboard, SMD for PCB).`,
      components: topResults.map((comp: any) => ({
        uid: comp.uid,
        name: comp.name,
        description: comp.description || "No description available",
        keywords: comp.keywords || "",
        category: comp.category || "Uncategorized",
        subcategory: comp.subcategory || "",
        pin_count: comp.pin_count || 0,
        type: comp.component_type || "Unknown",
        match_score: comp.score,
      })),
      // Include search metadata for LLM context
      search_info: {
        original_query: args.query,
        transformed_query: transformedQuery,
        total_found: topResults.length,
      },
    };
  },
};

/**
 * Tool 2: Add Component to Canvas
 * Place a component on the canvas at specified position.
 * MUST use exact component UID from component_search results.
 */
export const addComponentTool: Tool = {
  name: "add_component",
  description:
    "Add a specific component variant to the canvas. IMPORTANT: You MUST first call component_search to get available variants, then choose the most appropriate component UID based on the user's context (e.g., breadboard = DIP package, PCB = SMD package, hobbyist = through-hole). Use the exact UID from the search results.",
  parameters: {
    type: "object",
    properties: {
      component_uid: {
        type: "string",
        description:
          "The exact UID of the chosen component variant from component_search results. Do NOT make up UIDs.",
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

    // Fetch component details by UID first, then fallback to name
    let component = null;
    const { data: componentByUid } = await (
      await import("@/lib/supabase")
    ).supabaseAdmin
      .from("components_v2")
      .select("*")
      .eq("uid", args.component_uid)
      .single();

    component = componentByUid;

    // If not found by UID, try by name (components_index uses different UIDs)
    if (!component) {
      logger.debug("Component not found by UID, trying by name...", {
        uid: args.component_uid,
      });

      // Get name from components_index
      const { data: indexComponent } = await (
        await import("@/lib/supabase")
      ).supabaseAdmin
        .from("components_index")
        .select("name")
        .eq("uid", args.component_uid)
        .single();

      if (indexComponent?.name) {
        const { data: componentByName } = await (
          await import("@/lib/supabase")
        ).supabaseAdmin
          .from("components_v2")
          .select("*")
          .eq("name", indexComponent.name)
          .single();

        component = componentByName;

        if (component) {
          logger.debug("✅ Found component by name from index", {
            name: indexComponent.name,
          });
        }
      }
    }

    if (!component) {
      return {
        success: false,
        message: `Component with uid "${args.component_uid}" not found in components_v2`,
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
    const stage = canvasCommandManager.getStage();
    const position = {
      x: args.x ?? (stage ? stage.width() / 2 : 400),
      y: args.y ?? (stage ? stage.height() / 2 : 300),
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
      rotation: args.rotation || 0,
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
      component_id: instanceId, // Note: new factory logic might override this ID internally, but we hope it doesn't or we capture it
      name: component.name,
      pins: pins,
      pin_count: pins.length,
      position: position,
      message: `✅ Added ${component.name} (ID: ${instanceId}) with ${pins.length} pins at position (${position.x}, ${position.y})`,
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
    "Get the current state of the canvas including all components, their positions, and existing wire connections. Use this to understand what's already on the canvas and what components are already connected.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async (context: AgentContext, _args: Record<string, never>) => {
    logger.debug("🔧 Tool: get_canvas_state");

    const stage = canvasCommandManager.getStage();
    if (!stage) {
      return {
        success: false,
        message: "Canvas not available",
      };
    }

    // Get components (nodes with name 'component')
    // We assume components are Groups with name 'component'
    const components = stage.find(".component");

    const componentList = components.map((comp: Konva.Node) => {
      const attrs = comp.attrs || {};
      const pins = (comp as Konva.Group).find(".pin") || [];

      return {
        id: attrs.id,
        name: attrs.componentName || attrs.name,
        type: attrs.componentType,
        position: {
          x: Math.round(comp.x()),
          y: Math.round(comp.y()),
        },
        rotation: comp.rotation(),
        pins: pins.map((p: any) => ({
          number: p.getAttr("pinNumber") || "?",
          id: p.getAttr("pinId"),
        })),
        pin_count: pins.length,
      };
    });

    // Get wires (Lines)
    // We need to identify wires. Assuming they are Lines with specific attributes
    // In circuitResponseParser we added Lines via canvasCommandManager 'wire:add'.
    // Need to check what logic creates wires and what metadata they have.
    // 'wire:add' in canvas-command-manager creates a Konva.Line.
    // We should ensure it sets metadata.
    // Assuming wires have some identifiable attribute or class.
    // If not, we iterate all Lines and check custom attrs.

    // For now, let's look for connections logic.
    // In canvas-command-manager, wire creation sets 'connectionData'.
    const lines = stage.find("Line");
    const wires = lines.filter(
      (line) => line.getAttr("connectionData") || line.hasName("wire")
    );

    const connectionList = wires
      .map((wire) => {
        const connData = wire.getAttr("connectionData");
        if (!connData) return null;

        // Find names
        const fromCompNode =
          stage.findOne(`#${connData.fromComponentId}`) ||
          stage.findOne(`.${connData.fromComponentId}`);
        const toCompNode =
          stage.findOne(`#${connData.toComponentId}`) ||
          stage.findOne(`.${connData.toComponentId}`);

        const fromName = fromCompNode
          ? fromCompNode.getAttr("componentName")
          : "Unknown";
        const toName = toCompNode
          ? toCompNode.getAttr("componentName")
          : "Unknown";

        return {
          from_component: {
            id: connData.fromComponentId,
            name: fromName,
            pin: connData.fromPinNumber,
          },
          to_component: {
            id: connData.toComponentId,
            name: toName,
            pin: connData.toPinNumber,
          },
          wire_id: wire.id(),
        };
      })
      .filter(Boolean);

    return {
      success: true,
      canvas: {
        width: stage.width(),
        height: stage.height(),
      },
      component_count: componentList.length,
      components: componentList,
      connection_count: connectionList.length,
      connections: connectionList,
      message: `Canvas has ${componentList.length} component(s) and ${connectionList.length} wire connection(s).`,
    };
  },
};

/**
 * Tool 4: Get Component Connections
 * Find all wires connected to a specific component
 */
export const getComponentConnectionsTool: Tool = {
  name: "get_component_connections",
  description:
    "Get all wire connections for a specific component. Use this when you need to know what a particular component is connected to. Requires the component's instance ID (starting with 'component_').",
  parameters: {
    type: "object",
    properties: {
      component_id: {
        type: "string",
        description:
          "The instance ID of the component to check connections for (must start with 'component_')",
      },
    },
    required: ["component_id"],
  },
  execute: async (context: AgentContext, args: { component_id: string }) => {
    logger.debug("🔧 Tool: get_component_connections", args);

    const stage = canvasCommandManager.getStage();
    if (!stage) {
      return {
        success: false,
        message: "Canvas not available",
      };
    }

    const component =
      stage.findOne(`#${args.component_id}`) ||
      stage.findOne(`.${args.component_id}`);
    if (!component) {
      return {
        success: false,
        message: `Component with ID ${args.component_id} not found`,
      };
    }

    const componentName = component.getAttr("componentName") || "Unknown";

    // Find wires
    const lines = stage.find("Line");
    const wires = lines.filter((line) => {
      const d = line.getAttr("connectionData");
      return (
        d &&
        (d.fromComponentId === args.component_id ||
          d.toComponentId === args.component_id)
      );
    });

    const connections = wires.map((wire) => {
      const d = wire.getAttr("connectionData");
      if (d.fromComponentId === args.component_id) {
        const target =
          stage.findOne(`#${d.toComponentId}`) ||
          stage.findOne(`.${d.toComponentId}`);
        return {
          direction: "outgoing",
          pin: d.fromPinNumber,
          connected_to: {
            component_id: d.toComponentId,
            component_name: target
              ? target.getAttr("componentName")
              : "Unknown",
            pin: d.toPinNumber,
          },
        };
      } else {
        const source =
          stage.findOne(`#${d.fromComponentId}`) ||
          stage.findOne(`.${d.fromComponentId}`);
        return {
          direction: "incoming",
          pin: d.toPinNumber,
          connected_from: {
            component_id: d.fromComponentId,
            component_name: source
              ? source.getAttr("componentName")
              : "Unknown",
            pin: d.fromPinNumber,
          },
        };
      }
    });

    return {
      success: true,
      component: {
        id: args.component_id,
        name: componentName,
      },
      connection_count: connections.length,
      connections: connections,
      message: `${componentName} has ${connections.length} wire connection(s).`,
    };
  },
};

/**
 * Tool 5: Draw Wire
 * Connect two component pins with a wire
 */
export const drawWireTool: Tool = {
  name: "draw_wire",
  description:
    "Draw a wire connection between two component pins. Use this to connect components electrically. IMPORTANT: You MUST use the component INSTANCE IDs (starting with 'component_') from either selected components context or get_canvas_state results.",
  parameters: {
    type: "object",
    properties: {
      from_component_id: {
        type: "string",
        description: "The INSTANCE ID of the starting component",
      },
      from_pin: {
        type: "string",
        description: "The pin number on the starting component",
      },
      to_component_id: {
        type: "string",
        description: "The INSTANCE ID of the ending component",
      },
      to_pin: {
        type: "string",
        description: "The pin number on the ending component",
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
    context.streamer.status(`Connecting components...`);

    const success = canvasCommandManager.executeCommand("wire:add", {
      fromComponentId: args.from_component_id,
      fromPinNumber: args.from_pin,
      toComponentId: args.to_component_id,
      toPinNumber: args.to_pin,
    });

    if (!success) {
      return {
        success: false,
        message:
          "Failed to draw wire. Check validation logic inside command manager.",
      };
    }

    return {
      success: true,
      message: `Wire connected from ${args.from_component_id} to ${args.to_component_id}`,
    };
  },
};

/**
 * Tool 6: Delete Component
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

    const stage = canvasCommandManager.getStage();
    if (!stage) {
      return {
        success: false,
        error: "Canvas not initialized",
      };
    }

    // Try finding by ID or class
    const node =
      stage.findOne(`#${args.component_id}`) ||
      stage.findOne(`.${args.component_id}`);
    if (node) {
      node.destroy();
      stage.batchDraw();
      return {
        success: true,
        message: `Deleted component ${args.component_id}`,
      };
    } else {
      return {
        success: false,
        message: `Component ${args.component_id} not found`,
      };
    }
  },
};

/**
 * All available tools
 */
export const allTools: Tool[] = [
  componentSearchTool,
  addComponentTool,
  getCanvasStateTool,
  getComponentConnectionsTool,
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
