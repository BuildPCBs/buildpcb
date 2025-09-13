/**
 * Netlist Management Hook
 * Manages electrical nets - groups of connected pins that are electrically equivalent
 */

import { useState, useCallback, useRef } from "react";

export interface NetConnection {
  componentId: string;
  pinNumber: string;
}

export interface Net {
  netId: string;
  connections: NetConnection[];
  name?: string; // Optional human-readable name
}

interface UseNetlistReturn {
  nets: Net[];
  getNetForConnection: (componentId: string, pinNumber: string) => Net | null;
  getNetById: (netId: string) => Net | null;
  addConnectionToNet: (netId: string, connection: NetConnection) => void;
  createNet: (connections: NetConnection[]) => string;
  mergeNets: (netId1: string, netId2: string) => boolean;
  removeConnection: (componentId: string, pinNumber: string) => void;
  clearAllNets: () => void;
  getAllConnections: () => NetConnection[];
  setNets: (newNets: Net[]) => void;
}

export function useNetlist(initialNets: Net[] = []): UseNetlistReturn {
  const [nets, setNetsState] = useState<Net[]>(initialNets);
  const netCounterRef = useRef(
    Math.max(
      0,
      ...initialNets.map((net) => parseInt(net.netId.split("_")[1] || "0"))
    )
  );

  // Generate unique net ID
  const generateNetId = useCallback(() => {
    netCounterRef.current += 1;
    return `net_${netCounterRef.current.toString().padStart(3, "0")}`;
  }, []);

  // Find which net contains a specific connection
  const getNetForConnection = useCallback(
    (componentId: string, pinNumber: string): Net | null => {
      return (
        nets.find((net) =>
          net.connections.some(
            (conn) =>
              conn.componentId === componentId && conn.pinNumber === pinNumber
          )
        ) || null
      );
    },
    [nets]
  );

  // Get net by ID
  const getNetById = useCallback(
    (netId: string): Net | null => {
      return nets.find((net) => net.netId === netId) || null;
    },
    [nets]
  );

  // Add a connection to an existing net
  const addConnectionToNet = useCallback(
    (netId: string, connection: NetConnection) => {
      setNetsState((prevNets) =>
        prevNets.map((net) =>
          net.netId === netId
            ? {
                ...net,
                connections: [...net.connections, connection],
              }
            : net
        )
      );
    },
    []
  );

  // Create a new net with initial connections
  const createNet = useCallback(
    (connections: NetConnection[]): string => {
      const netId = generateNetId();
      const newNet: Net = {
        netId,
        connections: [...connections],
      };

      setNetsState((prevNets) => [...prevNets, newNet]);
      return netId;
    },
    [generateNetId]
  );

  // Merge two nets into one
  const mergeNets = useCallback(
    (netId1: string, netId2: string): boolean => {
      const net1 = getNetById(netId1);
      const net2 = getNetById(netId2);

      if (!net1 || !net2 || netId1 === netId2) {
        return false;
      }

      // Combine connections from both nets
      const mergedConnections = [...net1.connections, ...net2.connections];

      // Update net1 with merged connections
      setNetsState((prevNets) =>
        prevNets
          .filter((net) => net.netId !== netId2) // Remove net2
          .map((net) =>
            net.netId === netId1
              ? { ...net, connections: mergedConnections }
              : net
          )
      );

      return true;
    },
    [getNetById]
  );

  // Remove a connection from its net
  const removeConnection = useCallback(
    (componentId: string, pinNumber: string) => {
      setNetsState(
        (prevNets) =>
          prevNets
            .map((net) => ({
              ...net,
              connections: net.connections.filter(
                (conn) =>
                  !(
                    conn.componentId === componentId &&
                    conn.pinNumber === pinNumber
                  )
              ),
            }))
            .filter((net) => net.connections.length > 0) // Remove empty nets
      );
    },
    []
  );

  // Clear all nets
  const clearAllNets = useCallback(() => {
    setNetsState([]);
    netCounterRef.current = 0;
  }, []);

  // Get all connections across all nets
  const getAllConnections = useCallback((): NetConnection[] => {
    return nets.flatMap((net) => net.connections);
  }, [nets]);

  // Set nets (for restoration)
  const setNets = useCallback((newNets: Net[]) => {
    setNetsState(newNets);
    // Update counter to avoid conflicts
    const maxId = Math.max(
      0,
      ...newNets.map((net) => parseInt(net.netId.split("_")[1] || "0"))
    );
    netCounterRef.current = maxId;
  }, []);

  return {
    nets,
    getNetForConnection,
    getNetById,
    addConnectionToNet,
    createNet,
    mergeNets,
    removeConnection,
    clearAllNets,
    getAllConnections,
    setNets,
  };
}
