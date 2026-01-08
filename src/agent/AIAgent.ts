import Konva from "konva";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";
import { Project } from "@/types";

/**
 * Defines the contract for the object that streams feedback from the agent to the UI.
 * This is the key to achieving the "thinking aloud" experience.
 */
export interface AgentStreamer {
  /** Sends a text message to the user. */
  sendMessage: (message: string) => void;
  /** Sends a more complex data payload, like a component suggestion. */
  sendData: (data: { type: string; payload: any }) => void;
  /** Signals an error has occurred. */
  sendError: (error: string) => void;
  /** Signals the end of the stream. */
  close: () => void;
}

/**
 * The AgentContext provides the capability handlers with all the necessary tools
 * and state information to interact with the application.
 * It's the "world view" for the AI agent.
 */
export interface AgentContext {
  /** The Konva Stage instance for direct manipulation. */
  canvas: Konva.Stage;
  /** The command manager for executing and tracking canvas changes (undo/redo). */
  commandManager: typeof canvasCommandManager;
  /** The currently active project's data. */
  project: Project;
  /** The streamer object to send real-time feedback to the user. */
  streamer: AgentStreamer;
  // We can add more context as needed, e.g.:
  // componentStore: ComponentStore;
  // currentUser: User;
}
