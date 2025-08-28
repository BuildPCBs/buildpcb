import { SharedComponent, ElectricalConnection } from '@/contexts/ViewContext';

// Enhanced state synchronization manager for cross-view consistency
export interface SyncManager {
  pendingUpdates: Map<string, Partial<SharedComponent>>;
  batchTimeout: NodeJS.Timeout | null;
  conflictResolution: 'schematic-priority' | 'pcb-priority' | 'last-write-wins';
}

export class StateManager {
  private static instance: StateManager;
  private syncQueue: Map<string, Partial<SharedComponent>> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private updateCallbacks: Set<(updates: Map<string, Partial<SharedComponent>>) => void> = new Set();
  
  private constructor() {}

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  // Batch component updates to prevent race conditions
  scheduleUpdate(componentId: string, updates: Partial<SharedComponent>) {
    this.syncQueue.set(componentId, {
      ...this.syncQueue.get(componentId),
      ...updates,
      // Add timestamp for conflict resolution
      lastModified: Date.now()
    } as any);

    // Debounce updates to prevent excessive re-renders
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.flushUpdates();
    }, 50); // 50ms batch window
  }

  private flushUpdates() {
    if (this.syncQueue.size === 0) return;

    const updates = new Map(this.syncQueue);
    this.syncQueue.clear();
    
    // Notify all subscribers
    this.updateCallbacks.forEach(callback => {
      try {
        callback(updates);
      } catch (error) {
        console.error('State update callback failed:', error);
      }
    });
  }

  subscribe(callback: (updates: Map<string, Partial<SharedComponent>>) => void) {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  // Validate state consistency across views
  validateSync(schematicComponents: SharedComponent[], pcbComponents: SharedComponent[]): boolean {
    const schematicIds = new Set(schematicComponents.map(c => c.id));
    const pcbIds = new Set(pcbComponents.map(c => c.id));
    
    // Check for orphaned components
    const orphanedInSchematic = [...schematicIds].filter(id => !pcbIds.has(id));
    const orphanedInPCB = [...pcbIds].filter(id => !schematicIds.has(id));
    
    if (orphanedInSchematic.length > 0 || orphanedInPCB.length > 0) {
      console.warn('State sync issue detected:', {
        orphanedInSchematic,
        orphanedInPCB
      });
      return false;
    }
    
    return true;
  }
}

// Connection validation and cleanup utilities
export const ConnectionValidator = {
  validateConnection(connection: ElectricalConnection, components: SharedComponent[]): boolean {
    const fromComponent = components.find(c => c.id === connection.fromComponent);
    const toComponent = components.find(c => c.id === connection.toComponent);
    
    if (!fromComponent || !toComponent) {
      console.warn('Invalid connection: missing components', connection);
      return false;
    }
    
    // Additional validation can be added here
    return true;
  },

  cleanupOrphanedConnections(connections: ElectricalConnection[], components: SharedComponent[]): ElectricalConnection[] {
    const componentIds = new Set(components.map(c => c.id));
    
    return connections.filter(conn => 
      componentIds.has(conn.fromComponent) && componentIds.has(conn.toComponent)
    );
  },

  detectCircularConnections(connections: ElectricalConnection[]): boolean {
    // Simple cycle detection using DFS
    const graph = new Map<string, string[]>();
    const visited = new Set<string>();
    const recStack = new Set<string>();

    // Build adjacency list
    connections.forEach(conn => {
      if (!graph.has(conn.fromComponent)) {
        graph.set(conn.fromComponent, []);
      }
      graph.get(conn.fromComponent)!.push(conn.toComponent);
    });

    const hasCycle = (node: string): boolean => {
      if (recStack.has(node)) return true;
      if (visited.has(node)) return false;

      visited.add(node);
      recStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) return true;
      }

      recStack.delete(node);
      return false;
    };

    for (const [node] of graph) {
      if (!visited.has(node) && hasCycle(node)) {
        return true;
      }
    }

    return false;
  }
};
