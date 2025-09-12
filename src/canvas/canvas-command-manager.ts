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

  // DISABLED: Old component creation system - replaced by foolproof factory in IDEFabricCanvas
  /*
  COMPONENT_ADD_OLD: {
    id: "component:add-old",
    name: "Add Component (Old)",
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
      try {
        if (!params) {
          console.error("Component parameters are required");
          return;
        }

        console.log(`Adding ${params.name} (${params.type}) to canvas`);

        // Helper function to create pins for different component types with PRECISE positioning
        const createPinsForComponent = (type: string): fabric.Circle[] => {
          const pins: fabric.Circle[] = [];

          // Pin style configuration
          const pinStyle = {
            radius: 3,
            fill: "silver",
            stroke: "#0038DF",
            strokeWidth: 2,
            originX: "center" as const,
            originY: "center" as const,
            selectable: false,
            evented: false,
            pin: true,
          };

          // PRECISE pin configurations based on SVG designs
          switch (type) {
            case "resistor":
              // Pins at exact ends of resistor leads (60px wide SVG)
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Left end of resistor
                  top: 0,
                  pinType: "left",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Right end of resistor
                  top: 0,
                  pinType: "right",
                } as any)
              );
              break;

            case "capacitor":
              // Pins at exact ends of capacitor leads (60px wide SVG)
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Left plate connection
                  top: 0,
                  pinType: "left",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Right plate connection
                  top: 0,
                  pinType: "right",
                } as any)
              );
              break;

            case "led":
            case "diode":
              // Pins at anode and cathode ends
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Anode (left)
                  top: 0,
                  pinType: "anode",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Cathode (right)
                  top: 0,
                  pinType: "cathode",
                } as any)
              );
              break;

            case "transistor":
              // Base, Collector, Emitter pins (precise to SVG design)
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Base (left)
                  top: 0,
                  pinType: "base",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Collector (top-right)
                  top: -15,
                  pinType: "collector",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Emitter (bottom-right)
                  top: 15,
                  pinType: "emitter",
                } as any)
              );
              break;

            case "switch":
            case "pushbutton":
              // Switch contact pins
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Left contact
                  top: 0,
                  pinType: "contact1",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Right contact
                  top: 0,
                  pinType: "contact2",
                } as any)
              );
              break;

            case "inductor":
              // Inductor coil ends
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Left coil end
                  top: 0,
                  pinType: "left",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Right coil end
                  top: 0,
                  pinType: "right",
                } as any)
              );
              break;

            case "battery":
              // Battery terminals
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Positive terminal
                  top: 0,
                  pinType: "positive",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Negative terminal
                  top: 0,
                  pinType: "negative",
                } as any)
              );
              break;

            case "motor":
              // Motor connection pins
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Motor lead 1
                  top: 0,
                  pinType: "lead1",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Motor lead 2
                  top: 0,
                  pinType: "lead2",
                } as any)
              );
              break;

            case "crystal":
              // Crystal oscillator pins
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Crystal pin 1
                  top: 0,
                  pinType: "pin1",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Crystal pin 2
                  top: 0,
                  pinType: "pin2",
                } as any)
              );
              break;

            case "voltage_regulator":
              // 3-pin regulator (IN, GND, OUT)
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Input pin
                  top: -8,
                  pinType: "input",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 0, // Ground pin (bottom center)
                  top: 20,
                  pinType: "ground",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Output pin
                  top: -8,
                  pinType: "output",
                } as any)
              );
              break;

            case "sensor":
              // 3-pin sensor (VCC, GND, SIG)
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // VCC pin
                  top: -5,
                  pinType: "vcc",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // GND pin
                  top: 5,
                  pinType: "ground",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Signal pin
                  top: 0,
                  pinType: "signal",
                } as any)
              );
              break;

            case "arduino":
              // Arduino digital pins (simplified - top row)
              for (let i = 0; i < 6; i++) {
                pins.push(
                  new fabric.Circle({
                    ...pinStyle,
                    left: -25 + i * 10, // Spread across top
                    top: -25,
                    pinType: `digital_${i}`,
                  } as any)
                );
              }
              // Arduino analog pins (bottom row)
              for (let i = 0; i < 4; i++) {
                pins.push(
                  new fabric.Circle({
                    ...pinStyle,
                    left: -15 + i * 10, // Spread across bottom
                    top: 25,
                    pinType: `analog_${i}`,
                  } as any)
                );
              }
              break;

            case "connector":
              // Multi-pin connector (3 pins each side)
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Left pin 1
                  top: -6,
                  pinType: "left1",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Left pin 2
                  top: 0,
                  pinType: "left2",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: -30, // Left pin 3
                  top: 6,
                  pinType: "left3",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Right pin 1
                  top: -6,
                  pinType: "right1",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Right pin 2
                  top: 0,
                  pinType: "right2",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 30, // Right pin 3
                  top: 6,
                  pinType: "right3",
                } as any)
              );
              break;

            default:
              // Default two-pin configuration
              pins.push(
                new fabric.Circle({
                  ...pinStyle,
                  left: -25,
                  top: 0,
                  pinType: "pin1",
                } as any),
                new fabric.Circle({
                  ...pinStyle,
                  left: 25,
                  top: 0,
                  pinType: "pin2",
                } as any)
              );
          }

          return pins;
        };

        // Create fallback component function
        const createFallbackComponent = (
          params: {
            type: string;
            name: string;
            x?: number;
            y?: number;
          },
          pins: fabric.Circle[],
          canvas: fabric.Canvas
        ) => {
          console.log(`Creating fallback component for ${params.type}`);

          // Create a simple rectangle as fallback
          const fallbackRect = new fabric.Rect({
            width: 50,
            height: 25,
            fill: "#f0f0f0",
            stroke: "#0038DF",
            strokeWidth: 2,
            rx: 4,
            ry: 4,
            originX: "center",
            originY: "center",
          });

          // Add component type label
          const label = new fabric.Text(params.type.toUpperCase(), {
            fontSize: 8,
            fill: "#333333",
            textAlign: "center",
            originX: "center",
            originY: "center",
            top: 8, // Position below the rectangle
          });

          const componentGroup = new fabric.Group(
            [fallbackRect, label, ...pins],
            {
              left: params.x ?? canvas.getWidth() / 2,
              top: params.y ?? canvas.getHeight() / 2,
              originX: "center",
              originY: "center",
              selectable: true,
              evented: true,
              hoverCursor: "move",
              moveCursor: "move",
              componentType: params.type,
              componentName: params.name,
              id: `${params.type}_${Date.now()}`,
            } as any
          );

          canvas.add(componentGroup);
          canvas.renderAll();

          console.log(
            `Fallback ${params.name} added to canvas with ${pins.length} pins`
          );
        };

        // Try to load SVG component from the provided path
        const loadComponent = async () => {
          const pins = createPinsForComponent(params.type);

          // Prepare SVG URL (ensure it starts with /)
          const svgUrl = params.svgPath.startsWith("/")
            ? params.svgPath
            : `/${params.svgPath}`;
          console.log(`Attempting to load SVG from: ${svgUrl}`);

          // Use a Promise wrapper for better error handling
          return new Promise<void>((resolve) => {
            fabric.loadSVGFromURL(svgUrl, (objects: any, options: any) => {
              try {
                if (objects && Array.isArray(objects) && objects.length > 0) {
                  console.log(
                    `Successfully loaded SVG for ${params.type} with ${objects.length} objects`
                  );

                  // Create the component symbol from loaded SVG
                  const componentSymbol = fabric.util.groupSVGElements(
                    objects,
                    options
                  );

                  // Scale the component to appropriate size
                  componentSymbol.set({
                    scaleX: 1.0,
                    scaleY: 1.0,
                    originX: "center",
                    originY: "center",
                  });

                  // Group the component symbol with its pins
                  const componentGroup = new fabric.Group(
                    [componentSymbol, ...pins],
                    {
                      left: params.x ?? canvas.getWidth() / 2,
                      top: params.y ?? canvas.getHeight() / 2,
                      originX: "center",
                      originY: "center",
                      selectable: true,
                      evented: true,
                      hoverCursor: "move",
                      moveCursor: "move",
                      componentType: params.type,
                      componentName: params.name,
                      id: `${params.type}_${Date.now()}`,
                    } as any
                  );

                  // Add to canvas
                  canvas.add(componentGroup);
                  canvas.renderAll();

                  console.log(
                    `${params.name} added to canvas successfully with ${pins.length} pins`
                  );
                  resolve();
                } else {
                  console.warn(
                    `No objects in SVG for ${params.type}, creating fallback`
                  );
                  createFallbackComponent(params, pins, canvas);
                  resolve();
                }
              } catch (error) {
                console.error(
                  `Error processing SVG objects for ${params.type}:`,
                  error
                );
                createFallbackComponent(params, pins, canvas);
                resolve();
              }
            });

            // Fallback timeout in case SVG loading hangs
            setTimeout(() => {
              console.warn(
                `SVG loading timeout for ${params.type}, creating fallback`
              );
              createFallbackComponent(params, pins, canvas);
              resolve();
            }, 3000);
          });
        };

        await loadComponent();
      } catch (error) {
        console.error("Error creating component:", error);
      }
    },
  } as CanvasCommand,
  */
};

// Register built-in commands
Object.values(builtInCanvasCommands).forEach((command) => {
  canvasCommandManager.registerCommand(command);
});
