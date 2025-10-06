import * as fabric from "fabric";
import { Circuit } from "@/types";

/**
 * Streamer interface for real-time AI feedback to users
 * Enables "thinking aloud" behavior for agent operations
 */
export interface AgentStreamer {
  /** Send a status update message to the user */
  status: (message: string) => void;
  /** Stream thinking/reasoning steps */
  think: (message: string) => void;
  /** Report progress for long-running operations */
  progress: (current: number, total: number, message?: string) => void;
  /** Send error messages */
  error: (message: string, error?: Error) => void;
  /** Send success messages */
  success: (message: string) => void;
  /** Send warning messages */
  warn: (message: string) => void;
}

/**
 * Project context snapshot for agent operations
 */
export interface AgentProjectContext {
  projectId: string | null;
  versionId: string | null;
  projectName: string | null;
  circuit: Circuit | null;
  isDirty: boolean;
  lastSaved: Date | null;
}

/**
 * Canvas context for agent operations
 * Provides access to the Fabric.js canvas and command manager
 */
export interface AgentCanvasContext {
  canvas: fabric.Canvas | null;
  isCanvasReady: boolean;
  /** Get current canvas objects */
  getObjects: () => fabric.FabricObject[];
  /** Get selected objects */
  getActiveObjects: () => fabric.FabricObject[];
  /** Render the canvas */
  requestRenderAll: () => void;
}

/**
 * Complete context passed to all capability handlers
 * Provides everything needed for agent operations
 */
export interface AgentContext {
  /** Canvas access and manipulation */
  canvas: AgentCanvasContext;
  /** Current project state */
  project: AgentProjectContext;
  /** Real-time streaming to user */
  streamer: AgentStreamer;
  /** User ID if authenticated */
  userId?: string;
}

/**
 * Result returned by capability handlers
 */
export interface AgentResult {
  status: "success" | "error" | "partial";
  message: string;
  data?: any;
  error?: Error;
}

/**
 * Type for capability handler functions
 */
export type CapabilityHandler = (
  context: AgentContext,
  prompt: string
) => Promise<AgentResult>;
