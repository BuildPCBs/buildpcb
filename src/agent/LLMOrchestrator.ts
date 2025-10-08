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
import { getToolDefinitions, executeTool } from "./tools";

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
    context.streamer.think("Understanding your request...");

    try {
      // Initialize conversation with system prompt and user command
      const messages: any[] = [
        {
          role: "system",
          content: this.getSystemPrompt(),
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
        let toolCalls: any[] = [];
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
          // LLM decided to use tools
          context.streamer.think(
            `Executing ${message.tool_calls.length} action(s)...`
          );

          // Execute each tool call
          for (const toolCall of message.tool_calls) {
            if (toolCall.type !== "function") continue;
            const toolName = toolCall.function.name;
            const toolArgs = JSON.parse(toolCall.function.arguments);

            logger.debug(`🔧 Tool call: ${toolName}`, toolArgs);
            context.streamer.status(`Running ${toolName}...`);

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
          const summary = this.getActionableSummary(finalResponse);
          context.streamer.success(summary);
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
  private getSystemPrompt(): string {
    return `You are an expert PCB design assistant for BuildPCB - helpful, proactive, and contextually aware.

Your role is to help users design electronic circuits by:
- Finding and placing components on the canvas
- Connecting components with wires
- Reading and understanding circuit state
- Answering questions about components and circuits
- **Suggesting relevant next steps based on context**

Available tools:
1. component_search: Find components in the library
2. add_component: Place a component on the canvas
3. get_canvas_state: See what's currently on the canvas
4. draw_wire: Connect two component pins
5. delete_component: Remove a component

IMPORTANT INSTRUCTIONS:
- Always search for components before adding them (use component_search first, then add_component)
- When placing multiple components, space them appropriately (e.g., x: 100, 200, 300...)
- For power components (VCC/GND), check the component's pinout from search results
- Think step by step - break complex tasks into smaller actions
- After completing actions, provide a clear summary to the user
- **BE PROACTIVE**: Always suggest 2-4 relevant next steps based on what was just added
- **BE CONTEXTUAL**: Tailor suggestions to the specific component/circuit
- If you're unsure about a component's specifications, search for it first

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
  }

  /**
   * Check if OpenAI API key is configured (on server)
   */
  static isConfigured(): boolean {
    // Always return true - we'll check on server side
    return true;
  }
}
