/**
 * Agent Tools - The agent's abilities to interact with the PCB design
 * Each tool is a function the LLM can call to perform actions
 */

import type { AgentContext } from "../types";
import { logger } from "@/lib/logger";
import { DatabaseService } from "@/lib/database";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";
import * as fabric from "fabric";

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

    const componentList = components.map((comp: any) => {
      // Extract pin information from the component group
      const pins: Array<{ number: string; name?: string }> = [];
      if (comp.type === "group") {
        const groupObjects = (comp as fabric.Group).getObjects();
        groupObjects.forEach((obj: any) => {
          if (obj.data?.type === "pin") {
            pins.push({
              number: obj.data.pinNumber?.toString() || "?",
              name: obj.data.pinName || undefined,
            });
          }
        });
      }

      return {
        id: comp.id,
        name: comp.data?.componentName,
        type: comp.componentType,
        position: {
          x: Math.round(comp.left || 0),
          y: Math.round(comp.top || 0),
        },
        rotation: comp.angle || 0,
        pins: pins.sort((a, b) => parseInt(a.number) - parseInt(b.number)),
        pin_count: pins.length,
      };
    });

    // Extract wire/connection information
    const wires = objects.filter(
      (obj: any) => obj.wireType === "connection" || obj.connectionData
    );

    const connectionList = wires
      .map((wire: any) => {
        const connData = wire.connectionData;
        if (!connData) return null;

        // Find component names for better readability
        const fromComponent = componentList.find(
          (c) => c.id === connData.fromComponentId
        );
        const toComponent = componentList.find(
          (c) => c.id === connData.toComponentId
        );

        return {
          from_component: {
            id: connData.fromComponentId,
            name: fromComponent?.name || "Unknown",
            pin: connData.fromPinNumber,
          },
          to_component: {
            id: connData.toComponentId,
            name: toComponent?.name || "Unknown",
            pin: connData.toPinNumber,
          },
          wire_id: wire.id || `wire_${Math.random().toString(36).substr(2, 9)}`,
        };
      })
      .filter(Boolean);

    return {
      success: true,
      canvas: {
        width: canvas.getWidth(),
        height: canvas.getHeight(),
      },
      component_count: componentList.length,
      components: componentList,
      connection_count: connectionList.length,
      connections: connectionList,
      message: `Canvas has ${componentList.length} component(s) and ${connectionList.length} wire connection(s). Each component listed with its ID, name, and available pins. All existing connections are shown.`,
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

    const canvas = canvasCommandManager.getCanvas();
    if (!canvas) {
      return {
        success: false,
        message: "Canvas not available",
      };
    }

    const objects = canvas.getObjects();

    // Find the component
    const component = objects.find(
      (obj: any) =>
        obj.data?.type === "component" &&
        (obj.id === args.component_id || obj.objectId === args.component_id)
    );

    if (!component) {
      return {
        success: false,
        message: `Component with ID ${args.component_id} not found on canvas`,
      };
    }

    const componentName =
      (component as any).data?.componentName || "Unknown Component";

    // Find all wires connected to this component
    const wires = objects.filter(
      (obj: any) => obj.wireType === "connection" || obj.connectionData
    );

    const connections = wires
      .map((wire: any) => {
        const connData = wire.connectionData;
        if (!connData) return null;

        // Check if this wire is connected to our target component
        if (connData.fromComponentId === args.component_id) {
          // This component is the source
          const toComponent = objects.find(
            (obj: any) =>
              obj.data?.type === "component" &&
              (obj.id === connData.toComponentId ||
                obj.objectId === connData.toComponentId)
          );
          const toComponentName = toComponent
            ? (toComponent as any).data?.componentName || "Unknown"
            : "Unknown";

          return {
            direction: "outgoing",
            pin: connData.fromPinNumber,
            connected_to: {
              component_id: connData.toComponentId,
              component_name: toComponentName,
              pin: connData.toPinNumber,
            },
          };
        } else if (connData.toComponentId === args.component_id) {
          // This component is the destination
          const fromComponent = objects.find(
            (obj: any) =>
              obj.data?.type === "component" &&
              (obj.id === connData.fromComponentId ||
                obj.objectId === connData.fromComponentId)
          );
          const fromComponentName = fromComponent
            ? (fromComponent as any).data?.componentName || "Unknown"
            : "Unknown";

          return {
            direction: "incoming",
            pin: connData.toPinNumber,
            connected_from: {
              component_id: connData.fromComponentId,
              component_name: fromComponentName,
              pin: connData.fromPinNumber,
            },
          };
        }

        return null;
      })
      .filter(Boolean);

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
    "Draw a wire connection between two component pins. Use this to connect components electrically. IMPORTANT: You MUST use the component INSTANCE IDs (starting with 'component_') from either selected components context or get_canvas_state results. NEVER use database UIDs or component names. If components are selected (check SELECTED COMPONENTS CONTEXT in system prompt), use their IDs directly. Otherwise, use get_canvas_state to find component IDs first. Requires exact component instance IDs and pin numbers.",
  parameters: {
    type: "object",
    properties: {
      from_component_id: {
        type: "string",
        description:
          "The INSTANCE ID of the starting component (must start with 'component_', from selected components or get_canvas_state)",
      },
      from_pin: {
        type: "string",
        description:
          "The pin number on the starting component (e.g., '1', '2', '3')",
      },
      to_component_id: {
        type: "string",
        description:
          "The INSTANCE ID of the ending component (must start with 'component_', from selected components or get_canvas_state)",
      },
      to_pin: {
        type: "string",
        description:
          "The pin number on the ending component (e.g., '1', '2', 'A', 'K')",
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

    // Clean component names for user display (remove _unit1, _unit2, etc.)
    const cleanName = (name: string) => name.replace(/_unit\d+$/i, "");
    const fromName = cleanName(args.from_component_id);
    const toName = cleanName(args.to_component_id);

    context.streamer.status(
      `Connecting ${fromName} pin ${args.from_pin} to ${toName} pin ${args.to_pin}...`
    );

    const canvas = context.canvas.canvas;
    if (!canvas) {
      return {
        success: false,
        message: "Canvas not available",
      };
    }

    // Helper function to find a pin on a component
    const findPin = (
      componentId: string,
      pinNumber: string
    ): fabric.Object | null => {
      const objects = canvas.getObjects();

      logger.wire(`Looking for component ${componentId} pin ${pinNumber}`);

      for (const obj of objects) {
        if (obj.type === "group") {
          const group = obj as fabric.Group;
          const groupObjects = group.getObjects();

          // Check if this is the right component by multiple possible ID fields
          const objId = (obj as any).id;
          const objObjectId = (obj as any).objectId;
          const objUid = (obj as any).data?.componentMetadata?.uid;
          const objName = (obj as any).data?.componentName;

          const isRightComponent =
            objId === componentId ||
            objObjectId === componentId ||
            objUid === componentId ||
            (componentId.startsWith("component_") && objId === componentId) ||
            (componentId.startsWith("component_") &&
              objObjectId === componentId);

          logger.wire(
            `Checking component: id=${objId}, objectId=${objObjectId}, uid=${objUid}, name=${objName}, isMatch=${isRightComponent}`
          );

          if (isRightComponent) {
            logger.wire(`Found matching component ${objId} for ${componentId}`);
            // Find the pin within this component
            for (const child of groupObjects) {
              const pinData = (child as any).data;
              if (
                pinData?.type === "pin" &&
                pinData?.pinNumber?.toString() === pinNumber
              ) {
                logger.wire(
                  `Found pin ${pinNumber} on component ${componentId}`
                );
                return child;
              }
            }
            logger.wire(
              `Pin ${pinNumber} not found on component ${componentId}`
            );
          }
        }
      }

      logger.wire(`Component ${componentId} not found on canvas`);
      return null;
    };

    // Helper to get absolute pin position
    const getPinWorldCoordinates = (pin: fabric.Object) => {
      const identityMatrix = [1, 0, 0, 1, 0, 0] as fabric.TMat2D;
      return fabric.util.transformPoint(
        new fabric.Point(pin.left || 0, pin.top || 0),
        pin.group?.calcTransformMatrix() || identityMatrix
      );
    };

    try {
      // Find both pins
      const fromPin = findPin(args.from_component_id, args.from_pin);
      const toPin = findPin(args.to_component_id, args.to_pin);

      if (!fromPin) {
        // Get available components for better error message
        const availableComponents = canvas
          .getObjects()
          .filter((obj: any) => obj.data?.type === "component")
          .map((obj: any) => ({
            id: obj.id,
            name: obj.data?.componentName,
            uid: obj.data?.componentMetadata?.uid,
          }));

        logger.wire("Available components:", availableComponents);

        return {
          success: false,
          message: `Pin ${args.from_pin} not found on component ${cleanName(
            args.from_component_id
          )}. Make sure you're using the correct INSTANCE ID (starting with 'component_') from get_canvas_state, not a database UID. Available components: ${availableComponents
            .map((c) => `${c.name} (${c.id})`)
            .join(", ")}`,
        };
      }

      if (!toPin) {
        return {
          success: false,
          message: `Pin ${args.to_pin} not found on component ${cleanName(
            args.to_component_id
          )}. Make sure you're using the correct INSTANCE ID (starting with 'component_') from get_canvas_state, not a database UID.`,
        };
      }

      // Get pin positions
      const fromCoords = getPinWorldCoordinates(fromPin);
      const toCoords = getPinWorldCoordinates(toPin);

      logger.wire("Creating wire between pins", {
        from: {
          component: args.from_component_id,
          pin: args.from_pin,
          coords: fromCoords,
          pinGroupId: fromPin.group ? (fromPin.group as any).id : "no-group",
          pinGroupDataId: fromPin.group
            ? (fromPin.group as any).data?.componentId
            : "no-data",
        },
        to: {
          component: args.to_component_id,
          pin: args.to_pin,
          coords: toCoords,
          pinGroupId: toPin.group ? (toPin.group as any).id : "no-group",
          pinGroupDataId: toPin.group
            ? (toPin.group as any).data?.componentId
            : "no-data",
        },
      });

      // Create orthogonal wire path (KiCad style: horizontal then vertical, or vertical then horizontal)
      const dx = toCoords.x - fromCoords.x;
      const dy = toCoords.y - fromCoords.y;

      let pathData = `M ${fromCoords.x} ${fromCoords.y}`;

      // Choose path direction based on which is longer
      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal first, then vertical
        if (Math.abs(dx) > 1) {
          pathData += ` L ${toCoords.x} ${fromCoords.y}`;
        }
        if (Math.abs(dy) > 1) {
          pathData += ` L ${toCoords.x} ${toCoords.y}`;
        }
      } else {
        // Vertical first, then horizontal
        if (Math.abs(dy) > 1) {
          pathData += ` L ${fromCoords.x} ${toCoords.y}`;
        }
        if (Math.abs(dx) > 1) {
          pathData += ` L ${toCoords.x} ${toCoords.y}`;
        }
      }

      // Create wire path
      const wire = new fabric.Path(pathData, {
        stroke: "#0038DF",
        strokeWidth: 1,
        fill: "",
        selectable: false,
        hasControls: false,
        hasBorders: false,
        evented: false,
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });

      // Add connection metadata
      (wire as any).connectionData = {
        fromComponentId: args.from_component_id,
        fromPinNumber: args.from_pin,
        toComponentId: args.to_component_id,
        toPinNumber: args.to_pin,
      };

      (wire as any).wireType = "connection";

      // Add wire to canvas
      canvas.add(wire);

      // CRITICAL: Register wire with the wiring tool so it updates when components move
      const wiringTool = (window as any).__wiringTool;
      if (wiringTool && wiringTool.registerRestoredWire) {
        wiringTool.registerRestoredWire(
          wire,
          args.from_component_id,
          args.from_pin,
          args.to_component_id,
          args.to_pin
        );
        logger.wire(
          "✅ Wire registered with wiring tool for movement tracking"
        );
      } else {
        logger.warn(
          "⚠️ Wiring tool not available - wire won't update on component movement"
        );
      }

      // Create endpoint dots
      const fromDot = new fabric.Circle({
        left: fromCoords.x,
        top: fromCoords.y,
        radius: 2,
        fill: "#0038DF",
        stroke: "",
        selectable: false,
        evented: false,
        originX: "center",
        originY: "center",
      });
      (fromDot as any).wireEndpoint = true;
      (fromDot as any).pinConnection = true;

      const toDot = new fabric.Circle({
        left: toCoords.x,
        top: toCoords.y,
        radius: 2,
        fill: "#0038DF",
        stroke: "",
        selectable: false,
        evented: false,
        originX: "center",
        originY: "center",
      });
      (toDot as any).wireEndpoint = true;
      (toDot as any).pinConnection = true;

      canvas.add(fromDot);
      canvas.add(toDot);

      canvas.renderAll();

      logger.wire("✅ Wire created successfully");

      return {
        success: true,
        message: `Wire connected from ${cleanName(args.from_component_id)}.${
          args.from_pin
        } to ${cleanName(args.to_component_id)}.${args.to_pin}`,
        wire_id: (wire as any).id,
      };
    } catch (error) {
      logger.error("Failed to draw wire", error);

      return {
        success: false,
        message: `Failed to draw wire from ${cleanName(
          args.from_component_id
        )} to ${cleanName(args.to_component_id)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error,
      };
    }
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

    // Use proper deletion via custom event (triggers handleObjectDeletion with wire cleanup)
    window.dispatchEvent(
      new CustomEvent("deleteComponent", {
        detail: { component },
      })
    );

    // Note: The actual deletion happens in the event handler which also:
    // - Removes connected wires
    // - Cleans up junction dots
    // - Updates netlist
    // - Saves undo/redo state

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
