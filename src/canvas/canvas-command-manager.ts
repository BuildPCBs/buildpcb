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
  private eventListeners: Map<string, Set<Function>> = new Map();

  setCanvas(canvas: fabric.Canvas | null) {
    this.canvas = canvas;
    this.isWorkspaceCreated = false; // Reset workspace state when canvas changes
  }

  getCanvas(): fabric.Canvas | null {
    return this.canvas;
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
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  execute(command: string, ...args: any[]): void {
    console.log(`Executing command: ${command}`);
    this.emit(command, ...args);
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

  // NEW: Simple command that forwards to foolproof component factory in IDEFabricCanvas
  COMPONENT_ADD: {
    id: "component:add",
    name: "Add Component",
    handler: async (
      canvas: fabric.Canvas,
      params?: {
        type: string;
        svgPath: string;
        name: string;
        x?: number;
        y?: number;
      }
    ) => {
      // Forward to the foolproof component factory by emitting the event
      console.log(
        `🎯 Command manager: Forwarding "component:add" for ${params?.name}`
      );
      console.log(`🎯 Command manager: Canvas available: ${!!canvas}`);
      console.log(`🎯 Command manager: Params:`, params);
      canvasCommandManager.emit("component:add", params);
      console.log(`🎯 Command manager: Event emitted for ${params?.name}`);
    },
  } as CanvasCommand,

  // NEW: Command to add a wire between two components
  WIRE_ADD: {
    id: "wire:add",
    name: "Add Wire",
    handler: async (
      canvas: fabric.Canvas,
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
        console.error("❌ wire:add: Missing parameters");
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

      console.log(
        `🔗 wire:add: Creating wire from ${fromComponentId}:${fromPinNumber} to ${toComponentId}:${toPinNumber}`
      );

      // Find the pin objects
      const findPinByComponentAndNumber = (
        componentId: string,
        pinNumber: string
      ): fabric.Object | null => {
        const objects = canvas.getObjects();
        for (const obj of objects) {
          if (obj.type === "group") {
            // CRITICAL FIX: Check if THIS GROUP is the right component first
            // This prevents wires from connecting to the wrong instance when multiple components exist
            const isTargetComponent =
              (obj as any).id === componentId ||
              (obj as any).data?.componentId === componentId;

            if (!isTargetComponent) {
              continue; // Skip this group - it's not the component we're looking for
            }

            const groupObjects = (obj as fabric.Group).getObjects();
            for (const groupObj of groupObjects) {
              const pinData = (groupObj as any).data;
              if (
                pinData &&
                pinData.type === "pin" &&
                pinData.pinNumber === pinNumber
              ) {
                return groupObj;
              }
            }
          } else {
            const pinData = (obj as any).data;
            if (
              pinData &&
              pinData.type === "pin" &&
              pinData.componentId === componentId &&
              pinData.pinNumber === pinNumber
            ) {
              return obj;
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
        console.error(
          `❌ wire:add: Could not find pins - fromPin: ${!!fromPin}, toPin: ${!!toPin}`
        );
        return;
      }

      // Get pin positions
      const fromPoint = fromPin.getCenterPoint();
      const toPoint = toPin.getCenterPoint();

      // Create wire points
      let points: fabric.Point[];
      if (path && Array.isArray(path)) {
        // Use saved path if available
        points = path.map((p: any) => new fabric.Point(p.x, p.y));
      } else {
        // Create simple straight line
        points = [fromPoint, toPoint];
      }

      // Create the wire
      const wire = new fabric.Polyline(points, {
        fill: "transparent",
        stroke: "#888888",
        strokeWidth: 2,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        selectable: true,
        evented: true,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hasControls: false,
        hasBorders: true,
        wireType: "connection",
        startComponentId: fromComponentId,
        startPinIndex: fromPinNumber,
        endComponentId: toComponentId,
        endPinIndex: toPinNumber,
        netId: netId || `net_${Date.now()}`,
        objectCaching: false,
      } as any);

      canvas.add(wire);

      // Add endpoint dots
      const fromDot = new fabric.Circle({
        radius: 3,
        fill: "#888888",
        left: fromPoint.x - 3,
        top: fromPoint.y - 3,
        selectable: false,
        evented: false,
        wireEndpoint: true,
      });

      const toDot = new fabric.Circle({
        radius: 3,
        fill: "#888888",
        left: toPoint.x - 3,
        top: toPoint.y - 3,
        selectable: false,
        evented: false,
        wireEndpoint: true,
      });

      canvas.add(fromDot);
      canvas.add(toDot);

      canvas.renderAll();
      console.log(`✅ wire:add: Wire created successfully`);
    },
  } as CanvasCommand,
};

// Register built-in commands
Object.values(builtInCanvasCommands).forEach((command) => {
  canvasCommandManager.registerCommand(command);
});
