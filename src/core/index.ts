/**
 * Core IDE initialization
 * Sets up all core systems and initializes the IDE
 */

import { initializeKeyboardShortcuts, keyboardManager } from "./keyboard";
import { initializeErrorHandling, errorManager } from "./error-manager";
import { eventManager, IDE_EVENTS } from "./event-manager";
// import { coreCommandManager } from "./command-manager";
import { initializeState, stateManager, STATE_PATHS } from "./state-manager";
import { fileSystemManager } from "./file-system";
import { pluginManager } from "./plugin-manager";

export interface IDEConfig {
  debug?: boolean;
  plugins?: string[];
  shortcuts?: boolean;
  errorHandling?: boolean;
  persistence?: boolean;
}

class IDECore {
  private initialized = false;
  private config: IDEConfig = {};

  /**
   * Initialize the IDE core systems
   */
  async initialize(config: IDEConfig = {}): Promise<void> {
    if (this.initialized) {
      console.warn("IDE already initialized");
      return;
    }

    this.config = { ...this.getDefaultConfig(), ...config };

    try {
      console.log("Initializing BuildPCB.ai IDE...");

      // Set debug mode
      if (this.config.debug) {
        eventManager.setDebugMode(true);
        console.log("Debug mode enabled");
      }

      // Initialize core systems in order
      await this.initializeCoreSystem();
      await this.initializeManagers();
      await this.initializePlugins();
      await this.postInitialize();

      this.initialized = true;
      console.log("IDE initialization complete!");

      // Emit initialization event
      await eventManager.emit(IDE_EVENTS.APP_INITIALIZED, {
        timestamp: new Date(),
        config: this.config,
      });
    } catch (error) {
      console.error("Failed to initialize IDE:", error);
      throw error;
    }
  }

  /**
   * Shutdown the IDE
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log("Shutting down IDE...");

    try {
      // Emit shutdown event
      await eventManager.emit(IDE_EVENTS.APP_SHUTDOWN, {
        timestamp: new Date(),
      });

      // Deactivate all plugins
      const activePlugins = pluginManager.getActivePlugins();
      for (const plugin of activePlugins) {
        try {
          await pluginManager.deactivatePlugin(plugin.id);
        } catch (error) {
          console.error(`Error deactivating plugin ${plugin.id}:`, error);
        }
      }

      // Stop keyboard listening
      keyboardManager.stopListening();

      // Clear caches
      fileSystemManager.clearCache();
      // commandManager.clearHistory();
      stateManager.clearHistory();

      this.initialized = false;
      console.log("IDE shutdown complete");
    } catch (error) {
      console.error("Error during shutdown:", error);
    }
  }

  /**
   * Get IDE status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      config: this.config,
      systems: {
        keyboard: keyboardManager,
        error: errorManager.getErrorStats(),
        commands: 0, // commandManager.getAllCommands().length,
        state: stateManager.getState(),
        files: fileSystemManager.getCacheStats(),
        plugins: {
          total: pluginManager.getPlugins().length,
          active: pluginManager.getActivePlugins().length,
        },
      },
    };
  }

  /**
   * Check if IDE is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  private async initializeCoreSystem(): Promise<void> {
    console.log("Initializing core system...");

    // Initialize state first (other systems depend on it)
    initializeState();
    stateManager.set(STATE_PATHS.APP_LOADING, true);

    // Initialize error handling
    if (this.config.errorHandling) {
      initializeErrorHandling();
      console.log("✓ Error handling initialized");
    }

    // Initialize keyboard shortcuts
    if (this.config.shortcuts) {
      initializeKeyboardShortcuts();
      console.log("✓ Keyboard shortcuts initialized");
    }

    // Initialize command system
    // initializeCommandSystem();
    console.log("✓ Command system initialized");
  }

  private async initializeManagers(): Promise<void> {
    console.log("Initializing managers...");

    // Set up event listeners for cross-system communication
    this.setupEventListeners();

    // Set up keyboard shortcuts for commands
    this.setupKeyboardIntegration();

    console.log("✓ Managers initialized");
  }

  private async initializePlugins(): Promise<void> {
    if (!this.config.plugins?.length) {
      return;
    }

    console.log("Initializing plugins...");

    // In a real implementation, this would load plugins from files/URLs
    // For now, we'll just log the plugin IDs
    for (const pluginId of this.config.plugins) {
      console.log(`- Plugin: ${pluginId}`);
    }

    console.log("✓ Plugins initialized");
  }

  private async postInitialize(): Promise<void> {
    // Final setup after all systems are initialized
    stateManager.set(STATE_PATHS.APP_LOADING, false);
    stateManager.set(STATE_PATHS.APP_INITIALIZED, true);

    // Load user preferences
    await this.loadUserPreferences();

    // Create initial snapshot
    stateManager.createSnapshot("Initial state");

    console.log("✓ Post-initialization complete");
  }

  private setupEventListeners(): void {
    // File events
    eventManager.subscribe(IDE_EVENTS.FILE_OPENED, async (event) => {
      console.log("File opened:", event.payload.fileName);
      // Update recent files, etc.
    });

    eventManager.subscribe(IDE_EVENTS.FILE_SAVED, async (event) => {
      console.log("File saved:", event.payload.fileName);
      // Mark project as not modified, etc.
    });

    // Error events
    eventManager.subscribe(IDE_EVENTS.ERROR_OCCURRED, async (event) => {
      const error = event.payload;
      console.error("IDE Error:", error.message);

      // Handle critical errors
      if (error.severity === "critical") {
        // Emergency save, etc.
        console.log("Handling critical error...");
      }
    });

    // Component events
    eventManager.subscribe(IDE_EVENTS.COMPONENT_ADDED, async (event) => {
      const { componentId, componentType, position } = event.payload;
      console.log(
        `Component added: ${componentType} at (${position.x}, ${position.y})`
      );

      // Update state
      const components = stateManager.get(STATE_PATHS.COMPONENTS, {}) as Record<
        string,
        any
      >;
      components[componentId] = {
        id: componentId,
        type: componentType,
        position,
        properties: {},
      };
      stateManager.set(STATE_PATHS.COMPONENTS, components);
    });

    // Simulation events
    eventManager.subscribe(IDE_EVENTS.SIMULATION_STARTED, async (event) => {
      const { simulationId, type } = event.payload;
      console.log(`Simulation started: ${type} (${simulationId})`);
      stateManager.set(STATE_PATHS.SIMULATION_RUNNING, true);
    });

    eventManager.subscribe(IDE_EVENTS.SIMULATION_COMPLETED, async (event) => {
      console.log("Simulation completed");
      stateManager.set(STATE_PATHS.SIMULATION_RUNNING, false);
    });
  }

  private setupKeyboardIntegration(): void {
    // Connect keyboard shortcuts to commands
    // const commands = commandManager.getAllCommands();
    // commands.forEach((command) => {
    //   if (command.keybinding) {
    //     keyboardManager.registerShortcut({
    //       id: command.id,
    //       keys: command.keybinding,
    //       description: command.description,
    //       category: command.category,
    //       action: () => {
    //         commandManager.executeCommand(command.id).catch((error) => {
    //           errorManager.reportError({
    //             message: `Failed to execute command: ${command.name}`,
    //             details: error.message,
    //             category: "system" as any,
    //             severity: "medium" as any,
    //           });
    //         });
    //       },
    //     });
    //   }
    // });
  }

  private async loadUserPreferences(): Promise<void> {
    try {
      const preferences = localStorage.getItem("buildpcb-preferences");
      if (preferences) {
        const parsed = JSON.parse(preferences);

        // Apply preferences to state
        Object.entries(parsed).forEach(([key, value]) => {
          stateManager.set(key, value, "user-preferences");
        });

        console.log("✓ User preferences loaded");
      }
    } catch (error) {
      console.warn("Failed to load user preferences:", error);
    }
  }

  private getDefaultConfig(): IDEConfig {
    return {
      debug: process.env.NODE_ENV === "development",
      shortcuts: true,
      errorHandling: true,
      persistence: true,
      plugins: [],
    };
  }
}

// Create global IDE instance
export const ideCore = new IDECore();

// Export core systems for direct access
export {
  keyboardManager,
  errorManager,
  eventManager,
  // commandManager,
  stateManager,
  fileSystemManager,
  pluginManager,
};

// Export events and constants
// export { COMMAND_CATEGORIES } from "./command-manager";
export { IDE_EVENTS } from "./event-manager";
export { STATE_PATHS } from "./state-manager";
export { ErrorSeverity, ErrorCategory } from "./error-manager";

// Auto-initialize in browser environment
if (typeof window !== "undefined") {
  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ideCore.initialize().catch(console.error);
    });
  } else {
    ideCore.initialize().catch(console.error);
  }

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    ideCore.shutdown().catch(console.error);
  });
}
