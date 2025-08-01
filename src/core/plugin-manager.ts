/**
 * Plugin system for the IDE
 * Allows extending functionality through modular plugins
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  dependencies?: Record<string, string>;
  permissions?: string[];
  categories?: string[];
  engines?: {
    buildpcb?: string;
  };
}

export interface PluginContext {
  api: PluginAPI;
  manifest: PluginManifest;
  storage: PluginStorage;
  logger: PluginLogger;
}

export interface PluginAPI {
  // Core systems
  // commands: typeof import("./command-manager").commandManager;
  events: typeof import("./event-manager").eventManager;
  state: typeof import("./state-manager").stateManager;
  keyboard: typeof import("./keyboard").keyboardManager;
  files: typeof import("./file-system").fileSystemManager;

  // UI registration
  registerPanel: (panel: PanelDescriptor) => void;
  registerToolbarItem: (item: ToolbarItemDescriptor) => void;
  registerMenuItem: (item: MenuItemDescriptor) => void;

  // Component registration
  registerComponent: (component: ComponentDescriptor) => void;
  registerTool: (tool: ToolDescriptor) => void;

  // Extension points
  onProjectOpen: (callback: (project: any) => void) => void;
  onProjectClose: (callback: (project: any) => void) => void;
  onFileOpen: (callback: (file: any) => void) => void;
  onFileSave: (callback: (file: any) => void) => void;
}

export interface PluginStorage {
  get: (key: string) => any;
  set: (key: string, value: any) => void;
  delete: (key: string) => boolean;
  clear: () => void;
}

export interface PluginLogger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

export interface Plugin {
  activate: (context: PluginContext) => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
}

export interface PanelDescriptor {
  id: string;
  title: string;
  icon?: string;
  component: React.ComponentType<any>;
  position: "left" | "right" | "bottom";
  defaultSize?: number;
  resizable?: boolean;
}

export interface ToolbarItemDescriptor {
  id: string;
  title: string;
  icon: string;
  command: string;
  group?: string;
  order?: number;
  separator?: boolean;
}

export interface MenuItemDescriptor {
  id: string;
  label: string;
  command?: string;
  submenu?: MenuItemDescriptor[];
  separator?: boolean;
  group?: string;
  order?: number;
}

export interface ComponentDescriptor {
  id: string;
  name: string;
  category: string;
  description: string;
  icon?: string;
  properties: PropertyDescriptor[];
  defaultProps: Record<string, any>;
  footprint?: string;
  symbol?: string;
}

export interface PropertyDescriptor {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "color";
  label: string;
  defaultValue: any;
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

export interface ToolDescriptor {
  id: string;
  name: string;
  icon: string;
  cursor?: string;
  shortcut?: string[];
  category: string;
  onActivate?: () => void;
  onDeactivate?: () => void;
  onMouseDown?: (event: MouseEvent) => void;
  onMouseMove?: (event: MouseEvent) => void;
  onMouseUp?: (event: MouseEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private manifests: Map<string, PluginManifest> = new Map();
  private activePlugins: Set<string> = new Set();
  private pluginStorage: Map<string, Map<string, any>> = new Map();
  private extensionPoints: Map<string, Function[]> = new Map();

  // Registry for plugin contributions
  private panels: Map<string, PanelDescriptor> = new Map();
  private toolbarItems: Map<string, ToolbarItemDescriptor> = new Map();
  private menuItems: Map<string, MenuItemDescriptor> = new Map();
  private components: Map<string, ComponentDescriptor> = new Map();
  private tools: Map<string, ToolDescriptor> = new Map();

  /**
   * Register a plugin
   */
  async registerPlugin(
    manifest: PluginManifest,
    plugin: Plugin
  ): Promise<void> {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin ${manifest.id} is already registered`);
    }

    // Validate manifest
    this.validateManifest(manifest);

    // Check dependencies
    await this.checkDependencies(manifest);

    this.manifests.set(manifest.id, manifest);
    this.plugins.set(manifest.id, plugin);

    console.log(`Plugin registered: ${manifest.name} (${manifest.id})`);
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const manifest = this.manifests.get(pluginId);

    if (!plugin || !manifest) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (this.activePlugins.has(pluginId)) {
      console.warn(`Plugin ${pluginId} is already active`);
      return;
    }

    try {
      const context = this.createPluginContext(manifest);
      await plugin.activate(context);
      this.activePlugins.add(pluginId);

      console.log(`Plugin activated: ${manifest.name}`);
    } catch (error) {
      throw new Error(`Failed to activate plugin ${pluginId}: ${error}`);
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const manifest = this.manifests.get(pluginId);

    if (!plugin || !manifest) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (!this.activePlugins.has(pluginId)) {
      console.warn(`Plugin ${pluginId} is not active`);
      return;
    }

    try {
      if (plugin.deactivate) {
        await plugin.deactivate();
      }

      this.activePlugins.delete(pluginId);
      this.cleanupPluginContributions(pluginId);

      console.log(`Plugin deactivated: ${manifest.name}`);
    } catch (error) {
      throw new Error(`Failed to deactivate plugin ${pluginId}: ${error}`);
    }
  }

  /**
   * Get all registered plugins
   */
  getPlugins(): PluginManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * Get active plugins
   */
  getActivePlugins(): PluginManifest[] {
    return Array.from(this.activePlugins)
      .map((id) => this.manifests.get(id))
      .filter(Boolean) as PluginManifest[];
  }

  /**
   * Check if plugin is active
   */
  isPluginActive(pluginId: string): boolean {
    return this.activePlugins.has(pluginId);
  }

  /**
   * Get plugin contributions
   */
  getPanels(): PanelDescriptor[] {
    return Array.from(this.panels.values());
  }

  getToolbarItems(): ToolbarItemDescriptor[] {
    return Array.from(this.toolbarItems.values());
  }

  getMenuItems(): MenuItemDescriptor[] {
    return Array.from(this.menuItems.values());
  }

  getComponents(): ComponentDescriptor[] {
    return Array.from(this.components.values());
  }

  getTools(): ToolDescriptor[] {
    return Array.from(this.tools.values());
  }

  private createPluginContext(manifest: PluginManifest): PluginContext {
    return {
      api: this.createPluginAPI(manifest.id),
      manifest,
      storage: this.createPluginStorage(manifest.id),
      logger: this.createPluginLogger(manifest.id),
    };
  }

  private createPluginAPI(pluginId: string): PluginAPI {
    return {
      // Core systems (these would be imported from actual managers)
      // commands: {} as any,
      events: {} as any,
      state: {} as any,
      keyboard: {} as any,
      files: {} as any,

      registerPanel: (panel: PanelDescriptor) => {
        panel.id = `${pluginId}.${panel.id}`;
        this.panels.set(panel.id, panel);
      },

      registerToolbarItem: (item: ToolbarItemDescriptor) => {
        item.id = `${pluginId}.${item.id}`;
        this.toolbarItems.set(item.id, item);
      },

      registerMenuItem: (item: MenuItemDescriptor) => {
        item.id = `${pluginId}.${item.id}`;
        this.menuItems.set(item.id, item);
      },

      registerComponent: (component: ComponentDescriptor) => {
        component.id = `${pluginId}.${component.id}`;
        this.components.set(component.id, component);
      },

      registerTool: (tool: ToolDescriptor) => {
        tool.id = `${pluginId}.${tool.id}`;
        this.tools.set(tool.id, tool);
      },

      onProjectOpen: (callback: (project: any) => void) => {
        this.addExtensionPoint("project.open", callback);
      },

      onProjectClose: (callback: (project: any) => void) => {
        this.addExtensionPoint("project.close", callback);
      },

      onFileOpen: (callback: (file: any) => void) => {
        this.addExtensionPoint("file.open", callback);
      },

      onFileSave: (callback: (file: any) => void) => {
        this.addExtensionPoint("file.save", callback);
      },
    };
  }

  private createPluginStorage(pluginId: string): PluginStorage {
    if (!this.pluginStorage.has(pluginId)) {
      this.pluginStorage.set(pluginId, new Map());
    }

    const storage = this.pluginStorage.get(pluginId)!;

    return {
      get: (key: string) => storage.get(key),
      set: (key: string, value: any) => storage.set(key, value),
      delete: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
    };
  }

  private createPluginLogger(pluginId: string): PluginLogger {
    const prefix = `[Plugin:${pluginId}]`;

    return {
      info: (message: string, ...args: any[]) =>
        console.log(prefix, message, ...args),
      warn: (message: string, ...args: any[]) =>
        console.warn(prefix, message, ...args),
      error: (message: string, ...args: any[]) =>
        console.error(prefix, message, ...args),
      debug: (message: string, ...args: any[]) =>
        console.debug(prefix, message, ...args),
    };
  }

  private validateManifest(manifest: PluginManifest): void {
    const required = ["id", "name", "version", "description", "author", "main"];

    for (const field of required) {
      if (!manifest[field as keyof PluginManifest]) {
        throw new Error(`Plugin manifest missing required field: ${field}`);
      }
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error(
        "Invalid version format. Use semantic versioning (x.y.z)"
      );
    }
  }

  private async checkDependencies(manifest: PluginManifest): Promise<void> {
    if (!manifest.dependencies) return;

    for (const [depId, version] of Object.entries(manifest.dependencies)) {
      const depManifest = this.manifests.get(depId);

      if (!depManifest) {
        throw new Error(`Dependency not found: ${depId}`);
      }

      // Simple version check (would need proper semver in production)
      if (depManifest.version !== version) {
        console.warn(
          `Version mismatch for dependency ${depId}: expected ${version}, found ${depManifest.version}`
        );
      }
    }
  }

  private cleanupPluginContributions(pluginId: string): void {
    // Remove plugin contributions
    const toRemove = (map: Map<string, any>) => {
      for (const [key] of map) {
        if (key.startsWith(`${pluginId}.`)) {
          map.delete(key);
        }
      }
    };

    toRemove(this.panels);
    toRemove(this.toolbarItems);
    toRemove(this.menuItems);
    toRemove(this.components);
    toRemove(this.tools);
  }

  private addExtensionPoint(point: string, callback: Function): void {
    if (!this.extensionPoints.has(point)) {
      this.extensionPoints.set(point, []);
    }
    this.extensionPoints.get(point)!.push(callback);
  }

  /**
   * Trigger extension point
   */
  triggerExtensionPoint(point: string, ...args: any[]): void {
    const callbacks = this.extensionPoints.get(point) || [];
    callbacks.forEach((callback) => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in extension point ${point}:`, error);
      }
    });
  }
}

// Create global plugin manager
export const pluginManager = new PluginManager();

// Example plugin
export const examplePlugin: Plugin = {
  async activate(context: PluginContext) {
    context.logger.info("Example plugin activated");

    // Register a component
    context.api.registerComponent({
      id: "custom-resistor",
      name: "Custom Resistor",
      category: "Passive",
      description: "A customizable resistor component",
      properties: [
        {
          name: "resistance",
          type: "number",
          label: "Resistance (Ω)",
          defaultValue: 1000,
          min: 1,
          max: 1000000,
          required: true,
        },
        {
          name: "tolerance",
          type: "select",
          label: "Tolerance",
          defaultValue: "5%",
          options: [
            { label: "1%", value: "1%" },
            { label: "5%", value: "5%" },
            { label: "10%", value: "10%" },
          ],
        },
      ],
      defaultProps: {
        resistance: 1000,
        tolerance: "5%",
      },
    });

    // Register a tool
    context.api.registerTool({
      id: "measure-tool",
      name: "Measure Tool",
      icon: "ruler",
      category: "measurement",
      shortcut: ["m"],
      onActivate: () => context.logger.info("Measure tool activated"),
      onDeactivate: () => context.logger.info("Measure tool deactivated"),
    });
  },

  async deactivate() {
    console.log("Example plugin deactivated");
  },
};
