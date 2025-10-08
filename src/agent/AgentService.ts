import { logger } from "@/lib/logger";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";
import { useProjectStore } from "@/store/projectStore";
import { authStorage } from "@/lib/auth-storage";
import {
  AgentContext,
  AgentCanvasContext,
  AgentProjectContext,
  AgentResult,
  AgentChatHistoryMessage,
} from "./types";
import { Capability } from "./capabilities";
import { capabilityHandlers } from "./capability-handlers";
import { StreamingHandler } from "./StreamingHandler";
import { LLMOrchestrator } from "./LLMOrchestrator";
import type * as fabric from "fabric";

/**
 * AgentService - Main service for AI agent operations
 * Coordinates between canvas, project state, and AI capabilities
 */
export class AgentService {
  private streamingHandler: StreamingHandler;
  private llmOrchestrator: LLMOrchestrator | null = null;

  constructor() {
    this.streamingHandler = new StreamingHandler();

    // Initialize LLM orchestrator if API key is available
    if (LLMOrchestrator.isConfigured()) {
      this.llmOrchestrator = new LLMOrchestrator();
      logger.debug("🧠 LLM Orchestrator enabled");
    } else {
      logger.warn(
        "⚠️ LLM Orchestrator disabled - OPENAI_API_KEY not configured"
      );
    }

    logger.debug("🤖 AgentService initialized");
  }

  /**
   * Get the streaming handler for subscribing to agent messages
   */
  getStreamingHandler(): StreamingHandler {
    return this.streamingHandler;
  }

  /**
   * Build canvas context from current canvas state
   */
  private buildCanvasContext(): AgentCanvasContext {
    const canvas = canvasCommandManager.getCanvas();

    return {
      canvas: canvas,
      isCanvasReady: canvas !== null,
      getObjects: () => {
        if (!canvas) return [];
        return canvas.getObjects();
      },
      getActiveObjects: () => {
        if (!canvas) return [];
        const activeSelection = canvas.getActiveObject();
        if (!activeSelection) return [];

        // Check if it's a selection (multiple objects) or single object
        if ((activeSelection as any).type === "activeSelection") {
          return (activeSelection as any)._objects || [];
        }

        return [activeSelection];
      },
      requestRenderAll: () => {
        if (canvas) {
          canvas.requestRenderAll();
        }
      },
    };
  }

  /**
   * Build project context from current project state
   */
  private buildProjectContext(): AgentProjectContext {
    const projectState = useProjectStore.getState();

    return {
      projectId: projectState.projectId,
      versionId: projectState.versionId,
      projectName: projectState.projectName,
      circuit: projectState.circuit,
      isDirty: projectState.isDirty,
      lastSaved: projectState.lastSaved,
    };
  }

  /**
   * Get current user ID from auth storage
   */
  private getUserId(): string | undefined {
    const user = authStorage.getUser();
    return user?.id;
  }

  /**
   * Build complete agent context
   */
  private buildContext(userId?: string): AgentContext {
    const canvas = this.buildCanvasContext();
    const project = this.buildProjectContext();

    // Use provided userId or get from auth storage
    const resolvedUserId = userId || this.getUserId();

    logger.debug("🤖 Building agent context", {
      canvasReady: canvas.isCanvasReady,
      projectId: project.projectId,
      userId: resolvedUserId,
    });

    return {
      canvas,
      project,
      streamer: this.streamingHandler,
      userId: resolvedUserId,
    };
  }

  /**
   * Execute natural language command using LLM orchestrator
   * This is the NEW way - understands complex, multi-step commands
   */
  async execute(
    prompt: string,
    options: {
      userId?: string;
      history?: AgentChatHistoryMessage[];
      onContentUpdate?: (content: string) => void;
    } = {}
  ): Promise<AgentResult> {
    const { userId, history, onContentUpdate } = options;
    logger.info(`🧠 Executing natural language command`, { prompt });

    // Check if LLM orchestrator is available
    if (!this.llmOrchestrator) {
      const error =
        "LLM Orchestrator not configured. Please set OPENAI_API_KEY environment variable.";
      this.streamingHandler.error(error);
      logger.error(error);

      return {
        status: "error",
        message: error,
      };
    }

    try {
      // Build context with streaming callback
      const context = this.buildContext(userId);

      // Add content update callback to context
      if (onContentUpdate) {
        context.onContentUpdate = onContentUpdate;
      }

      // Use LLM orchestrator for multi-step reasoning and tool calling
      const result = await this.llmOrchestrator.execute(
        prompt,
        context,
        history
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`🤖 Error executing natural language command:`, error);

      this.streamingHandler.error(`Failed to execute command`, error as Error);

      return {
        status: "error",
        message: errorMessage,
        error: error as Error,
      };
    }
  }

  /**
   * Execute a capability handler (OLD way - direct capability execution)
   * Still useful for testing and simple commands
   */
  async executeCapability(
    capability: Capability,
    prompt: string,
    userId?: string
  ): Promise<AgentResult> {
    logger.info(`🤖 Executing capability: ${capability}`, { prompt });

    try {
      // Clear previous streaming messages
      this.streamingHandler.clear();

      // Build context
      const context = this.buildContext(userId);

      // Validate canvas if capability requires it
      if (this.requiresCanvas(capability) && !context.canvas.isCanvasReady) {
        const error =
          "Canvas is not ready. Please wait for the canvas to initialize.";
        this.streamingHandler.error(error);
        logger.warn(`🤖 ${capability} requires canvas but canvas not ready`);

        return {
          status: "error",
          message: error,
        };
      }

      // Get handler
      const handler =
        capabilityHandlers[capability as keyof typeof capabilityHandlers];
      if (!handler) {
        const error = `No handler found for capability: ${capability}`;
        this.streamingHandler.error(error);
        logger.error(error);

        return {
          status: "error",
          message: error,
        };
      }

      // Execute handler
      this.streamingHandler.status(`Starting ${capability}...`);

      // TypeScript workaround for complex capability type
      const result = (await (handler as any)(context, prompt)) as AgentResult;

      logger.info(`🤖 Capability ${capability} completed`, {
        status: result.status,
      });
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`🤖 Error executing ${capability}:`, error);

      this.streamingHandler.error(
        `Failed to execute ${capability}`,
        error as Error
      );

      return {
        status: "error",
        message: errorMessage,
        error: error as Error,
      };
    }
  }

  /**
   * Check if a capability requires canvas access
   */
  private requiresCanvas(capability: Capability): boolean {
    const canvasCapabilities = new Set([
      "ADD_COMPONENT",
      "READ_COMPONENT",
      "UPDATE_COMPONENT",
      "DELETE_COMPONENT",
      "HIGHLIGHT_COMPONENT",
      "CREATE_COMPONENT",
      "CREATE_WIRE",
      "DELETE_WIRE",
      "UPDATE_WIRE",
      "ZOOM_IN",
      "ZOOM_OUT",
      "PAN_CANVAS",
      "GROUP_COMPONENTS",
      "CREATE_CIRCUIT",
      "EDIT_CIRCUIT",
      "DELETE_CIRCUIT",
      "SCAFFOLD_CIRCUIT",
      "REVIEW_CIRCUIT",
    ]);

    return canvasCapabilities.has(capability as string);
  }

  /**
   * Get canvas context (useful for testing/debugging)
   */
  getCanvasContext(): AgentCanvasContext {
    return this.buildCanvasContext();
  }

  /**
   * Get project context (useful for testing/debugging)
   */
  getProjectContext(): AgentProjectContext {
    return this.buildProjectContext();
  }
}

// Export singleton instance
export const agentService = new AgentService();

// Development only: Expose to window for testing
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  // Main service interface
  (window as any).agentService = {
    // NEW: Natural language execute (uses LLM orchestrator)
    execute: async (
      prompt: string,
      options: { userId?: string; history?: AgentChatHistoryMessage[] } = {}
    ) => {
      return agentService.execute(prompt, options);
    },
    // OLD: Direct capability execution (still useful for testing)
    executeCapability: async (capability: string, prompt: string) => {
      return agentService.executeCapability(capability as Capability, prompt);
    },
    getStreamingHandler: () => agentService.getStreamingHandler(),
    subscribe: (callback: any) =>
      agentService.getStreamingHandler().subscribe(callback),
  };

  // Test utilities with more detailed access
  (window as any).agentServiceTest = {
    getCanvasContext: () => agentService.getCanvasContext(),
    getProjectContext: () => agentService.getProjectContext(),
    subscribe: (callback: any) =>
      agentService.getStreamingHandler().subscribe(callback),
    status: (msg: string) => agentService.getStreamingHandler().status(msg),
    think: (msg: string) => agentService.getStreamingHandler().think(msg),
    progress: (current: number, total: number, msg?: string) =>
      agentService.getStreamingHandler().progress(current, total, msg),
    error: (msg: string) => agentService.getStreamingHandler().error(msg),
    success: (msg: string) => agentService.getStreamingHandler().success(msg),
    warn: (msg: string) => agentService.getStreamingHandler().warn(msg),
    executeCapability: async (capability: string, prompt: string) => {
      return agentService.executeCapability(capability as Capability, prompt);
    },
  };
  logger.debug(
    "🧪 agentService + agentServiceTest exposed to window for testing"
  );
}
