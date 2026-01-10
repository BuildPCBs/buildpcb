import Konva from "konva";
import { logger } from "@/lib/logger";

export type CanvasCommandHandler = (
  stage: Konva.Stage,
  layer: Konva.Layer,
  params?: any
) => void;

export interface CanvasCommand {
  id: string;
  name: string;
  handler: CanvasCommandHandler;
}

class CanvasCommandManager {
  private commands: Map<string, CanvasCommand> = new Map();
  private stage: Konva.Stage | null = null;
  private layer: Konva.Layer | null = null;
  private isWorkspaceCreated: boolean = false;
  private eventListeners: Map<string, Set<Function>> = new Map();

  setStage(stage: Konva.Stage | null, layer: Konva.Layer | null = null) {
    this.stage = stage;
    this.layer = layer;
    this.isWorkspaceCreated = false; // Reset workspace state when stage changes
  }

  getStage(): Konva.Stage | null {
    return this.stage;
  }

  getLayer(): Konva.Layer | null {
    return this.layer;
  }

  // Legacy method for backwards compatibility
  setCanvas(canvas: any) {
    logger.warn("setCanvas is deprecated, use setStage instead");
    this.setStage(canvas);
  }

  // Legacy method for backwards compatibility
  getCanvas(): any {
    logger.warn("getCanvas is deprecated, use getStage instead");
    return this.stage;
  }

  // Event system methods
  on(event: string, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(...args);
        } catch (error) {
          logger.error(`Error in event listener for ${event}`, { error });
        }
      });
    }
  }

  execute(command: string, ...args: any[]): void {
    logger.canvas(`Executing command: ${command}`);
    this.emit(command, ...args);
  }

  createWorkspace(stage: Konva.Stage, layer: Konva.Layer) {
    if (this.isWorkspaceCreated) return;

    // Create a large white workspace rectangle
    const workspace = new Konva.Rect({
      width: 5000,
      height: 3000,
      fill: "#FFFFFF",
      stroke: "#E0E0E0",
      strokeWidth: 1,
      x: 0,
      y: 0,
      offsetX: 2500,
      offsetY: 1500,
      name: "workspace", // Add name for identification
      listening: false,
    });

    // Add workspace to layer
    layer.add(workspace);
    workspace.moveToBottom();

    this.isWorkspaceCreated = true;
    logger.canvas("Workspace created");
  }

  registerCommand(command: CanvasCommand) {
    this.commands.set(command.id, command);
  }

  executeCommand(commandId: string, params?: any): boolean {
    const command = this.commands.get(commandId);
    if (!command || !this.stage || !this.layer) {
      logger.warn(
        `Command ${commandId} not found or stage/layer not available`
      );
      return false;
    }

    try {
      // Create workspace before executing any component command
      if (commandId.startsWith("add_")) {
        this.createWorkspace(this.stage, this.layer);
      }

      command.handler(this.stage, this.layer, params);
      return true;
    } catch (error) {
      logger.error(`Error executing command ${commandId}`, { error });
      return false;
    }
  }

  getAvailableCommands(): CanvasCommand[] {
    return Array.from(this.commands.values());
  }

  unregisterCommand(commandId: string): boolean {
    return this.commands.delete(commandId);
  }
}

// Create a singleton instance
export const canvasCommandManager = new CanvasCommandManager();

// Built-in commands
export const builtInCanvasCommands = {
  ADD_RESISTOR: {
    id: "add_resistor",
    name: "Add Resistor",
    handler: async (
      stage: Konva.Stage,
      layer: Konva.Layer,
      params?: { x?: number; y?: number }
    ) => {
      try {
        // Create a simple resistor representation using Konva shapes
        const group = new Konva.Group({
          x: params?.x ?? stage.width() / 2,
          y: params?.y ?? stage.height() / 2,
          draggable: true,
          name: "component resistor",
        });

        const resistorBody = new Konva.Rect({
          width: 60,
          height: 20,
          fill: "#E8E8E8",
          stroke: "#333333",
          strokeWidth: 2,
          offsetX: 30,
          offsetY: 10,
        });

        const leftLead = new Konva.Rect({
          width: 20,
          height: 2,
          fill: "#333333",
          x: -50,
          y: -1,
          offsetX: 0,
          offsetY: 0,
        });

        const rightLead = new Konva.Rect({
          width: 20,
          height: 2,
          fill: "#333333",
          x: 30,
          y: -1,
          offsetX: 0,
          offsetY: 0,
        });

        // Create pin markers at connection points
        const leftPin = new Konva.Circle({
          radius: 4,
          fill: "transparent",
          stroke: "#0038DF",
          strokeWidth: 0, // Initially invisible
          x: -50,
          y: 0,
          listening: false,
          name: "pin-left",
        });

        const rightPin = new Konva.Circle({
          radius: 4,
          fill: "transparent",
          stroke: "#0038DF",
          strokeWidth: 0, // Initially invisible
          x: 40,
          y: 0,
          listening: false,
          name: "pin-right",
        });

        group.add(leftLead, resistorBody, rightLead, leftPin, rightPin);
        layer.add(group);

        logger.canvas("Resistor added to canvas");
      } catch (error) {
        logger.error("Error creating resistor", { error });
      }
    },
  } as CanvasCommand,

  // Command that forwards to component factory
  COMPONENT_ADD: {
    id: "component:add",
    name: "Add Component",
    handler: async (
      stage: Konva.Stage,
      layer: Konva.Layer,
      params?: {
        type: string;
        svgPath?: string;
        symbol_data?: any;
        name: string;
        x?: number;
        y?: number;
      }
    ) => {
      if (!params || (!params.svgPath && !params.symbol_data)) {
        logger.error(
          "COMPONENT_ADD: Missing params or (svgPath/symbol_data)",
          params
        );
        return;
      }

      logger.canvas(
        `Command manager: Executing "component:add" for ${params?.name}`
      );

      try {
        if (params.symbol_data) {
          // Use Symbol Factory for database components
          logger.canvas("Using SymbolComponentFactory (Data-Driven)");
          const { createSymbolComponent } = await import(
            "./SymbolComponentFactory"
          );
          await createSymbolComponent(stage, layer, params as any);
        } else if (params.svgPath) {
          // Use Intelligent SVG Factory
          logger.canvas("Using IntelligentComponentFactory (SVG-based)");
          const { createIntelligentComponent } = await import(
            "./IntelligentComponentFactory"
          );
          await createIntelligentComponent(stage, layer, params as any);
        }

        logger.canvas(
          `Command manager: Component ${params.name} added successfully`
        );
      } catch (error) {
        logger.error("Error adding component via factory", { error });
      }
    },
  } as CanvasCommand,

  // Command to add a wire between two components
  WIRE_ADD: {
    id: "wire:add",
    name: "Add Wire",
    handler: async (
      stage: Konva.Stage,
      layer: Konva.Layer,
      params?: {
        fromComponentId: string;
        fromPinNumber: string;
        toComponentId: string;
        toPinNumber: string;
        netId?: string;
        path?: any; // Optional saved wire path
      }
    ) => {
      if (!params) {
        logger.error("wire:add: Missing parameters");
        return;
      }

      const {
        fromComponentId,
        fromPinNumber,
        toComponentId,
        toPinNumber,
        netId,
        path,
      } = params;

      logger.canvas(
        `wire:add: Creating wire from ${fromComponentId}:${fromPinNumber} to ${toComponentId}:${toPinNumber}`
      );

      // Find the pin objects
      const findPinByComponentAndNumber = (
        componentId: string,
        pinNumber: string
      ): Konva.Node | null => {
        const nodes = layer.find(".component");
        for (const node of nodes) {
          // Check if this is the right component
          const isTargetComponent =
            node.getAttr("id") === componentId ||
            node.getAttr("componentId") === componentId;

          if (!isTargetComponent) {
            continue;
          }

          // Find the pin within this component (groups have children)
          if (node instanceof Konva.Group) {
            const pins = node.find(".pin");
            for (const pin of pins) {
              if (pin.getAttr("pinNumber") === pinNumber) {
                return pin;
              }
            }
          }
        }
        return null;
      };

      const fromPin = findPinByComponentAndNumber(
        fromComponentId,
        fromPinNumber
      );
      const toPin = findPinByComponentAndNumber(toComponentId, toPinNumber);

      if (!fromPin || !toPin) {
        logger.error("wire:add: Could not find pins", {
          hasFromPin: !!fromPin,
          hasToPin: !!toPin,
        });
        return;
      }

      // Get pin positions
      const fromPoint = fromPin.getAbsolutePosition();
      const toPoint = toPin.getAbsolutePosition();

      // Create wire points
      let points: number[];
      if (path && Array.isArray(path)) {
        // Use saved path if available
        points = path.flatMap((p: any) => [p.x, p.y]);
      } else {
        // Create simple straight line
        points = [fromPoint.x, fromPoint.y, toPoint.x, toPoint.y];
      }

      // Create the wire
      const wire = new Konva.Line({
        points: points,
        stroke: "#888888",
        strokeWidth: 2,
        lineCap: "round",
        lineJoin: "round",
        draggable: false,
        name: "wire",
      });

      // Set custom attributes for wire metadata
      (wire as any).setAttrs({
        wireType: "connection",
        startComponentId: fromComponentId,
        startPinIndex: fromPinNumber,
        endComponentId: toComponentId,
        endPinIndex: toPinNumber,
        netId: netId || `net_${Date.now()}`,
      });

      layer.add(wire);

      // Add endpoint dots
      const fromDot = new Konva.Circle({
        radius: 3,
        fill: "#888888",
        x: fromPoint.x,
        y: fromPoint.y,
        listening: false,
        name: "wire-endpoint",
      });

      const toDot = new Konva.Circle({
        radius: 3,
        fill: "#888888",
        x: toPoint.x,
        y: toPoint.y,
        listening: false,
        name: "wire-endpoint",
      });

      layer.add(fromDot);
      layer.add(toDot);

      logger.canvas("wire:add: Wire created successfully");
    },
  } as CanvasCommand,
};

// Register built-in commands
Object.values(builtInCanvasCommands).forEach((command) => {
  canvasCommandManager.registerCommand(command);
});
