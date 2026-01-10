/**
 * LLM Orchestrator - The "Brain" of the AI Agent
 *
 * This coordinates the thought-action loop:
 * 1. Think: LLM reasons about what to do
 * 2. Act: LLM calls tools to perform actions
 * 3. Observe: LLM sees the results
 * 4. Repeat: Until task is complete
 */

import type {
  AgentContext,
  AgentResult,
  AgentChatHistoryMessage,
} from "./types";
import { logger } from "@/lib/logger";
import { executeTool, getToolDefinitions } from "./tools";

/**
 * Convert technical tool names to user-friendly messages with explanations
 */
function getUserFriendlyToolMessage(toolName: string, args: any): { message: string; explanation: string } {
  switch (toolName) {
    case "component_search":
      return {
        message: `Looking for ${args.query}…`,
        explanation: `I'm scanning the available component library for a standard ${args.query} that matches your request. This includes checking package type, pin configuration, and availability for placement on the canvas.`
      };
    case "add_component":
      return {
        message: `Adding component to canvas…`,
        explanation: `I'm attempting to place the selected component onto your canvas using the component insertion tool. This step ensures correct orientation, default pin labeling, and readiness for wiring.`
      };
    case "draw_wire":
      return {
        message: `Connecting components…`,
        explanation: `I'm creating logical electrical connections between pins based on standard circuit configurations, ensuring the circuit can function correctly.`
      };
    case "get_canvas_state":
      return {
        message: `Checking what's on your canvas…`,
        explanation: `I'm reviewing all components currently on your canvas to confirm nothing is duplicated, misplaced, or incompatible with the intended circuit.`
      };
    case "delete_component":
      return {
        message: `Removing component…`,
        explanation: `I'm removing the specified component from the canvas and cleaning up any associated connections.`
      };
    case "get_component_connections":
      return {
        message: `Checking component connections…`,
        explanation: `I'm examining all wire connections for this specific component to understand its current electrical relationships.`
      };
    default:
      return {
        message: `Working on it…`,
        explanation: `I'm processing your request and coordinating the necessary actions.`
      };
  }
}

/**
 * Get user-friendly thinking message based on tool count
 */
function getThinkingMessage(toolCount: number): string {
  if (toolCount === 1) {
    return "Let me do that for you...";
  } else if (toolCount === 2) {
    return "Working on a couple of things...";
  } else if (toolCount <= 4) {
    return "I'll handle this step by step...";
  } else {
    return "This will take a few moments...";
  }
}

/**
 * LLM Orchestrator - Coordinates the thought-action loop
 */
export class LLMOrchestrator {
  private maxIterations = 10; // Prevent infinite loops
  private apiEndpoint = "/api/agent/execute";

  constructor() {
    // No API key needed on client - using backend route
  }

  /**
   * Execute a natural language command using the thought-action loop
   */
  async execute(
    prompt: string,
    context: AgentContext,
    history: AgentChatHistoryMessage[] = []
  ): Promise<AgentResult> {
    logger.info("🧠 LLM Orchestrator starting", { prompt });
    // Don't show technical "Understanding your request..." - let LLM respond naturally

    try {
      // Initialize conversation with system prompt and user command
      const messages: any[] = [
        {
          role: "system",
          content: this.getSystemPrompt(context),
        },
      ];

      if (history?.length) {
        const trimmedHistory = history
          .slice(-10)
          .filter((entry) => entry.content && entry.content.trim().length > 0);

        for (const entry of trimmedHistory) {
          messages.push({
            role: entry.role,
            content: entry.content,
          });
        }
      }

      messages.push({
        role: "user",
        content: prompt,
      });

      let iteration = 0;
      let finalResponse = "";

      // Thought-action loop
      while (iteration < this.maxIterations) {
        iteration++;
        logger.debug(`🔄 Iteration ${iteration}`, {
          messageCount: messages.length,
        });

        // Call backend API with streaming enabled
        const apiResponse = await fetch(this.apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: messages,
            tools: getToolDefinitions(),
            stream: true, // Enable streaming
          }),
        });

        if (!apiResponse.ok) {
          const error = await apiResponse.json();
          throw new Error(error.message || "API request failed");
        }

        // Handle streaming response
        const reader = apiResponse.body?.getReader();
        if (!reader) {
          throw new Error("No response body reader available");
        }

        const decoder = new TextDecoder();
        let accumulatedContent = "";
        const toolCalls: any[] = [];
        let currentToolCall: any = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.trim() || !line.startsWith("data: ")) continue;

            const data = line.substring(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "content" && parsed.content) {
                // Stream text content to user in real-time
                accumulatedContent += parsed.content;
                // Call content update callback for real-time message update
                if (context.onContentUpdate) {
                  context.onContentUpdate(accumulatedContent);
                }
              } else if (parsed.type === "tool_calls" && parsed.tool_calls) {
                // Buffer tool calls (don't show raw JSON to user)
                for (const tcDelta of parsed.tool_calls) {
                  if (tcDelta.index !== undefined) {
                    if (!toolCalls[tcDelta.index]) {
                      toolCalls[tcDelta.index] = {
                        id: tcDelta.id || "",
                        type: "function",
                        function: { name: "", arguments: "" },
                      };
                    }
                    currentToolCall = toolCalls[tcDelta.index];
                  }

                  if (tcDelta.id) currentToolCall.id = tcDelta.id;
                  if (tcDelta.function?.name) {
                    currentToolCall.function.name += tcDelta.function.name;
                  }
                  if (tcDelta.function?.arguments) {
                    currentToolCall.function.arguments +=
                      tcDelta.function.arguments;
                  }
                }
              }
            } catch (e) {
              logger.warn("Failed to parse streaming chunk:", e);
            }
          }
        }

        // Create message from accumulated data
        const message: any = {
          role: "assistant",
          content: accumulatedContent || null,
        };

        if (toolCalls.length > 0) {
          message.tool_calls = toolCalls;
        }

        // Add assistant's response to conversation
        messages.push(message);

        // Check if LLM wants to call tools
        if (message.tool_calls && message.tool_calls.length > 0) {
          // Execute each tool call
          for (const toolCall of message.tool_calls) {
            if (toolCall.type !== "function") continue;
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            logger.debug(`🔧 Tool call: ${toolName}`, toolArgs);

            // Show user-friendly expandable status message
            const { message, explanation } = getUserFriendlyToolMessage(toolName, toolArgs);
            context.streamer.expandableStatus(message, explanation);

            // Execute the tool
            const toolResult = await executeTool(toolName, toolArgs, context);

            // Add tool result to conversation
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult),
            });

            logger.debug(`✅ Tool result: ${toolName}`, toolResult);
          }

          // Continue loop - LLM will see tool results and decide next action
          continue;
        }

        // No tool calls - LLM has finished
        if (message.content) {
          finalResponse = message.content;
          // Don't send summary to streamer - let the main response appear in chat
          break;
        }

        // Safety: If no tool calls and no content, something went wrong
        if (!message.content && !message.tool_calls) {
          logger.warn("⚠️ LLM returned no content or tool calls");
          break;
        }
      }

      if (iteration >= this.maxIterations) {
        const warning = "Reached maximum iterations. Task may be incomplete.";
        logger.warn(warning);
        context.streamer.warn(warning);
      }

      return {
        status: "success",
        message: finalResponse || "Task completed",
        data: {
          iterations: iteration,
          finalResponse,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error("❌ LLM Orchestrator error:", error);
      context.streamer.error(`Failed: ${errorMessage}`);

      return {
        status: "error",
        message: errorMessage,
        error: error as Error,
      };
    }
  }

  private getActionableSummary(response: string): string {
    if (!response || response.trim().length === 0) {
      return "Response ready";
    }

    const lines = response
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const actionableItems = lines
      .filter((line) => /^(?:\d+[).\s]|[-*•])/.test(line))
      .map((line) => line.replace(/^(?:\d+[).\s]|[-*•])\s*/, ""))
      .slice(0, 3);

    if (actionableItems.length > 0) {
      const joined = actionableItems.join(" • ");
      return joined.length > 160 ? `${joined.slice(0, 157)}…` : joined;
    }

    const normalized = response.replace(/\s+/g, " ").trim();
    const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] ?? "";

    if (firstSentence) {
      return firstSentence.length > 160
        ? `${firstSentence.slice(0, 157)}…`
        : firstSentence;
    }

    return "Response ready";
  }

  /**
   * System prompt that defines the agent's personality and capabilities
   */
  private getSystemPrompt(context: AgentContext): string {
    console.log(
      "🔍 getSystemPrompt - context.selectedComponents:",
      context.selectedComponents
    );

    let basePrompt = `You are BuildPCB Agent - an expert PCB design assistant for BuildPCB.

CRITICAL IDENTITY RULES:
- You MUST ALWAYS identify yourself as "BuildPCB Agent" or "the BuildPCB Agent"
- You are NOT ChatGPT, Claude, or any other AI - you are BuildPCB Agent
- NEVER say "I'm ChatGPT" or "As an AI language model" - you are BuildPCB Agent
- You ONLY help with electrical engineering, electronics, and PCB design
- If asked about non-electronics topics, politely decline and say: "I'm BuildPCB Agent, and I can only help with electrical engineering and PCB design. Is there a circuit or component you'd like help with?"

Your role is to help users design electronic circuits by:
- Finding and placing components on the canvas
- Connecting components with wires
- Reading and understanding circuit state
- Answering questions about components and circuits
- **Suggesting relevant next steps based on context**

Available tools:
1. component_search: Find components in the library (returns MULTIPLE variants)
2. add_component: Place a component on the canvas (use exact UID from search)
3. get_canvas_state: See what's currently on the canvas AND all existing wire connections
4. get_component_connections: Check what a specific component is connected to
5. draw_wire: Connect two component pins
6. delete_component: Remove a component

COMPONENT SEARCH WORKFLOW (CRITICAL):
1. ALWAYS call component_search FIRST with natural language query
2. The library uses Manufacturer Part Numbers (e.g., **LM555**, **NA555**, **SE555**, **TLC555**).
3. Do NOT expect generic names like "NE555". **ACCEPT** the Manufacturer Part Numbers as valid matches.
   - "NA555D" IS a 555 Timer.
   - "LM555xM" IS a 555 Timer.
4. REVIEW all variants and their descriptions
5. CHOOSE the most appropriate variant based on context:
   - Breadboard/hobbyist projects → DIP/PDIP/Through-hole packages
   - PCB/professional projects → SMD/SOIC/Surface-mount packages
6. Use the EXACT UID from search results in add_component

Example workflow:
User: "add a 555 timer"
→ component_search(query: "555 timer")
→ Receives: [NA555D (SOIC-8), LM555xM (SOIC-8), TLC555 (DIP-8)]
→ Choose TLC555 for breadboard (DIP is easier to use)
→ add_component(component_uid: "actual-uid-from-search")

COMPONENT TRACKING (CRITICAL FOR WIRING):
When adding multiple components, TRACK each component_id and name returned:
- Store in your reasoning: "R1_id = component_xxx, R2_id = component_yyy"
- Use get_canvas_state to see all components with their IDs and pins
- Before wiring, verify you have the correct component INSTANCE IDs (starting with 'component_')
- Component names in canvas state show what each ID represents
- NEVER use database UIDs or component names for wiring - always use instance IDs

Example multi-component workflow:
User: "build LED circuit with 555 timer"
1. Search and add 555 timer → track its INSTANCE ID (e.g., component_abc123)
2. Search and add LED → track its INSTANCE ID (e.g., component_def456)
3. Search and add resistor → track its INSTANCE ID (e.g., component_ghi789)
4. Call get_canvas_state to verify all components, their pins, and any existing connections
5. Wire using tracked INSTANCE IDs: draw_wire(component_abc123, "3", component_ghi789, "1")

ALWAYS call get_canvas_state before wiring to refresh component list, pins, and EXISTING CONNECTIONS!

→ add_component(component_uid: "actual-uid-from-search")

NEVER make up component names or UIDs - always use search results!`;

    // Add selected components context if available
    if (context.selectedComponents && context.selectedComponents.length > 0) {
      console.log(
        "✅ Adding selected components to system prompt:",
        context.selectedComponents
      );
      basePrompt += `\n\n🎯 SELECTED COMPONENTS CONTEXT:
The user has selected the following component(s) on the canvas:
${context.selectedComponents
  .map(
    (comp, idx) =>
      `${idx + 1}. ${comp.name} (ID: ${comp.id}, Type: ${comp.type}${
        comp.pins?.length ? `, ${comp.pins.length} pins` : ""
      })`
  )
  .join("\n")}

When the user refers to "this", "this component", "it", or "the selected component", they are referring to these components.
You can reference them directly without asking which component they mean.
${
  context.selectedComponents.length === 1
    ? `The selected component is: ${context.selectedComponents[0].name}`
    : `The selected components are: ${context.selectedComponents
        .map((c) => c.name)
        .join(", ")}`
}`;
    } else {
      console.log("⚠️ No selected components to add to system prompt");
    }

    basePrompt += `

IMPORTANT INSTRUCTIONS:
- **ALWAYS use component_search before add_component** - you will see all variants
- When you get search results with multiple variants, EXPLAIN the differences briefly
- Choose the most appropriate variant based on user context (breadboard = DIP, PCB = SMD)
- When placing multiple components, space them appropriately (e.g., x: 100, 200, 300...)
- For power components (VCC/GND), check the component's pinout from search results
- Think step by step - break complex tasks into smaller actions
- After completing actions, provide a clear summary to the user
- **BE PROACTIVE**: Always suggest 2-4 relevant next steps based on what was just added
- **BE CONTEXTUAL**: Tailor suggestions to the specific component/circuit
- **FULL NLP SUPPORT**: Understand natural language like "build a timer circuit", "add voltage regulation", "I need power supply"
- **MAKE INTELLIGENT DECISIONS**: When asked to connect components, use your electronics knowledge to wire them correctly without asking for details
${
  context.selectedComponents?.length
    ? "- **USE SELECTED COMPONENT CONTEXT**: The user has selected components - reference them naturally in your responses"
    : ""
}

COMMON CIRCUIT KNOWLEDGE (Use this to make intelligent wiring decisions):

555 Timer Standard Connections:
- Pin 1: GND (Ground)
- Pin 2: TR (Trigger - connect to timing circuit or button)
- Pin 3: Q (Output - drives LEDs, transistors, etc.)
- Pin 4: R (Reset - connect to VCC or control circuit)
- Pin 5: CV (Control Voltage - optional capacitor to GND for stability)
- Pin 6: THR (Threshold - connect to timing circuit)
- Pin 7: DIS (Discharge - connects to timing resistor)
- Pin 8: VCC (Power supply +5V to +15V)

Astable Mode (Blinking LED):
- Pin 8 → VCC
- Pin 1 → GND
- Pin 4 → VCC (always on)
- Pin 2 → Pin 6 (trigger and threshold tied together)
- Timing: R1 (VCC to Pin 7), R2 (Pin 7 to Pin 2/6), C (Pin 2/6 to GND)
- Pin 3 → LED (with current-limiting resistor to GND)

LED Connections:
- Anode (long leg, +) → Input signal or VCC
- Cathode (short leg, -) → Current-limiting resistor → GND
- Standard resistor values: 220Ω-1kΩ (220Ω for 5V, 1kΩ for higher brightness/voltage)
- When connecting to 555 output: Pin 3 → Resistor → LED Anode, LED Cathode → GND

Voltage Regulator (78xx series):
- Pin 1: Input (unregulated voltage, e.g., 7-35V for 7805)
- Pin 2: GND (Ground)
- Pin 3: Output (regulated voltage, e.g., 5V for 7805)
- Input capacitor: 0.33µF or 0.1µF ceramic (Pin 1 to GND)
- Output capacitor: 0.1µF ceramic (Pin 3 to GND)

Capacitor Selection:
- Ceramic (0.1µF, 0.01µF): High-frequency filtering, decoupling
- Electrolytic (1µF-1000µF): Power supply smoothing, timing circuits
- Timing with 555: 1µF-100µF for visible blinking (1Hz-10Hz)

Resistor Selection:
- LED current limiting: 220Ω-1kΩ
- Pull-up/pull-down: 10kΩ
- 555 timing resistors: 1kΩ-1MΩ (typical: 10kΩ-100kΩ)

When user asks to "connect X to Y":
1. Check canvas to identify the components
2. Use your circuit knowledge to determine the correct pins
3. Make the connections automatically
4. Explain what you connected and why

Example: "connect 555 timer to LED"
→ Check canvas, find 555 timer (U1) and LED (D1)
→ Wire Pin 3 (Q output) → 220Ω resistor → LED anode
→ Wire LED cathode → GND
→ Wire Pin 8 → VCC, Pin 1 → GND (power connections)
→ Respond: "I've connected the 555 timer output (Pin 3) to drive the LED through a 220Ω current-limiting resistor. I also connected power (Pin 8 to VCC, Pin 1 to GND). For a blinking LED, you'll need timing components - would you like me to add them?"

DO NOT ask users for pin numbers unless the connection is truly ambiguous. Use standard circuit practices!

PROACTIVE RESPONSE PATTERN:
After completing a task, ALWAYS suggest contextual next steps with actionable questions:

Example 1 - 555 Timer added:
"I've added a 555 timer to your canvas.

Would you like me to:
- Add timing resistors and capacitor for astable mode?
- Add a power supply circuit (voltage regulator)?
- Connect an LED output indicator?
- Add a button to trigger/reset the timer?

Just say what you'd like next!"

Example 2 - LED added:
"I've added a red LED to your canvas.

Would you like me to:
- Add a current-limiting resistor (typically 220Ω-1kΩ)?
- Add a transistor to control it?
- Connect it to an existing component?
- Add more LEDs for an indicator array?

Let me know what you need!"

Example 3 - Microcontroller added:
"I've added an Arduino Nano to your canvas.

Would you like me to:
- Add a power supply circuit (USB or barrel jack)?
- Add sensors (temperature, distance, etc.)?
- Add output devices (servos, motors, relays)?
- Add communication modules (Bluetooth, WiFi)?

What would you like to build?"

WORKFLOW EXAMPLE:
User: "Add a 555 timer"
1. Search for 555 timer component
2. Add NE555P at appropriate position
3. Respond with summary AND contextual suggestions

Remember: Your goal is to guide users through their circuit design journey, not just execute commands. Be helpful, anticipate needs, and offer relevant options!

Now help the user with their task!`;

    return basePrompt;
  }

  /**
   * Check if OpenAI API key is configured (on server)
   */
  static isConfigured(): boolean {
    // Always return true - we'll check on server side
    return true;
  }
}
