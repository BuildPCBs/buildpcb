"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { StateManager, ConnectionValidator } from "@/lib/StateManager";

export type ViewMode = "schematic" | "pcb";

// Enhanced shared component interface with additional metadata
export interface SharedComponent {
  id: string;
  type: string;
  name: string;
  footprintKey: string;
  schematicPosition?: { x: number; y: number };
  pcbPosition?: { x: number; y: number };
  rotation?: number;
  lastModified?: number;
  properties?: Record<string, any>;
}

// Electrical connection interface for ratsnest visualization
export interface ElectricalConnection {
  id: string;
  fromComponent: string; // Component ID
  fromPin: string; // Pin identifier/type
  toComponent: string; // Component ID  
  toPin: string; // Pin identifier/type
  netId?: string; // Optional net identifier for grouping
  isValid?: boolean; // Connection validation status
}

interface ViewContextType {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  toggleView: () => void;
  sharedComponents: SharedComponent[];
  addSharedComponent: (component: SharedComponent) => string;
  removeSharedComponent: (id: string) => void;
  updateSharedComponent: (
    id: string,
    updates: Partial<SharedComponent>
  ) => void;
  // Enhanced ratsnest connection management
  connections: ElectricalConnection[];
  addConnection: (connection: ElectricalConnection) => void;
  removeConnection: (connectionId: string) => void;
  clearConnections: () => void;
  addDemoConnections: () => void;
  // Performance and validation
  validateState: () => boolean;
  getStats: () => { componentCount: number; connectionCount: number; validConnections: number };
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export const useView = () => {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error("useView must be used within a ViewProvider");
  }
  return context;
};

interface ViewProviderProps {
  children: ReactNode;
}

export const ViewProvider: React.FC<ViewProviderProps> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewMode>("schematic");
  const [sharedComponents, setSharedComponents] = useState<SharedComponent[]>([]);
  const [connections, setConnections] = useState<ElectricalConnection[]>([]);
  const stateManager = useRef(StateManager.getInstance());

  // Enhanced component management with better ID generation and validation
  const addSharedComponent = useCallback((component: SharedComponent): string => {
    const componentId = component.id || `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const enhancedComponent: SharedComponent = {
      ...component,
      id: componentId,
      lastModified: Date.now(),
      rotation: component.rotation || 0,
    };

    setSharedComponents((prev) => {
      // Avoid duplicates
      const exists = prev.find((c) => c.id === componentId);
      if (exists) {
        console.warn(`Component with ID ${componentId} already exists`);
        return prev;
      }
      console.log(`✅ Added shared component: ${componentId} (${component.name})`);
      return [...prev, enhancedComponent];
    });

    return componentId;
  }, []);

  const removeSharedComponent = useCallback((id: string) => {
    setSharedComponents((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      console.log(`🗑️ Removed shared component: ${id}`);
      return filtered;
    });

    // Clean up connections when component is removed
    setConnections((prev) => {
      const cleaned = ConnectionValidator.cleanupOrphanedConnections(prev, sharedComponents.filter(c => c.id !== id));
      if (cleaned.length !== prev.length) {
        console.log(`🧹 Cleaned up ${prev.length - cleaned.length} orphaned connections`);
      }
      return cleaned;
    });
  }, [sharedComponents]);

  const updateSharedComponent = useCallback((id: string, updates: Partial<SharedComponent>) => {
    setSharedComponents((prev) =>
      prev.map((c) => 
        c.id === id 
          ? { ...c, ...updates, lastModified: Date.now() } 
          : c
      )
    );
    console.log(`🔄 Updated shared component: ${id}`);
  }, []);

  const toggleView = useCallback(() => {
    console.log("toggleView called, current view:", currentView);
    setCurrentView(prev => {
      const newView = prev === "schematic" ? "pcb" : "schematic";
      console.log("Switching from", prev, "to", newView);
      return newView;
    });
  }, [currentView]);

  // Connection management functions for ratsnest
  const addConnection = useCallback((connection: ElectricalConnection) => {
    setConnections(prev => {
      // Avoid duplicate connections
      const exists = prev.find(c => c.id === connection.id);
      if (exists) {
        return prev;
      }
      return [...prev, connection];
    });
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connectionId));
  }, []);

  const clearConnections = useCallback(() => {
    setConnections([]);
  }, []);

  // Demo function to add test connections for ratsnest testing
  const addDemoConnections = useCallback(() => {
    console.log('Adding demo connections for ratsnest testing...');
    console.log('Available shared components:', sharedComponents);
    
    if (sharedComponents.length >= 2) {
      // Add demo connection between first two components
      const connection: ElectricalConnection = {
        id: 'demo-connection-1',
        fromComponent: sharedComponents[0].id,
        fromPin: 'pin1',
        toComponent: sharedComponents[1].id,
        toPin: 'pin1',
        netId: 'demo-net-1'
      };
      addConnection(connection);
      console.log('🔗 Added demo connection:', connection);
    }
    
    if (sharedComponents.length >= 3) {
      // Add second demo connection
      const connection2: ElectricalConnection = {
        id: 'demo-connection-2',
        fromComponent: sharedComponents[1].id,
        fromPin: 'pin2',
        toComponent: sharedComponents[2].id,
        toPin: 'pin1',
        netId: 'demo-net-2'
      };
      addConnection(connection2);
      console.log('🔗 Added second demo connection:', connection2);
    }
  }, [sharedComponents, addConnection]);

  // Enhanced validation and statistics
  const validateState = useCallback((): boolean => {
    // Validate component consistency
    const componentIds = new Set(sharedComponents.map(c => c.id));
    if (componentIds.size !== sharedComponents.length) {
      console.error('Duplicate component IDs detected');
      return false;
    }

    // Validate connections
    const validConnections = ConnectionValidator.cleanupOrphanedConnections(connections, sharedComponents);
    if (validConnections.length !== connections.length) {
      console.warn(`Found ${connections.length - validConnections.length} invalid connections`);
    }

    // Check for circular connections
    if (ConnectionValidator.detectCircularConnections(connections)) {
      console.warn('Circular connections detected');
    }

    console.log('✅ State validation complete');
    return true;
  }, [sharedComponents, connections]);

  const getStats = useCallback(() => {
    const validConnections = ConnectionValidator.cleanupOrphanedConnections(connections, sharedComponents);
    return {
      componentCount: sharedComponents.length,
      connectionCount: connections.length,
      validConnections: validConnections.length,
    };
  }, [sharedComponents, connections]);

  // Periodic state validation (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const interval = setInterval(() => {
        validateState();
      }, 5000); // Validate every 5 seconds

      return () => clearInterval(interval);
    }
  }, [validateState]);

  const value: ViewContextType = {
    currentView,
    setCurrentView,
    toggleView,
    sharedComponents,
    addSharedComponent,
    removeSharedComponent,
    updateSharedComponent,
    connections,
    addConnection,
    removeConnection,
    clearConnections,
    addDemoConnections,
    validateState,
    getStats,
  };

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
};
