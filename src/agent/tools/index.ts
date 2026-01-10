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
    ne555: "555",
    lm555: "555",
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
    "Search for electronic components in the library. Returns MULTIPLE matching variants. NOTE: The library uses specific Manufacturer Part Numbers (e.g., 'LM555', 'NA555', 'SN74HC00') rather than generic names. You MUST accept these specific part numbers as valid matches for generic requests (e.g., accept 'NA555D' or 'LM555xM' when looking for a '555 timer').",
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

    // Search components table (correct table name!)
    const { data: indexData, error: queryError } = await (
      await import("@/lib/supabase")
    ).supabaseAdmin
      .from("component_summary")
      .select("id, name, description, keywords, library, pin_count")
      .or(
        allKeywords
          .map(
            (keyword) =>
              `name.ilike.%${keyword}%,description.ilike.%${keyword}%,keywords.ilike.%${keyword}%`
          )
          .join(",")
      )
      .limit(limit * 2); // Get more results for better scoring

    // CRITICAL: Log the query details and any errors
    logger.info("🔍 Component search query details", {
      originalQuery: args.query,
      transformedQuery,
      allKeywords,
      hasError: !!queryError,
      errorMessage: queryError?.message,
      hasData: !!indexData,
      dataLength: indexData?.length || 0,
    });

    if (!indexData || indexData.length === 0) {
      logger.warn("❌ Component search returned no results", {
        query: args.query,
        transformed: transformedQuery,
        keywords: allKeywords,
      });
      return {
        success: false,
        message: `No components found matching "${args.query}". Try different keywords like: component type, part number, or function (e.g., "555 timer", "voltage regulator", "LED").`,
      };
    }

    // Score and rank results with improved algorithm
    const scored = indexData.map((comp: any) => {
      const lowerName = comp.name.toLowerCase();
      const lowerDesc = comp.description?.toLowerCase() || "";
      const lowerKeywords = comp.keywords?.toLowerCase() || "";
      const lowerLibrary = comp.library?.toLowerCase() || "";

      let score = 0;

      // Better scoring: prioritize exact matches and word boundaries
      for (const kw of allKeywords) {
        const kwLower = kw.toLowerCase();

        // Exact name match (highest priority)
        if (lowerName === kwLower) score += 100;
        // Name starts with keyword
        else if (lowerName.startsWith(kwLower)) score += 50;
        // Name contains keyword
        else if (lowerName.includes(kwLower)) score += 10;

        // Library match (e.g., "timer" matching library="Timer")
        if (lowerLibrary.includes(kwLower)) score += 20;

        // Keywords match
        if (lowerKeywords.includes(kwLower)) score += 15;

        // Description match (lowest priority)
        if (lowerDesc.includes(kwLower)) score += 5;
      }

      return {
        ...comp,
        score,
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

    // Map summary rows to canonical component UUIDs by id (uuid-to-uuid)
    const idList = topResults.map((comp) => comp.id);

    const supabase = (await import("@/lib/supabase")).supabaseAdmin;

    const { data: byId, error: byIdError } = await supabase
      .from("components")
      .select("id")
      .in("id", idList);

    if (byIdError) {
      logger.warn("⚠️ Failed to map component ids to UUIDs", { byIdError });
    }

    const uuidById = new Map<string, string>();

    byId?.forEach((row: { id: string }) => {
      uuidById.set(row.id, row.id);
    });

    // Return multiple variants for LLM to choose from
    const mappedComponents = topResults
      .filter((comp: any) => uuidById.has(comp.id))
      .map((comp: any) => ({
        uid: uuidById.get(comp.id)!,
        name: comp.name,
        description: comp.description || "No description available",
        keywords: comp.keywords || "",
        library: comp.library || "Unknown",
        pin_count: comp.pin_count || 0,
        match_score: comp.score,
      }));

    if (mappedComponents.length === 0) {
      logger.warn("❌ No components mapped by UUID", { idList });
      return {
        success: false,
        message: "No components could be mapped to canonical UUIDs.",
      };
    }

    return {
      success: true,
      message: `Found ${mappedComponents.length} matching components. Review the variants below and choose the most appropriate one based on the user's needs (e.g., DIP for breadboard, SMD for PCB).`,
      components: mappedComponents,
      // Include search metadata for LLM context
      search_info: {
        original_query: args.query,
        transformed_query: transformedQuery,
        total_found: mappedComponents.length,
      },
    };
  },
};

/**
 * Tool 2: Add Component to Canvas
 * Place a component on the canvas at specified position.
 * MUST use exact component ID from component_search results.
 */
export const addComponentTool: Tool = {
  name: "add_component",
  description:
    "Add a specific component variant to the canvas. IMPORTANT: You MUST first call component_search to get available variants, then choose the most appropriate component ID based on the user's context (e.g., breadboard = DIP package, PCB = SMD package, hobbyist = through-hole). Use the exact ID from the search results.",
  parameters: {
    type: "object",
    properties: {
      component_uid: {
        type: "string",
        description:
          "The exact ID of the chosen component variant from component_search results. Do NOT make up IDs.",
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
    context.streamer.status(`Adding component to canvas…`);

    // Validate ID is a UUID to avoid invalid queries
    const uuidPattern =
      /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$/;
    if (!uuidPattern.test(args.component_uid)) {
      logger.error("❌ Invalid component id (not a UUID)", {
        id: args.component_uid,
      });
      context.streamer.error(
        `Component id is not a valid UUID: "${args.component_uid}"`
      );
      return {
        success: false,
        message: `Component id is not a valid UUID: "${args.component_uid}"`,
      };
    }

    // Fetch component details by ID
    let component = null;
    const { data: componentByUid, error: fetchError } = await (
      await import("@/lib/supabase")
    ).supabaseAdmin
      .from("components")
      .select("*")
      .eq("id", args.component_uid)
      .single();

    component = componentByUid;

    if (!component) {
      logger.error("❌ Component not found", {
        id: args.component_uid,
        fetchError,
      });

      context.streamer.error(
        `Component not found for id "${args.component_uid}"`
      );

      return {
        success: false,
        message: `Component with id "${args.component_uid}" not found in database`,
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
      type: "generic", // Components table doesn't have component_type
      name: component.name,
      // No SVG path - components use symbol_data with graphics instead
      symbol_data: component.symbol_data,
      pins: pins,
      x: position.x,
      y: position.y,
      rotation: args.rotation || 0,
      componentMetadata: {
        uid: component.id,
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
