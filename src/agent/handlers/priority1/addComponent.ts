import { AgentContext, AgentResult } from "../../types";
import { DatabaseService } from "@/lib/database";
import { logger } from "@/lib/logger";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";
import { logPromptWithUserContext } from "@/lib/promptLogger";

/**
 * ADD_COMPONENT Handler
 * Parses component name from prompt, fetches from database, and places on canvas
 */
export async function addComponent(
  context: AgentContext,
  prompt: string
): Promise<AgentResult> {
  logger.component("🎯 ADD_COMPONENT handler started", { prompt });

  // Log the prompt (fire and forget - don't await)
  logPromptWithUserContext(
    prompt,
    "component_search",
    undefined,
    undefined,
    context.project.projectId || undefined
  );

  try {
    // Step 1: Parse component name from prompt
    context.streamer.think("Analyzing your request...");
    const componentName = extractComponentName(prompt);

    if (!componentName) {
      const errorMsg =
        "I couldn't identify which component you want to add. Please specify a component name (e.g., '555 timer', 'LED', 'resistor').";
      context.streamer.error(errorMsg);
      logger.warn("❌ Could not extract component name from prompt", {
        prompt,
      });
      return {
        status: "error",
        message: errorMsg,
      };
    }

    logger.debug("✅ Extracted component name", { componentName });

    // Step 2: Search database for component
    context.streamer.status(`Searching for "${componentName}"...`);

    // Try exact match first
    let component = await DatabaseService.getComponentDetailsByName(
      componentName
    );

    // If exact match fails, try fuzzy search in components_v2 directly
    if (!component) {
      logger.debug("🔍 Exact match failed, trying fuzzy search", {
        componentName,
      });
      context.streamer.status(
        `Exact match not found, searching similar components...`
      );

      // Search directly in components_v2 using ILIKE for fuzzy matching
      try {
        const { data, error } = await (
          await import("@/lib/supabase")
        ).supabaseAdmin
          .from("components_v2")
          .select("*")
          .ilike("name", `%${componentName}%`)
          .limit(5);

        if (!error && data && data.length > 0) {
          const foundComponent = data[0];
          component = foundComponent; // Take first match
          logger.info("🔍 Found similar component via fuzzy search", {
            searched: componentName,
            found: foundComponent.name,
          });
          context.streamer.status(
            `Found similar component: "${foundComponent.name}"`
          );
        }
      } catch (searchError) {
        logger.error("🔍 Fuzzy search failed", searchError);
      }
    }

    if (!component) {
      const errorMsg = `Component "${componentName}" not found in library. Try searching for a different component or check the spelling.`;
      context.streamer.error(errorMsg);
      logger.warn("❌ Component not found in database", { componentName });
      return {
        status: "error",
        message: errorMsg,
      };
    }

    logger.info("✅ Found component in database", {
      uid: component.uid,
      name: component.name,
      hasSvg: !!component.symbol_svg,
      hasSymbolData: !!component.symbol_data,
    });

    // Step 3: Validate component has required data
    if (!component.symbol_svg) {
      const errorMsg = `Component "${component.name}" doesn't have a visual symbol. Cannot place on canvas.`;
      context.streamer.error(errorMsg);
      logger.warn("❌ Component missing SVG symbol", {
        uid: component.uid,
        name: component.name,
      });
      return {
        status: "error",
        message: errorMsg,
      };
    }

    context.streamer.status(`Found ${component.name}! Preparing to place...`);

    // Step 4: Parse position from prompt (or use auto-placement)
    const position = extractPosition(prompt, context);
    logger.debug("📍 Component placement position", position);

    // Step 5: Place component on canvas
    context.streamer.status(`Placing ${component.name} on canvas...`);

    const canvas = canvasCommandManager.getStage();
    if (!canvas) {
      const errorMsg = "Canvas not available. Please try again.";
      context.streamer.error(errorMsg);
      logger.error("❌ Canvas not available");
      return {
        status: "error",
        message: errorMsg,
      };
    }

    // Parse pins from symbol_data (could be string or object)
    let pins = [];
    try {
      if (component.symbol_data) {
        // Check if it's already an object or needs parsing
        const symbolData =
          typeof component.symbol_data === "string"
            ? JSON.parse(component.symbol_data)
            : component.symbol_data;
        pins = symbolData.pins || [];
      }
    } catch (error) {
      logger.warn("⚠️ Failed to parse symbol_data", { error });
    }

    // Generate unique instance ID (database UID is for component type, not instance)
    const instanceId = `component_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Use the canvas command manager to add the component
    const componentParams = {
      id: instanceId, // Unique instance ID for this placement
      type: component.component_type || "generic",
      svgPath: component.symbol_svg,
      name: component.name,
      uid: component.uid, // Database UID for component type
      pins: pins,
      x: position.x,
      y: position.y,
      // Pass full component metadata for serialization
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

    logger.debug("🎨 Placing component with params", componentParams);

    // Execute the component:add command
    const success = canvasCommandManager.executeCommand(
      "component:add",
      componentParams
    );

    if (!success) {
      const errorMsg = `Failed to place ${component.name} on canvas. Please try again.`;
      context.streamer.error(errorMsg);
      logger.error("❌ Canvas command failed", { componentParams });
      return {
        status: "error",
        message: errorMsg,
      };
    }

    // Success!
    const successMsg = `Added ${component.name} to canvas at (${Math.round(
      position.x
    )}, ${Math.round(position.y)})`;
    context.streamer.success(successMsg);
    logger.info("✅ Component placed successfully", {
      name: component.name,
      uid: component.uid,
      position,
    });

    // Log successful prompt completion
    logPromptWithUserContext(
      `SUCCESS: ${prompt}`,
      "component_search",
      successMsg.length,
      undefined,
      context.project.projectId || undefined
    );

    return {
      status: "success",
      message: successMsg,
      data: {
        componentId: component.uid,
        componentName: component.name,
        position,
      },
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown error occurred";
    context.streamer.error(`Error adding component: ${errorMsg}`);
    logger.error("❌ ADD_COMPONENT handler error", error);

    // Log failed prompt
    logPromptWithUserContext(
      `ERROR: ${prompt}`,
      "component_search",
      errorMsg.length,
      undefined,
      context.project.projectId || undefined
    );

    return {
      status: "error",
      message: `Failed to add component: ${errorMsg}`,
      error: error instanceof Error ? error : new Error(errorMsg),
    };
  }
}

/**
 * Extract component name from natural language prompt
 */
function extractComponentName(prompt: string): string | null {
  const lowerPrompt = prompt.toLowerCase();

  // Common patterns for component requests
  const patterns = [
    /add\s+(?:a|an|the)?\s*([a-z0-9\s-]+?)(?:\s+to|\s+at|\s*$)/i,
    /place\s+(?:a|an|the)?\s*([a-z0-9\s-]+?)(?:\s+to|\s+at|\s*$)/i,
    /insert\s+(?:a|an|the)?\s*([a-z0-9\s-]+?)(?:\s+to|\s+at|\s*$)/i,
    /put\s+(?:a|an|the)?\s*([a-z0-9\s-]+?)(?:\s+to|\s+at|\s*$)/i,
    /create\s+(?:a|an|the)?\s*([a-z0-9\s-]+?)(?:\s+to|\s+at|\s*$)/i,
    /([a-z0-9\s-]+)\s+component/i,
    /component\s+([a-z0-9\s-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out common words that aren't component names
      const stopWords = [
        "the",
        "a",
        "an",
        "to",
        "at",
        "on",
        "in",
        "canvas",
        "board",
        "circuit",
      ];
      const filteredName = name
        .split(" ")
        .filter((word) => !stopWords.includes(word.toLowerCase()))
        .join(" ")
        .trim();

      if (filteredName) {
        return filteredName;
      }
    }
  }

  // If no pattern matches, try to extract any reasonable component name
  // (e.g., "555 timer", "LED", "resistor")
  const words = lowerPrompt.split(/\s+/);
  const componentKeywords = [
    "555",
    "led",
    "resistor",
    "capacitor",
    "transistor",
    "diode",
    "ic",
    "timer",
    "opamp",
    "regulator",
  ];

  for (const keyword of componentKeywords) {
    if (lowerPrompt.includes(keyword)) {
      // Try to extract the keyword and surrounding context
      const index = words.indexOf(keyword);
      if (index !== -1) {
        // Get keyword plus one word after (e.g., "555 timer")
        const extracted =
          index < words.length - 1
            ? `${words[index]} ${words[index + 1]}`
            : words[index];
        return extracted;
      }
    }
  }

  return null;
}

/**
 * Extract position from prompt or use auto-placement
 */
function extractPosition(
  prompt: string,
  context: AgentContext
): { x: number; y: number } {
  const lowerPrompt = prompt.toLowerCase();

  // Try to extract explicit coordinates
  // Patterns: "at x:100, y:200" or "at (100, 200)" or "x=100 y=200"
  const coordPatterns = [
    /x[:\s=]+(\d+)[,\s]+y[:\s=]+(\d+)/i,
    /\((\d+)[,\s]+(\d+)\)/,
    /at\s+(\d+)[,\s]+(\d+)/i,
  ];

  for (const pattern of coordPatterns) {
    const match = prompt.match(pattern);
    if (match && match[1] && match[2]) {
      return {
        x: parseInt(match[1], 10),
        y: parseInt(match[2], 10),
      };
    }
  }

  // Try to extract relative positions (top, bottom, left, right, center)
  const canvas = canvasCommandManager.getStage();
  if (!canvas) {
    // Default center if no canvas
    return { x: 400, y: 300 };
  }

  const canvasWidth = canvas.width();
  const canvasHeight = canvas.height();

  // Define regions
  const positions = {
    center: { x: canvasWidth / 2, y: canvasHeight / 2 },
    "top left": { x: canvasWidth * 0.25, y: canvasHeight * 0.25 },
    "top right": { x: canvasWidth * 0.75, y: canvasHeight * 0.25 },
    "bottom left": { x: canvasWidth * 0.25, y: canvasHeight * 0.75 },
    "bottom right": { x: canvasWidth * 0.75, y: canvasHeight * 0.75 },
    top: { x: canvasWidth / 2, y: canvasHeight * 0.25 },
    bottom: { x: canvasWidth / 2, y: canvasHeight * 0.75 },
    left: { x: canvasWidth * 0.25, y: canvasHeight / 2 },
    right: { x: canvasWidth * 0.75, y: canvasHeight / 2 },
  };

  // Check for position keywords
  for (const [keyword, pos] of Object.entries(positions)) {
    if (lowerPrompt.includes(keyword)) {
      logger.debug(`📍 Using relative position: ${keyword}`, pos);
      return pos;
    }
  }

  // Auto-placement: Use center with slight random offset to avoid overlap
  const randomOffset = () => (Math.random() - 0.5) * 100;
  return {
    x: canvasWidth / 2 + randomOffset(),
    y: canvasHeight / 2 + randomOffset(),
  };
}
