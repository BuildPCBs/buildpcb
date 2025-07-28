/**
 * Event system for IDE-wide communication
 * Provides type-safe event handling and pub-sub functionality
 */

export interface IDEEvent<T = any> {
  type: string;
  payload: T;
  timestamp: Date;
  source?: string;
  bubbles?: boolean;
  cancelable?: boolean;
  defaultPrevented?: boolean;
}

export interface EventListener<T = any> {
  id: string;
  callback: (event: IDEEvent<T>) => void | Promise<void>;
  once?: boolean;
  priority?: number;
}

export interface EventSubscription {
  unsubscribe: () => void;
}

class EventManager {
  private listeners: Map<string, EventListener[]> = new Map();
  private eventHistory: IDEEvent[] = [];
  private maxHistorySize = 1000;
  private debugMode = false;

  /**
   * Subscribe to an event type
   */
  subscribe<T = any>(
    eventType: string,
    callback: (event: IDEEvent<T>) => void | Promise<void>,
    options: {
      once?: boolean;
      priority?: number;
      id?: string;
    } = {}
  ): EventSubscription {
    const listener: EventListener<T> = {
      id: options.id || this.generateListenerId(),
      callback,
      once: options.once,
      priority: options.priority || 0,
    };

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const listeners = this.listeners.get(eventType)!;
    listeners.push(listener);

    // Sort by priority (higher priority first)
    listeners.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    if (this.debugMode) {
      console.log(`Subscribed to event: ${eventType}`, {
        listenerId: listener.id,
        priority: listener.priority,
      });
    }

    return {
      unsubscribe: () => this.unsubscribe(eventType, listener.id),
    };
  }

  /**
   * Unsubscribe from an event type
   */
  unsubscribe(eventType: string, listenerId: string): boolean {
    const listeners = this.listeners.get(eventType);
    if (!listeners) return false;

    const index = listeners.findIndex((l) => l.id === listenerId);
    if (index === -1) return false;

    listeners.splice(index, 1);

    if (listeners.length === 0) {
      this.listeners.delete(eventType);
    }

    if (this.debugMode) {
      console.log(`Unsubscribed from event: ${eventType}`, { listenerId });
    }

    return true;
  }

  /**
   * Emit an event
   */
  async emit<T = any>(
    eventType: string,
    payload: T,
    options: {
      source?: string;
      bubbles?: boolean;
      cancelable?: boolean;
    } = {}
  ): Promise<IDEEvent<T>> {
    const event: IDEEvent<T> = {
      type: eventType,
      payload,
      timestamp: new Date(),
      source: options.source,
      bubbles: options.bubbles || false,
      cancelable: options.cancelable || false,
      defaultPrevented: false,
    };

    // Add to history
    this.addToHistory(event);

    if (this.debugMode) {
      console.log(`Emitting event: ${eventType}`, {
        payload,
        source: options.source,
      });
    }

    const listeners = this.listeners.get(eventType) || [];
    const onceListeners: string[] = [];

    // Execute listeners
    for (const listener of listeners) {
      try {
        await listener.callback(event);

        if (listener.once) {
          onceListeners.push(listener.id);
        }

        // Stop if event was cancelled
        if (event.defaultPrevented && event.cancelable) {
          break;
        }
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    }

    // Remove one-time listeners
    onceListeners.forEach((id) => this.unsubscribe(eventType, id));

    return event;
  }

  /**
   * Get all active event types
   */
  getActiveEventTypes(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Get listener count for an event type
   */
  getListenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.length || 0;
  }

  /**
   * Get event history
   */
  getEventHistory(limit?: number): IDEEvent[] {
    return limit ? this.eventHistory.slice(-limit) : [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Wait for a specific event
   */
  waitForEvent<T = any>(
    eventType: string,
    timeout?: number,
    condition?: (event: IDEEvent<T>) => boolean
  ): Promise<IDEEvent<T>> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;

      const subscription = this.subscribe<T>(
        eventType,
        (event) => {
          if (!condition || condition(event)) {
            if (timeoutId) clearTimeout(timeoutId);
            subscription.unsubscribe();
            resolve(event);
          }
        },
        { once: true }
      );

      if (timeout) {
        timeoutId = setTimeout(() => {
          subscription.unsubscribe();
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeout);
      }
    });
  }

  private addToHistory(event: IDEEvent): void {
    this.eventHistory.push(event);

    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  private generateListenerId(): string {
    return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create global event manager
export const eventManager = new EventManager();

// Common IDE events
export const IDE_EVENTS = {
  // Application lifecycle
  APP_INITIALIZED: "app:initialized",
  APP_SHUTDOWN: "app:shutdown",

  // File operations
  FILE_OPENED: "file:opened",
  FILE_SAVED: "file:saved",
  FILE_CLOSED: "file:closed",
  FILE_CHANGED: "file:changed",

  // Project operations
  PROJECT_OPENED: "project:opened",
  PROJECT_SAVED: "project:saved",
  PROJECT_CLOSED: "project:closed",
  PROJECT_SETTINGS_CHANGED: "project:settings-changed",

  // Editor operations
  EDITOR_SELECTION_CHANGED: "editor:selection-changed",
  EDITOR_CURSOR_MOVED: "editor:cursor-moved",
  EDITOR_ZOOM_CHANGED: "editor:zoom-changed",
  EDITOR_VIEW_CHANGED: "editor:view-changed",

  // Component operations
  COMPONENT_ADDED: "component:added",
  COMPONENT_REMOVED: "component:removed",
  COMPONENT_MOVED: "component:moved",
  COMPONENT_ROTATED: "component:rotated",
  COMPONENT_SELECTED: "component:selected",
  COMPONENT_PROPERTIES_CHANGED: "component:properties-changed",

  // Circuit operations
  CONNECTION_CREATED: "connection:created",
  CONNECTION_REMOVED: "connection:removed",
  CIRCUIT_VALIDATED: "circuit:validated",

  // Simulation events
  SIMULATION_STARTED: "simulation:started",
  SIMULATION_STOPPED: "simulation:stopped",
  SIMULATION_COMPLETED: "simulation:completed",
  SIMULATION_ERROR: "simulation:error",
  SIMULATION_PROGRESS: "simulation:progress",

  // UI events
  PANEL_OPENED: "ui:panel-opened",
  PANEL_CLOSED: "ui:panel-closed",
  PANEL_RESIZED: "ui:panel-resized",
  TOOLBAR_TOOL_SELECTED: "ui:toolbar-tool-selected",

  // Error events
  ERROR_OCCURRED: "error:occurred",
  ERROR_RESOLVED: "error:resolved",

  // Performance events
  PERFORMANCE_WARNING: "performance:warning",
  MEMORY_WARNING: "memory:warning",

  // User actions
  USER_ACTION: "user:action",
  UNDO_PERFORMED: "user:undo",
  REDO_PERFORMED: "user:redo",
} as const;

// Event payload types
export interface FileEvent {
  filePath: string;
  fileName: string;
  fileType: string;
  content?: string;
}

export interface ProjectEvent {
  projectId: string;
  projectName: string;
  projectPath: string;
}

export interface ComponentEvent {
  componentId: string;
  componentType: string;
  position?: { x: number; y: number };
  properties?: Record<string, any>;
}

export interface ConnectionEvent {
  connectionId: string;
  fromComponent: string;
  toComponent: string;
  fromPin: string;
  toPin: string;
}

export interface SimulationEvent {
  simulationId: string;
  type: string;
  progress?: number;
  results?: any;
  error?: string;
}

export interface ErrorEvent {
  errorId: string;
  severity: string;
  category: string;
  message: string;
}

// Convenience functions for common events
export const Events = {
  fileOpened: (
    filePath: string,
    fileName: string,
    fileType: string,
    content?: string
  ) =>
    eventManager.emit(IDE_EVENTS.FILE_OPENED, {
      filePath,
      fileName,
      fileType,
      content,
    }),

  fileSaved: (filePath: string, fileName: string, fileType: string) =>
    eventManager.emit(IDE_EVENTS.FILE_SAVED, { filePath, fileName, fileType }),

  componentAdded: (
    componentId: string,
    componentType: string,
    position: { x: number; y: number }
  ) =>
    eventManager.emit(IDE_EVENTS.COMPONENT_ADDED, {
      componentId,
      componentType,
      position,
    }),

  simulationStarted: (simulationId: string, type: string) =>
    eventManager.emit(IDE_EVENTS.SIMULATION_STARTED, { simulationId, type }),

  errorOccurred: (
    errorId: string,
    severity: string,
    category: string,
    message: string
  ) =>
    eventManager.emit(IDE_EVENTS.ERROR_OCCURRED, {
      errorId,
      severity,
      category,
      message,
    }),
};
