import * as fabric from "fabric";

export type CanvasCommandHandler = (
  canvas: fabric.Canvas,
  params?: any
) => void;

export interface CanvasCommand {
  id: string;
  name: string;
  handler: CanvasCommandHandler;
}

class CanvasCommandManager {
  private commands: Map<string, CanvasCommand> = new Map();
  private canvas: fabric.Canvas | null = null;
  private isWorkspaceCreated: boolean = false;

  setCanvas(canvas: fabric.Canvas | null) {
    this.canvas = canvas;
    this.isWorkspaceCreated = false; // Reset workspace state when canvas changes
  }

  createWorkspace(canvas: fabric.Canvas) {
    if (this.isWorkspaceCreated) return;

    // Create a large white workspace rectangle
    const workspace = new fabric.Rect({
      width: 5000,
      height: 3000,
      fill: "#FFFFFF",
      stroke: "#E0E0E0",
      strokeWidth: 1,
      left: 0,
      top: 0,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
      name: "workspace", // Add name for identification
    });

    // Add workspace to canvas and send to back
    canvas.add(workspace);
    canvas.sendObjectToBack(workspace);
    canvas.renderAll();

    this.isWorkspaceCreated = true;
    console.log("Workspace created");
  }

  registerCommand(command: CanvasCommand) {
    this.commands.set(command.id, command);
  }

  executeCommand(commandId: string, params?: any): boolean {
    const command = this.commands.get(commandId);
    if (!command || !this.canvas) {
      console.warn(`Command ${commandId} not found or canvas not available`);
      return false;
    }

    try {
      // Create workspace before executing any component command
      if (commandId.startsWith("add_")) {
        this.createWorkspace(this.canvas);
      }

      command.handler(this.canvas, params);
      return true;
    } catch (error) {
      console.error(`Error executing command ${commandId}:`, error);
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
      canvas: fabric.Canvas,
      params?: { x?: number; y?: number }
    ) => {
      try {
        // Create a simple resistor representation using rectangles
        const resistorBody = new fabric.Rect({
          width: 60,
          height: 20,
          fill: "#E8E8E8",
          stroke: "#333333",
          strokeWidth: 2,
        });

        const leftLead = new fabric.Rect({
          width: 20,
          height: 2,
          fill: "#333333",
          left: -40,
          top: 9,
        });

        const rightLead = new fabric.Rect({
          width: 20,
          height: 2,
          fill: "#333333",
          left: 60,
          top: 9,
        });

        // Create invisible pin objects at connection points
        const leftPin = new fabric.Circle({
          radius: 4,
          fill: "transparent",
          stroke: "#0038DF",
          strokeWidth: 0, // Initially invisible
          left: -50,
          top: 10,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
          pin: true, // Special property to identify pins
          pinType: "left", // Identifier for this specific pin
        } as any);

        const rightPin = new fabric.Circle({
          radius: 4,
          fill: "transparent",
          stroke: "#0038DF",
          strokeWidth: 0, // Initially invisible
          left: 70,
          top: 10,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
          pin: true, // Special property to identify pins
          pinType: "right", // Identifier for this specific pin
        } as any);

        // Group the resistor parts including pins
        const resistorGroup = new fabric.Group(
          [leftLead, resistorBody, rightLead, leftPin, rightPin],
          {
            left: params?.x ?? canvas.getWidth() / 2,
            top: params?.y ?? canvas.getHeight() / 2,
            originX: "center",
            originY: "center",
            selectable: true,
            evented: true,
            hoverCursor: "move",
            moveCursor: "move",
            componentType: "resistor", // Identify as component
          } as any
        );

        // Add to canvas
        canvas.add(resistorGroup);
        canvas.renderAll();

        console.log("Resistor added to canvas");
      } catch (error) {
        console.error("Error creating resistor:", error);
      }
    },
  } as CanvasCommand,
};

// Register built-in commands
Object.values(builtInCanvasCommands).forEach((command) => {
  canvasCommandManager.registerCommand(command);
});
