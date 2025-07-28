/**
 * Command system for IDE operations
 * Provides undo/redo functionality and command palette integration
 */

export interface CommandContext {
  [key: string]: any;
}

export interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
  keybinding?: string[];
  icon?: string;
  when?: string; // Condition expression
  execute: (context?: CommandContext) => Promise<any> | any;
  undo?: (context?: CommandContext, result?: any) => Promise<void> | void;
  canExecute?: (context?: CommandContext) => boolean;
  hidden?: boolean;
}

export interface CommandExecution {
  id: string;
  commandId: string;
  timestamp: Date;
  context?: CommandContext;
  result?: any;
  undoable: boolean;
}

class CommandManager {
  private commands: Map<string, Command> = new Map();
  private history: CommandExecution[] = [];
  private currentIndex = -1;
  private maxHistorySize = 100;
  private executing = false;

  /**
   * Register a command
   */
  registerCommand(command: Command): void {
    this.commands.set(command.id, command);
  }

  /**
   * Unregister a command
   */
  unregisterCommand(commandId: string): boolean {
    return this.commands.delete(commandId);
  }

  /**
   * Execute a command
   */
  async executeCommand(
    commandId: string,
    context?: CommandContext
  ): Promise<any> {
    const command = this.commands.get(commandId);
    if (!command) {
      throw new Error(`Command not found: ${commandId}`);
    }

    // Check if command can be executed
    if (command.canExecute && !command.canExecute(context)) {
      throw new Error(`Command cannot be executed: ${commandId}`);
    }

    if (this.executing) {
      throw new Error("Another command is currently executing");
    }

    this.executing = true;
    const execution: CommandExecution = {
      id: this.generateExecutionId(),
      commandId,
      timestamp: new Date(),
      context,
      undoable: !!command.undo,
    };

    try {
      const result = await command.execute(context);
      execution.result = result;

      // Add to history if undoable
      if (command.undo) {
        this.addToHistory(execution);
      }

      return result;
    } catch (error) {
      console.error(`Error executing command ${commandId}:`, error);
      throw error;
    } finally {
      this.executing = false;
    }
  }

  /**
   * Undo last command
   */
  async undo(): Promise<boolean> {
    if (this.currentIndex < 0) {
      return false;
    }

    const execution = this.history[this.currentIndex];
    const command = this.commands.get(execution.commandId);

    if (!command || !command.undo) {
      return false;
    }

    try {
      await command.undo(execution.context, execution.result);
      this.currentIndex--;
      return true;
    } catch (error) {
      console.error(`Error undoing command ${execution.commandId}:`, error);
      return false;
    }
  }

  /**
   * Redo next command
   */
  async redo(): Promise<boolean> {
    if (this.currentIndex >= this.history.length - 1) {
      return false;
    }

    const execution = this.history[this.currentIndex + 1];
    const command = this.commands.get(execution.commandId);

    if (!command) {
      return false;
    }

    try {
      const result = await command.execute(execution.context);
      execution.result = result;
      this.currentIndex++;
      return true;
    } catch (error) {
      console.error(`Error redoing command ${execution.commandId}:`, error);
      return false;
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Get all registered commands
   */
  getAllCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: string): Command[] {
    return this.getAllCommands().filter((cmd) => cmd.category === category);
  }

  /**
   * Search commands
   */
  searchCommands(query: string): Command[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllCommands().filter(
      (cmd) =>
        !cmd.hidden &&
        (cmd.name.toLowerCase().includes(lowerQuery) ||
          cmd.description.toLowerCase().includes(lowerQuery) ||
          cmd.category.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get command history
   */
  getHistory(): CommandExecution[] {
    return [...this.history];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Get command by ID
   */
  getCommand(commandId: string): Command | undefined {
    return this.commands.get(commandId);
  }

  private addToHistory(execution: CommandExecution): void {
    // Remove any commands after current index (when undoing then executing new command)
    this.history = this.history.slice(0, this.currentIndex + 1);

    // Add new execution
    this.history.push(execution);
    this.currentIndex = this.history.length - 1;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create global command manager
export const commandManager = new CommandManager();

// Command categories
export const COMMAND_CATEGORIES = {
  FILE: "file",
  EDIT: "edit",
  VIEW: "view",
  COMPONENT: "component",
  SIMULATION: "simulation",
  TOOLS: "tools",
  NAVIGATION: "navigation",
  DEBUG: "debug",
} as const;

// Default IDE commands
export const DEFAULT_COMMANDS: Command[] = [
  // File commands
  {
    id: "file.new",
    name: "New File",
    description: "Create a new file",
    category: COMMAND_CATEGORIES.FILE,
    keybinding: ["ctrl", "n"],
    execute: async () => {
      console.log("Creating new file...");
      return { type: "new-file", success: true };
    },
  },

  {
    id: "file.open",
    name: "Open File",
    description: "Open an existing file",
    category: COMMAND_CATEGORIES.FILE,
    keybinding: ["ctrl", "o"],
    execute: async () => {
      console.log("Opening file...");
      return { type: "open-file", success: true };
    },
  },

  {
    id: "file.save",
    name: "Save",
    description: "Save current file",
    category: COMMAND_CATEGORIES.FILE,
    keybinding: ["ctrl", "s"],
    execute: async () => {
      console.log("Saving file...");
      return { type: "save-file", success: true };
    },
  },

  // Edit commands
  {
    id: "edit.undo",
    name: "Undo",
    description: "Undo last action",
    category: COMMAND_CATEGORIES.EDIT,
    keybinding: ["ctrl", "z"],
    execute: async () => {
      return await commandManager.undo();
    },
    canExecute: () => commandManager.canUndo(),
  },

  {
    id: "edit.redo",
    name: "Redo",
    description: "Redo last undone action",
    category: COMMAND_CATEGORIES.EDIT,
    keybinding: ["ctrl", "y"],
    execute: async () => {
      return await commandManager.redo();
    },
    canExecute: () => commandManager.canRedo(),
  },

  // Component commands
  {
    id: "component.add",
    name: "Add Component",
    description: "Add a new component to the circuit",
    category: COMMAND_CATEGORIES.COMPONENT,
    keybinding: ["shift", "a"],
    execute: async (context) => {
      const componentType = context?.componentType || "resistor";
      const position = context?.position || { x: 0, y: 0 };

      console.log(`Adding ${componentType} at`, position);
      return {
        type: "add-component",
        componentId: `comp_${Date.now()}`,
        componentType,
        position,
      };
    },
    undo: async (context, result) => {
      if (result?.componentId) {
        console.log(`Removing component ${result.componentId}`);
      }
    },
  },

  {
    id: "component.rotate",
    name: "Rotate Component",
    description: "Rotate selected component",
    category: COMMAND_CATEGORIES.COMPONENT,
    keybinding: ["r"],
    execute: async (context) => {
      const componentId = context?.componentId;
      const angle = context?.angle || 90;

      if (!componentId) {
        throw new Error("No component selected");
      }

      console.log(`Rotating component ${componentId} by ${angle} degrees`);
      return {
        type: "rotate-component",
        componentId,
        angle,
        previousAngle: 0, // Would get from component state
      };
    },
    undo: async (context, result) => {
      if (result?.componentId && result?.previousAngle !== undefined) {
        console.log(
          `Rotating component ${result.componentId} back to ${result.previousAngle}`
        );
      }
    },
    canExecute: (context) => !!context?.componentId,
  },

  // View commands
  {
    id: "view.zoom-in",
    name: "Zoom In",
    description: "Zoom in on the canvas",
    category: COMMAND_CATEGORIES.VIEW,
    keybinding: ["ctrl", "="],
    execute: async () => {
      console.log("Zooming in...");
      return { type: "zoom", factor: 1.2 };
    },
  },

  {
    id: "view.zoom-out",
    name: "Zoom Out",
    description: "Zoom out on the canvas",
    category: COMMAND_CATEGORIES.VIEW,
    keybinding: ["ctrl", "-"],
    execute: async () => {
      console.log("Zooming out...");
      return { type: "zoom", factor: 0.8 };
    },
  },

  {
    id: "view.fit-to-screen",
    name: "Fit to Screen",
    description: "Fit the entire circuit to screen",
    category: COMMAND_CATEGORIES.VIEW,
    keybinding: ["ctrl", "shift", "f"],
    execute: async () => {
      console.log("Fitting to screen...");
      return { type: "fit-to-screen" };
    },
  },

  // Simulation commands
  {
    id: "simulation.run",
    name: "Run Simulation",
    description: "Start circuit simulation",
    category: COMMAND_CATEGORIES.SIMULATION,
    keybinding: ["f5"],
    execute: async (context) => {
      const simulationType = context?.type || "dc";
      console.log(`Starting ${simulationType} simulation...`);
      return {
        type: "start-simulation",
        simulationType,
        simulationId: `sim_${Date.now()}`,
      };
    },
  },

  {
    id: "simulation.stop",
    name: "Stop Simulation",
    description: "Stop running simulation",
    category: COMMAND_CATEGORIES.SIMULATION,
    keybinding: ["shift", "f5"],
    execute: async () => {
      console.log("Stopping simulation...");
      return { type: "stop-simulation" };
    },
  },

  // Tools commands
  {
    id: "tools.grid-toggle",
    name: "Toggle Grid",
    description: "Show/hide grid",
    category: COMMAND_CATEGORIES.TOOLS,
    keybinding: ["g"],
    execute: async () => {
      console.log("Toggling grid...");
      return { type: "toggle-grid" };
    },
  },

  {
    id: "tools.snap-toggle",
    name: "Toggle Snap",
    description: "Enable/disable snap to grid",
    category: COMMAND_CATEGORIES.TOOLS,
    keybinding: ["s"],
    execute: async () => {
      console.log("Toggling snap...");
      return { type: "toggle-snap" };
    },
  },
];

// Initialize command system
export function initializeCommandSystem() {
  // Register default commands
  DEFAULT_COMMANDS.forEach((command) => {
    commandManager.registerCommand(command);
  });
}
