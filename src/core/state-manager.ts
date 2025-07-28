/**
 * State management system for the IDE
 * Provides centralized state with change tracking and persistence
 */

export interface StateChange<T = any> {
  path: string;
  oldValue: T;
  newValue: T;
  timestamp: Date;
  source?: string;
}

export interface StateSubscription {
  id: string;
  path: string;
  callback: (newValue: any, oldValue: any, change: StateChange) => void;
  immediate?: boolean;
  unsubscribe: () => void;
}

export interface StateSnapshot {
  id: string;
  timestamp: Date;
  state: any;
  description?: string;
}

class StateManager {
  private state: Record<string, any> = {};
  private subscriptions: Map<string, StateSubscription[]> = new Map();
  private history: StateChange[] = [];
  private snapshots: StateSnapshot[] = [];
  private maxHistorySize = 1000;
  private maxSnapshotSize = 50;
  private changeId = 0;

  /**
   * Get state value by path
   */
  get<T = any>(path: string, defaultValue?: T): T {
    return this.getNestedValue(this.state, path) ?? defaultValue;
  }

  /**
   * Set state value by path
   */
  set<T = any>(path: string, value: T, source?: string): void {
    const oldValue = this.get(path);

    if (this.isEqual(oldValue, value)) {
      return; // No change
    }

    this.setNestedValue(this.state, path, value);

    const change: StateChange<T> = {
      path,
      oldValue,
      newValue: value,
      timestamp: new Date(),
      source,
    };

    this.addToHistory(change);
    this.notifySubscribers(path, value, oldValue, change);
  }

  /**
   * Update state value using a function
   */
  update<T = any>(
    path: string,
    updater: (current: T) => T,
    source?: string
  ): void {
    const currentValue = this.get<T>(path);
    const newValue = updater(currentValue);
    this.set(path, newValue, source);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(
    path: string,
    callback: (newValue: any, oldValue: any, change: StateChange) => void,
    options: { immediate?: boolean } = {}
  ): StateSubscription {
    const subscription: StateSubscription = {
      id: this.generateSubscriptionId(),
      path,
      callback,
      immediate: options.immediate,
      unsubscribe: () => this.unsubscribe(path, subscription.id),
    };

    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, []);
    }

    this.subscriptions.get(path)!.push(subscription);

    // Call immediately if requested
    if (options.immediate) {
      const currentValue = this.get(path);
      callback(currentValue, undefined, {
        path,
        oldValue: undefined,
        newValue: currentValue,
        timestamp: new Date(),
        source: "immediate",
      });
    }

    return subscription;
  }

  /**
   * Unsubscribe from state changes
   */
  unsubscribe(path: string, subscriptionId: string): boolean {
    const subscriptions = this.subscriptions.get(path);
    if (!subscriptions) return false;

    const index = subscriptions.findIndex((sub) => sub.id === subscriptionId);
    if (index === -1) return false;

    subscriptions.splice(index, 1);

    if (subscriptions.length === 0) {
      this.subscriptions.delete(path);
    }

    return true;
  }

  /**
   * Create a state snapshot
   */
  createSnapshot(description?: string): string {
    const snapshot: StateSnapshot = {
      id: this.generateSnapshotId(),
      timestamp: new Date(),
      state: this.deepClone(this.state),
      description,
    };

    this.snapshots.push(snapshot);

    // Limit snapshot size
    if (this.snapshots.length > this.maxSnapshotSize) {
      this.snapshots.shift();
    }

    return snapshot.id;
  }

  /**
   * Restore from snapshot
   */
  restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) return false;

    const oldState = this.deepClone(this.state);
    this.state = this.deepClone(snapshot.state);

    // Notify all subscribers of the changes
    this.notifyAllSubscribers(oldState, this.state);

    return true;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Delete snapshot
   */
  deleteSnapshot(snapshotId: string): boolean {
    const index = this.snapshots.findIndex((s) => s.id === snapshotId);
    if (index === -1) return false;

    this.snapshots.splice(index, 1);
    return true;
  }

  /**
   * Get change history
   */
  getHistory(limit?: number): StateChange[] {
    return limit ? this.history.slice(-limit) : [...this.history];
  }

  /**
   * Clear change history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get current state
   */
  getState(): Record<string, any> {
    return this.deepClone(this.state);
  }

  /**
   * Reset state
   */
  reset(): void {
    const oldState = this.deepClone(this.state);
    this.state = {};
    this.history = [];
    this.notifyAllSubscribers(oldState, this.state);
  }

  /**
   * Check if path exists
   */
  has(path: string): boolean {
    return this.getNestedValue(this.state, path) !== undefined;
  }

  /**
   * Delete value at path
   */
  delete(path: string, source?: string): boolean {
    if (!this.has(path)) return false;

    const oldValue = this.get(path);
    this.deleteNestedValue(this.state, path);

    const change: StateChange = {
      path,
      oldValue,
      newValue: undefined,
      timestamp: new Date(),
      source,
    };

    this.addToHistory(change);
    this.notifySubscribers(path, undefined, oldValue, change);

    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, obj);

    target[lastKey] = value;
  }

  private deleteNestedValue(obj: any, path: string): void {
    const keys = path.split(".");
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current?.[key], obj);

    if (target && typeof target === "object") {
      delete target[lastKey];
    }
  }

  private notifySubscribers(
    path: string,
    newValue: any,
    oldValue: any,
    change: StateChange
  ): void {
    // Notify exact path subscribers
    const exactSubscribers = this.subscriptions.get(path) || [];
    exactSubscribers.forEach((sub) => {
      try {
        sub.callback(newValue, oldValue, change);
      } catch (error) {
        console.error(`Error in state subscription for ${path}:`, error);
      }
    });

    // Notify parent path subscribers
    this.notifyParentSubscribers(path, newValue, oldValue, change);
  }

  private notifyParentSubscribers(
    path: string,
    newValue: any,
    oldValue: any,
    change: StateChange
  ): void {
    const pathParts = path.split(".");

    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join(".");
      const parentSubscribers = this.subscriptions.get(parentPath) || [];

      parentSubscribers.forEach((sub) => {
        try {
          const parentNewValue = this.get(parentPath);
          const parentOldValue = this.get(parentPath); // Would need to reconstruct old value
          sub.callback(parentNewValue, parentOldValue, change);
        } catch (error) {
          console.error(
            `Error in parent state subscription for ${parentPath}:`,
            error
          );
        }
      });
    }
  }

  private notifyAllSubscribers(oldState: any, newState: any): void {
    this.subscriptions.forEach((subscribers, path) => {
      const oldValue = this.getNestedValue(oldState, path);
      const newValue = this.getNestedValue(newState, path);

      if (!this.isEqual(oldValue, newValue)) {
        const change: StateChange = {
          path,
          oldValue,
          newValue,
          timestamp: new Date(),
          source: "snapshot-restore",
        };

        subscribers.forEach((sub) => {
          try {
            sub.callback(newValue, oldValue, change);
          } catch (error) {
            console.error(`Error in state subscription for ${path}:`, error);
          }
        });
      }
    });
  }

  private addToHistory(change: StateChange): void {
    this.history.push(change);

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  private isEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private deepClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSnapshotId(): string {
    return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create global state manager
export const stateManager = new StateManager();

// Common state paths
export const STATE_PATHS = {
  // Application state
  APP_INITIALIZED: "app.initialized",
  APP_LOADING: "app.loading",

  // Project state
  CURRENT_PROJECT: "project.current",
  PROJECT_SETTINGS: "project.settings",
  PROJECT_MODIFIED: "project.modified",

  // Editor state
  EDITOR_ZOOM: "editor.zoom",
  EDITOR_PAN: "editor.pan",
  EDITOR_GRID_VISIBLE: "editor.grid.visible",
  EDITOR_GRID_SIZE: "editor.grid.size",
  EDITOR_SNAP_ENABLED: "editor.snap.enabled",
  EDITOR_SELECTION: "editor.selection",

  // Tool state
  ACTIVE_TOOL: "tools.active",
  TOOL_SETTINGS: "tools.settings",

  // Component state
  COMPONENTS: "components",
  COMPONENT_LIBRARY: "components.library",

  // Simulation state
  SIMULATION_RUNNING: "simulation.running",
  SIMULATION_RESULTS: "simulation.results",

  // UI state
  PANELS_VISIBLE: "ui.panels.visible",
  PANEL_SIZES: "ui.panels.sizes",
  SIDEBAR_COLLAPSED: "ui.sidebar.collapsed",
} as const;

// Initialize default state
export function initializeState() {
  stateManager.set(STATE_PATHS.APP_INITIALIZED, false);
  stateManager.set(STATE_PATHS.APP_LOADING, false);
  stateManager.set(STATE_PATHS.EDITOR_ZOOM, 1);
  stateManager.set(STATE_PATHS.EDITOR_PAN, { x: 0, y: 0 });
  stateManager.set(STATE_PATHS.EDITOR_GRID_VISIBLE, true);
  stateManager.set(STATE_PATHS.EDITOR_GRID_SIZE, 10);
  stateManager.set(STATE_PATHS.EDITOR_SNAP_ENABLED, true);
  stateManager.set(STATE_PATHS.EDITOR_SELECTION, []);
  stateManager.set(STATE_PATHS.COMPONENTS, {});
  stateManager.set(STATE_PATHS.SIMULATION_RUNNING, false);
  stateManager.set(STATE_PATHS.PANELS_VISIBLE, {
    properties: true,
    components: true,
    layers: true,
  });
  stateManager.set(STATE_PATHS.SIDEBAR_COLLAPSED, false);
}
