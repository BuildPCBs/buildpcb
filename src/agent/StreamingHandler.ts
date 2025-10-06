import { logger } from "@/lib/logger";
import { AgentStreamer } from "./types";

/**
 * Message types for agent streaming
 */
export type StreamMessageType =
  | "status"
  | "think"
  | "progress"
  | "error"
  | "success"
  | "warn";

export interface StreamMessage {
  id: string;
  type: StreamMessageType;
  message: string;
  timestamp: Date;
  progress?: {
    current: number;
    total: number;
  };
  error?: Error;
}

/**
 * Callback type for streaming messages
 */
export type StreamCallback = (message: StreamMessage) => void;

/**
 * StreamingHandler - Manages real-time agent feedback
 * Provides "thinking aloud" behavior for AI operations
 */
export class StreamingHandler implements AgentStreamer {
  private callbacks: Set<StreamCallback> = new Set();
  private messageQueue: StreamMessage[] = [];
  private isProcessing = false;

  /**
   * Subscribe to streaming messages
   */
  subscribe(callback: StreamCallback): () => void {
    this.callbacks.add(callback);
    logger.debug("🌊 Stream subscriber added", {
      totalSubscribers: this.callbacks.size,
    });

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
      logger.debug("🌊 Stream subscriber removed", {
        totalSubscribers: this.callbacks.size,
      });
    };
  }

  /**
   * Emit a message to all subscribers
   */
  private emit(
    type: StreamMessageType,
    message: string,
    extras?: Partial<StreamMessage>
  ): void {
    const streamMessage: StreamMessage = {
      id: `${type}-${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date(),
      ...extras,
    };

    this.messageQueue.push(streamMessage);
    this.processQueue();
  }

  /**
   * Process message queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) return;

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;

      logger.debug(`🌊 Streaming ${message.type}:`, message.message);

      // Broadcast to all subscribers
      this.callbacks.forEach((callback) => {
        try {
          callback(message);
        } catch (error) {
          logger.error("Error in stream callback:", error);
        }
      });

      // Small delay to prevent overwhelming the UI
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    this.isProcessing = false;
  }

  /**
   * Send a status update message
   */
  status(message: string): void {
    this.emit("status", message);
  }

  /**
   * Stream thinking/reasoning steps
   */
  think(message: string): void {
    this.emit("think", message);
  }

  /**
   * Report progress for long-running operations
   */
  progress(current: number, total: number, message?: string): void {
    this.emit("progress", message || `Processing ${current}/${total}`, {
      progress: { current, total },
    });
  }

  /**
   * Send error messages
   */
  error(message: string, error?: Error): void {
    this.emit("error", message, { error });
  }

  /**
   * Send success messages
   */
  success(message: string): void {
    this.emit("success", message);
  }

  /**
   * Send warning messages
   */
  warn(message: string): void {
    this.emit("warn", message);
  }

  /**
   * Clear all messages and reset
   */
  clear(): void {
    this.messageQueue = [];
    logger.debug("🌊 Stream cleared");
  }

  /**
   * Get number of active subscribers
   */
  getSubscriberCount(): number {
    return this.callbacks.size;
  }
}
