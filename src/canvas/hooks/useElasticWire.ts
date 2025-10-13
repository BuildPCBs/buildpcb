/**
 * Elastic Wire Hook for BuildPCBs
 *
 * Provides a React hook for managing elastic wires in PCB schematic design.
 * Integrates with the netlist system and provides smooth elastic behavior.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import * as fabric from "fabric";
import {
  ElasticWire,
  ElasticWireConfig,
  DEFAULT_ELASTIC_CONFIG,
} from "./ElasticWire";
import { useNetlist, NetConnection } from "./useNetlist";
import { logger } from "@/lib/logger";

interface ElasticWireConnection {
  id: string;
  elasticWire: ElasticWire;
  fromComponentId: string;
  fromPinNumber: string;
  toComponentId: string;
  toPinNumber: string;
  netId: string;
}

interface UseElasticWireProps {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
  config?: Partial<ElasticWireConfig>;
  onNetlistChange?: (nets: any[]) => void;
  initialNetlist?: any[];
}

interface UseElasticWireReturn {
  // State
  isElasticMode: boolean;
  isDrawing: boolean;
  currentElasticWire: ElasticWire | null;
  elasticConnections: ElasticWireConnection[];

  // Actions
  toggleElasticMode: () => void;
  exitElasticMode: () => void;
  startElasticWire: (startPoint: fabric.Point, startPin: fabric.Object) => void;
  updateElasticWire: (
    endPoint: fabric.Point,
    targetPin?: fabric.Object
  ) => void;
  finishElasticWire: (endPin: fabric.Object) => void;
  cancelElasticWire: () => void;
  addBendPoint: (point: fabric.Point) => void;
  clearBendPoints: () => void;

  // Management
  clearAllElasticWires: () => void;
  getElasticWireById: (id: string) => ElasticWireConnection | null;
  removeElasticWire: (id: string) => void;

  // Net integration
  nets: any[];
  setNetlist: (nets: any[]) => void;

  // Serialization
  serializeElasticWires: () => any[];
  deserializeElasticWires: (data: any[]) => void;
}

/**
 * Hook for managing elastic wires in PCB schematic design
 */
export function useElasticWire({
  canvas,
  enabled = true,
  config = {},
  onNetlistChange,
  initialNetlist = [],
}: UseElasticWireProps): UseElasticWireReturn {
  const [isElasticMode, setIsElasticMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElasticWire, setCurrentElasticWire] =
    useState<ElasticWire | null>(null);
  const [elasticConnections, setElasticConnections] = useState<
    ElasticWireConnection[]
  >([]);

  const netlist = useNetlist(initialNetlist);
  const wireCounterRef = useRef(0);
  const startPinRef = useRef<fabric.Object | null>(null);

  const elasticConfig = { ...DEFAULT_ELASTIC_CONFIG, ...config };

  /**
   * Generate unique elastic wire ID
   */
  const generateWireId = useCallback(() => {
    wireCounterRef.current += 1;
    return `elastic_wire_${wireCounterRef.current.toString().padStart(3, "0")}`;
  }, []);

  /**
   * Get absolute center of a pin object
   */
  const getAbsoluteCenter = useCallback((pin: fabric.Object): fabric.Point => {
    if (pin.group) {
      const pinCenter = new fabric.Point(pin.left || 0, pin.top || 0);
      return fabric.util.transformPoint(
        pinCenter,
        pin.group.calcTransformMatrix()
      );
    }
    return new fabric.Point(pin.left || 0, pin.top || 0);
  }, []);

  /**
   * Find a pin by component ID and pin number
   */
  const findPinByComponentAndNumber = useCallback(
    (componentId: string, pinNumber: string): fabric.Object | null => {
      if (!canvas) return null;

      const objects = canvas.getObjects();
      for (const obj of objects) {
        if (obj.type === "group") {
          const groupObjects = (obj as fabric.Group).getObjects();
          for (const groupObj of groupObjects) {
            const pinData = (groupObj as any).data;
            if (
              pinData &&
              pinData.type === "pin" &&
              pinData.componentId === componentId &&
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
    },
    [canvas]
  );

  /**
   * Toggle elastic wire mode
   */
  const toggleElasticMode = useCallback(() => {
    if (!enabled) return;

    setIsElasticMode((prev) => {
      const newMode = !prev;
      logger.wire(`Elastic wire mode: ${newMode ? "ENABLED" : "DISABLED"}`);
      return newMode;
    });
  }, [enabled]);

  /**
   * Exit elastic wire mode
   */
  const exitElasticMode = useCallback(() => {
    setIsElasticMode(false);
    cancelElasticWire();
    logger.wire("Exited elastic wire mode");
  }, []);

  /**
   * Start drawing an elastic wire
   */
  const startElasticWire = useCallback(
    (startPoint: fabric.Point, startPin: fabric.Object) => {
      if (!isElasticMode || !canvas) return;

      logger.wire("Starting elastic wire", startPoint);

      // Cancel any existing wire
      cancelElasticWire();

      // Create new elastic wire
      const elasticWire = new ElasticWire(
        startPoint,
        startPoint,
        elasticConfig,
        canvas
      );
      setCurrentElasticWire(elasticWire);
      setIsDrawing(true);
      startPinRef.current = startPin;

      // Add to canvas
      const fabricObject = elasticWire.getFabricObject();
      if (fabricObject) {
        canvas.add(fabricObject);
        canvas.renderAll();
      }
    },
    [isElasticMode, canvas, elasticConfig]
  );

  /**
   * Update the current elastic wire as mouse moves
   */
  const updateElasticWire = useCallback(
    (endPoint: fabric.Point, targetPin?: fabric.Object) => {
      if (!currentElasticWire || !isDrawing) return;

      // Use pin center if snapping to a pin
      const actualEndPoint = targetPin
        ? getAbsoluteCenter(targetPin)
        : endPoint;

      currentElasticWire.updateEndPoint(actualEndPoint);

      logger.wire(
        `Updated elastic wire endpoint: (${actualEndPoint.x}, ${actualEndPoint.y})`
      );
    },
    [currentElasticWire, isDrawing, getAbsoluteCenter]
  );

  /**
   * Finish drawing the elastic wire
   */
  const finishElasticWire = useCallback(
    (endPin: fabric.Object) => {
      if (!currentElasticWire || !startPinRef.current || !canvas) return;

      const startPinData = (startPinRef.current as any).data;
      const endPinData = (endPin as any).data;

      if (!startPinData || !endPinData) {
        logger.wire("Invalid pin data, canceling elastic wire");
        cancelElasticWire();
        return;
      }

      // Prevent connecting to same component
      if (startPinData.componentId === endPinData.componentId) {
        logger.wire("Cannot connect elastic wire to same component");
        cancelElasticWire();
        return;
      }

      logger.wire("Finishing elastic wire");

      // Set connection data
      currentElasticWire.setConnectionData({
        fromComponentId: startPinData.componentId,
        fromPinNumber: startPinData.pinNumber.toString(),
        toComponentId: endPinData.componentId,
        toPinNumber: endPinData.pinNumber.toString(),
      });

      // Convert to regular wire
      const regularWire = currentElasticWire.convertToRegularWire();
      if (regularWire) {
        // Remove elastic wire from canvas
        const elasticFabricObject = currentElasticWire.getFabricObject();
        if (elasticFabricObject) {
          canvas.remove(elasticFabricObject);
        }

        // Add regular wire to canvas
        canvas.add(regularWire);

        // Create connection record
        const wireId = generateWireId();
        const connection: ElasticWireConnection = {
          id: wireId,
          elasticWire: currentElasticWire,
          fromComponentId: startPinData.componentId,
          fromPinNumber: startPinData.pinNumber.toString(),
          toComponentId: endPinData.componentId,
          toPinNumber: endPinData.pinNumber.toString(),
          netId: "",
        };

        // Add to netlist
        const fromConnection: NetConnection = {
          componentId: startPinData.componentId,
          pinNumber: startPinData.pinNumber,
        };
        const toConnection: NetConnection = {
          componentId: endPinData.componentId,
          pinNumber: endPinData.pinNumber,
        };

        const fromNet = netlist.getNetForConnection(
          fromConnection.componentId,
          fromConnection.pinNumber
        );
        const toNet = netlist.getNetForConnection(
          toConnection.componentId,
          toConnection.pinNumber
        );

        if (fromNet && toNet) {
          if (fromNet.netId !== toNet.netId) {
            logger.wire(`Merging nets: ${fromNet.netId} + ${toNet.netId}`);
            netlist.mergeNets(fromNet.netId, toNet.netId);
            connection.netId = fromNet.netId;
          }
        } else if (fromNet) {
          logger.wire(`Adding to existing net: ${fromNet.netId}`);
          netlist.addConnectionToNet(fromNet.netId, toConnection);
          connection.netId = fromNet.netId;
        } else if (toNet) {
          logger.wire(`Adding to existing net: ${toNet.netId}`);
          netlist.addConnectionToNet(toNet.netId, fromConnection);
          connection.netId = toNet.netId;
        } else {
          const newNetId = netlist.createNet([fromConnection, toConnection]);
          logger.wire(`Created new net: ${newNetId}`);
          connection.netId = newNetId;
        }

        // Add to connections
        setElasticConnections((prev) => [...prev, connection]);

        // Manually construct updated netlist to avoid async state timing issues
        let updatedNets = [...netlist.nets];
        if (fromNet && toNet) {
          if (fromNet.netId !== toNet.netId) {
            // Merging nets: remove toNet, update fromNet with merged connections
            updatedNets = updatedNets.filter(
              (net) => net.netId !== toNet.netId
            );
            const mergedNetIndex = updatedNets.findIndex(
              (net) => net.netId === fromNet.netId
            );
            if (mergedNetIndex !== -1) {
              updatedNets[mergedNetIndex] = {
                ...updatedNets[mergedNetIndex],
                connections: [...fromNet.connections, ...toNet.connections],
              };
            }
          }
        } else if (fromNet) {
          // Adding to existing net
          const netIndex = updatedNets.findIndex(
            (net) => net.netId === fromNet.netId
          );
          if (netIndex !== -1) {
            updatedNets[netIndex] = {
              ...updatedNets[netIndex],
              connections: [...fromNet.connections, toConnection],
            };
          }
        } else if (toNet) {
          // Adding to existing net
          const netIndex = updatedNets.findIndex(
            (net) => net.netId === toNet.netId
          );
          if (netIndex !== -1) {
            updatedNets[netIndex] = {
              ...updatedNets[netIndex],
              connections: [...toNet.connections, fromConnection],
            };
          }
        } else {
          // Creating new net
          const newNet = {
            netId: connection.netId,
            connections: [fromConnection, toConnection],
          };
          updatedNets = [...updatedNets, newNet];
        }

        if (onNetlistChange) {
          onNetlistChange(updatedNets);
        }
      }

      // Reset state
      setCurrentElasticWire(null);
      setIsDrawing(false);
      startPinRef.current = null;

      canvas.renderAll();
      logger.wire("Elastic wire completed successfully");
    },
    [
      currentElasticWire,
      startPinRef,
      canvas,
      generateWireId,
      netlist,
      onNetlistChange,
    ]
  );

  /**
   * Cancel the current elastic wire
   */
  const cancelElasticWire = useCallback(() => {
    if (currentElasticWire && canvas) {
      const fabricObject = currentElasticWire.getFabricObject();
      if (fabricObject) {
        canvas.remove(fabricObject);
      }
      currentElasticWire.destroy();
    }

    setCurrentElasticWire(null);
    setIsDrawing(false);
    startPinRef.current = null;

    if (canvas) {
      canvas.renderAll();
    }

    logger.wire("Elastic wire canceled");
  }, [currentElasticWire, canvas]);

  /**
   * Add a bend point to the current elastic wire
   */
  const addBendPoint = useCallback(
    (point: fabric.Point) => {
      if (currentElasticWire) {
        currentElasticWire.addBendPoint(point);
        logger.wire(
          `Added bend point to elastic wire: (${point.x}, ${point.y})`
        );
      }
    },
    [currentElasticWire]
  );

  /**
   * Clear bend points from the current elastic wire
   */
  const clearBendPoints = useCallback(() => {
    if (currentElasticWire) {
      currentElasticWire.clearBendPoints();
      logger.wire("Cleared bend points from elastic wire");
    }
  }, [currentElasticWire]);

  /**
   * Clear all elastic wires
   */
  const clearAllElasticWires = useCallback(() => {
    if (!canvas) return;

    // Remove all elastic wire fabric objects from canvas
    elasticConnections.forEach((connection) => {
      const fabricObject = connection.elasticWire.getFabricObject();
      if (fabricObject) {
        canvas.remove(fabricObject);
      }
      connection.elasticWire.destroy();
    });

    // Clear state
    setElasticConnections([]);
    setCurrentElasticWire(null);
    setIsDrawing(false);
    startPinRef.current = null;

    // Clear netlist
    netlist.clearAllNets();

    if (onNetlistChange) {
      onNetlistChange([]); // Pass empty array directly since clearAllNets is asynchronous
    }

    canvas.renderAll();
    logger.wire("Cleared all elastic wires");
  }, [canvas, elasticConnections, netlist, onNetlistChange]);

  /**
   * Get elastic wire connection by ID
   */
  const getElasticWireById = useCallback(
    (id: string): ElasticWireConnection | null => {
      return (
        elasticConnections.find((connection) => connection.id === id) || null
      );
    },
    [elasticConnections]
  );

  /**
   * Remove an elastic wire by ID
   */
  const removeElasticWire = useCallback(
    (id: string) => {
      if (!canvas) return;

      const connection = elasticConnections.find((conn) => conn.id === id);
      if (connection) {
        // Remove from canvas
        const fabricObject = connection.elasticWire.getFabricObject();
        if (fabricObject) {
          canvas.remove(fabricObject);
        }

        // Remove from netlist
        const fromConnection: NetConnection = {
          componentId: connection.fromComponentId,
          pinNumber: connection.fromPinNumber,
        };
        const toConnection: NetConnection = {
          componentId: connection.toComponentId,
          pinNumber: connection.toPinNumber,
        };

        netlist.removeConnection(
          fromConnection.componentId,
          fromConnection.pinNumber
        );
        netlist.removeConnection(
          toConnection.componentId,
          toConnection.pinNumber
        );

        // Remove from connections
        setElasticConnections((prev) => prev.filter((conn) => conn.id !== id));

        // Manually construct updated netlist to avoid async state timing issues
        let updatedNets = [...netlist.nets];

        // Find and update nets that contained these connections
        updatedNets = updatedNets
          .map((net) => {
            const filteredConnections = net.connections.filter(
              (conn) =>
                !(
                  conn.componentId === fromConnection.componentId &&
                  conn.pinNumber === fromConnection.pinNumber
                ) &&
                !(
                  conn.componentId === toConnection.componentId &&
                  conn.pinNumber === toConnection.pinNumber
                )
            );
            return {
              ...net,
              connections: filteredConnections,
            };
          })
          .filter((net) => net.connections.length > 1); // Remove nets with 0 or 1 connections

        // Destroy the elastic wire
        connection.elasticWire.destroy();

        if (onNetlistChange) {
          onNetlistChange(updatedNets);
        }

        canvas.renderAll();
        logger.wire(`Removed elastic wire: ${id}`);
      }
    },
    [canvas, elasticConnections, netlist, onNetlistChange]
  );

  /**
   * Serialize elastic wires for database storage
   */
  const serializeElasticWires = useCallback((): any[] => {
    return elasticConnections.map((connection) => ({
      id: connection.id,
      wireData: connection.elasticWire.serialize(),
      fromComponentId: connection.fromComponentId,
      fromPinNumber: connection.fromPinNumber,
      toComponentId: connection.toComponentId,
      toPinNumber: connection.toPinNumber,
      netId: connection.netId,
    }));
  }, [elasticConnections]);

  /**
   * Deserialize elastic wires from database data
   */
  const deserializeElasticWires = useCallback(
    (data: any[]) => {
      if (!canvas) return;

      const newConnections: ElasticWireConnection[] = [];

      data.forEach((item) => {
        try {
          const elasticWire = ElasticWire.deserialize(item.wireData, canvas);
          const fabricObject = elasticWire.getFabricObject();

          if (fabricObject) {
            canvas.add(fabricObject);

            const connection: ElasticWireConnection = {
              id: item.id,
              elasticWire,
              fromComponentId: item.fromComponentId,
              fromPinNumber: item.fromPinNumber,
              toComponentId: item.toComponentId,
              toPinNumber: item.toPinNumber,
              netId: item.netId,
            };

            newConnections.push(connection);
          }
        } catch (error) {
          logger.wire(`Failed to deserialize elastic wire ${item.id}:`, error);
        }
      });

      setElasticConnections(newConnections);
      canvas.renderAll();

      logger.wire(`Deserialized ${newConnections.length} elastic wires`);
    },
    [canvas]
  );

  /**
   * Handle keyboard events for elastic wire mode
   */
  useEffect(() => {
    if (!isElasticMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDrawing) {
        logger.wire("Escape pressed, canceling elastic wire");
        cancelElasticWire();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isElasticMode, isDrawing, cancelElasticWire]);

  /**
   * Handle component movement to update elastic wires
   */
  useEffect(() => {
    if (!canvas || !enabled) return;

    const handleComponentMoving = (e: fabric.TEvent) => {
      const target = (e as any).target;
      if (!target) return;

      // Handle multiple selection (ActiveSelection)
      if (target.type === "activeSelection") {
        const selectedObjects = (target as any)._objects || [];
        const componentIds: string[] = [];

        // Collect all component IDs from selection
        selectedObjects.forEach((obj: any) => {
          const objData = obj.data;
          if (objData && objData.type === "component" && objData.componentId) {
            componentIds.push(objData.componentId);
          }
        });

        if (componentIds.length > 0) {
          logger.wire(
            `Elastic wire: Multiple components moving (${componentIds.length}) - updating wires`
          );

          // Update elastic wires for all selected components
          elasticConnections.forEach((connection) => {
            if (
              componentIds.includes(connection.fromComponentId) ||
              componentIds.includes(connection.toComponentId)
            ) {
              const fromPin = findPinByComponentAndNumber(
                connection.fromComponentId,
                connection.fromPinNumber
              );
              const toPin = findPinByComponentAndNumber(
                connection.toComponentId,
                connection.toPinNumber
              );

              if (fromPin && toPin) {
                const fromPoint = getAbsoluteCenter(fromPin);
                const toPoint = getAbsoluteCenter(toPin);
                connection.elasticWire.updateEndPoint(toPoint);
              }
            }
          });
        }

        canvas.renderAll();
        return;
      }

      // Handle single component movement
      const componentData = (target as any).data;
      if (!componentData || componentData.type !== "component") return;

      const componentId = componentData.componentId;
      if (!componentId) return;

      logger.wire(
        "Elastic wire: Component moving - updating wires for:",
        componentId
      );

      // Update elastic wires for this component
      elasticConnections.forEach((connection) => {
        if (
          connection.fromComponentId === componentId ||
          connection.toComponentId === componentId
        ) {
          logger.wire(
            "Elastic wire: Found connection to update:",
            connection.fromComponentId,
            "->",
            connection.toComponentId
          );
          // Find the current pin positions
          const fromPin = findPinByComponentAndNumber(
            connection.fromComponentId,
            connection.fromPinNumber
          );
          const toPin = findPinByComponentAndNumber(
            connection.toComponentId,
            connection.toPinNumber
          );

          if (fromPin && toPin) {
            const fromPoint = getAbsoluteCenter(fromPin);
            const toPoint = getAbsoluteCenter(toPin);
            logger.wire(
              "Elastic wire: Updating endpoint from",
              fromPoint,
              "to",
              toPoint
            );
            connection.elasticWire.updateEndPoint(toPoint);
          } else {
            logger.wire("Elastic wire: Could not find pins for update");
          }
        }
      });

      canvas.renderAll();
    };

    canvas.on("object:moving", handleComponentMoving);

    return () => {
      canvas.off("object:moving", handleComponentMoving);
    };
  }, [
    canvas,
    enabled,
    elasticConnections,
    getAbsoluteCenter,
    findPinByComponentAndNumber,
  ]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (currentElasticWire) {
        currentElasticWire.destroy();
      }
      elasticConnections.forEach((connection) => {
        connection.elasticWire.destroy();
      });
    };
  }, [currentElasticWire, elasticConnections]);

  return {
    // State
    isElasticMode,
    isDrawing,
    currentElasticWire,
    elasticConnections,

    // Actions
    toggleElasticMode,
    exitElasticMode,
    startElasticWire,
    updateElasticWire,
    finishElasticWire,
    cancelElasticWire,
    addBendPoint,
    clearBendPoints,

    // Management
    clearAllElasticWires,
    getElasticWireById,
    removeElasticWire,

    // Net integration
    nets: netlist.nets,
    setNetlist: netlist.setNets,

    // Serialization
    serializeElasticWires,
    deserializeElasticWires,
  };
}
