"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as fabric from "fabric";
import { useNetlist, NetConnection } from "./useNetlist";
import { logger } from "@/lib/logger";

interface WireConnection {
  fromComponentId: string;
  fromPinNumber: string;
  toComponentId: string;
  toPinNumber: string;
  wire: fabric.Line;
}

interface UseSimpleWiringToolProps {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
  onNetlistChange?: (nets: any[]) => void;
  initialNetlist?: any[];
}

interface UseSimpleWiringToolReturn {
  isWireMode: boolean;
  isDrawing: boolean;
  toggleWireMode: () => void;
  exitWireMode: () => void;
  connections: WireConnection[];
  clearAllWires: () => void;
  nets: any[];
  setNetlist: (nets: any[]) => void;
}

export function useSimpleWiringTool({
  canvas,
  enabled = true,
  onNetlistChange,
  initialNetlist = [],
}: UseSimpleWiringToolProps): UseSimpleWiringToolReturn {
  const [isWireMode, setIsWireMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [connections, setConnections] = useState<WireConnection[]>([]);
  const netlist = useNetlist(initialNetlist);
  const startPinRef = useRef<{ pin: fabric.Object } | null>(null);
  const currentWireRef = useRef<fabric.Line | null>(null);

  // Find the closest pin at a given point on the canvas
  const findPinAtPoint = useCallback(
    (point: fabric.Point): fabric.Object | null => {
      if (!canvas) return null;

      let foundPin: fabric.Object | null = null;
      let minDistance = Infinity;

      const checkObjects = (objects: fabric.Object[]) => {
        for (const obj of objects) {
          if (obj.type === "group") {
            // Recurse into groups like our componentSandwich
            checkObjects((obj as fabric.Group).getObjects());
          } else {
            const pinData = (obj as any).data;
            if (pinData && pinData.type === "pin") {
              // Calculate the absolute center of the pin, accounting for its group's position and rotation
              let pinCenter = obj.getCenterPoint();
              if (obj.group) {
                pinCenter = fabric.util.transformPoint(
                  pinCenter,
                  obj.group.calcTransformMatrix()
                );
              }

              // Check the distance from the mouse pointer to the pin's center
              const distance = Math.sqrt(
                Math.pow(point.x - pinCenter.x, 2) +
                  Math.pow(point.y - pinCenter.y, 2)
              );

              // If this pin is the closest so far and within the clickable radius, select it.
              if (distance < minDistance && distance <= 6) {
                minDistance = distance;
                foundPin = obj;
              }
            }
          }
        }
      };

      checkObjects(canvas.getObjects());
      return foundPin;
    },
    [canvas]
  );

  // Get the absolute center of a pin object on the canvas
  const getAbsoluteCenter = (pin: fabric.Object) => {
    const center = pin.getCenterPoint();
    if (pin.group) {
      return fabric.util.transformPoint(
        center,
        pin.group.calcTransformMatrix()
      );
    }
    return center;
  };

  // Create a wire between two pins
  const createWire = useCallback(
    (fromPin: fabric.Object, toPin: fabric.Object) => {
      if (!canvas) return null;

      const fromCenter = getAbsoluteCenter(fromPin);
      const toCenter = getAbsoluteCenter(toPin);
      const fromPinData = (fromPin as any).data;
      const toPinData = (toPin as any).data;

      const wire = new fabric.Line(
        [fromCenter.x, fromCenter.y, toCenter.x, toCenter.y],
        {
          stroke: "#0038DF",
          strokeWidth: 2,
          selectable: false, // Wires should not be selectable by default
          hasControls: false,
          hasBorders: false,
          evented: false, // Wires do not respond to events
        }
      );

      (wire as any).connectionData = {
        fromComponentId: fromPinData.componentId,
        fromPinNumber: fromPinData.pinNumber.toString(),
        toComponentId: toPinData.componentId,
        toPinNumber: toPinData.pinNumber.toString(),
      };

      canvas.add(wire);
      return wire;
    },
    [canvas]
  );

  // Handle mouse down for starting or ending a wire
  const handleMouseDown = useCallback(
    (e: fabric.TEvent) => {
      if (!isWireMode || !canvas) return;

      const event = e.e as MouseEvent;
      event.preventDefault();
      event.stopPropagation();

      const pointer = canvas.getPointer(e.e);
      const clickedPin = findPinAtPoint(pointer);

      if (clickedPin) {
        const pinData = (clickedPin as any).data;

        if (!startPinRef.current) {
          // Start drawing a new wire from this pin
          startPinRef.current = { pin: clickedPin };
          setIsDrawing(true);
          clickedPin.set({ fill: "#FF6B35", stroke: "#E53E3E" });
          canvas.renderAll();
        } else if (startPinRef.current.pin !== clickedPin) {
          // Complete the wire to this pin
          const fromPin = startPinRef.current.pin;
          const fromPinData = (fromPin as any).data;

          if (fromPinData.componentId === pinData.componentId) {
            logger.wire("Cannot connect a component to itself.");
            return;
          }

          const wire = createWire(fromPin, clickedPin);
          if (wire) {
            const connection: WireConnection = {
              fromComponentId: fromPinData.componentId,
              fromPinNumber: fromPinData.pinNumber,
              toComponentId: pinData.componentId,
              toPinNumber: pinData.pinNumber,
              wire,
            };
            setConnections((prev) => [...prev, connection]);

            // ** CORRECTED NETLIST LOGIC **
            const fromConnection: NetConnection = {
              componentId: fromPinData.componentId,
              pinNumber: fromPinData.pinNumber,
            };
            const toConnection: NetConnection = {
              componentId: pinData.componentId,
              pinNumber: pinData.pinNumber,
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
              }
            } else if (fromNet) {
              logger.wire(`Adding pin to existing net: ${fromNet.netId}`);
              netlist.addConnectionToNet(fromNet.netId, toConnection);
            } else if (toNet) {
              logger.wire(`Adding pin to existing net: ${toNet.netId}`);
              netlist.addConnectionToNet(toNet.netId, fromConnection);
            } else {
              const newNetId = netlist.createNet([
                fromConnection,
                toConnection,
              ]);
              logger.wire(`Created new net: ${newNetId}`);
            }

            if (onNetlistChange) {
              onNetlistChange(netlist.nets);
            }
          }

          // Reset drawing state and pin appearance
          fromPin.set({ fill: "rgba(0, 255, 0, 0.7)", stroke: "#059669" });
          startPinRef.current = null;
          setIsDrawing(false);
          canvas.renderAll();
        }
      }
    },
    [isWireMode, canvas, findPinAtPoint, createWire, netlist, onNetlistChange]
  );

  // Handle mouse move for wire preview
  const handleMouseMove = useCallback(
    (e: fabric.TEvent) => {
      if (!isDrawing || !canvas || !startPinRef.current) return;

      const event = e.e as MouseEvent;
      const pointer = canvas.getPointer(event);
      const startPoint = getAbsoluteCenter(startPinRef.current.pin);

      if (currentWireRef.current) {
        currentWireRef.current.set({ x2: pointer.x, y2: pointer.y });
      } else {
        currentWireRef.current = new fabric.Line(
          [startPoint.x, startPoint.y, pointer.x, pointer.y],
          {
            stroke: "#0038DF",
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
          }
        );
        canvas.add(currentWireRef.current);
      }
      canvas.requestRenderAll();
    },
    [isDrawing, canvas]
  );

  // Recursively show or hide pins within any group structure
  const setPinsVisible = useCallback(
    (visible: boolean) => {
      if (!canvas) return;
      const objects = canvas.getObjects();
      const visibilityFn = (objects: fabric.Object[]) => {
        for (const obj of objects) {
          if (obj.type === "group") {
            visibilityFn((obj as fabric.Group).getObjects());
          } else if ((obj as any).data?.type === "pin") {
            obj.set({ visible, opacity: visible ? 1 : 0 });
          }
        }
      };
      visibilityFn(objects);
      canvas.renderAll();
    },
    [canvas]
  );

  // ** MOVED THIS FUNCTION UP **
  // Clean up and exit wire mode
  const exitWireMode = useCallback(() => {
    setIsWireMode(false);
    setIsDrawing(false);
    if (canvas) {
      canvas.selection = true;
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
      setPinsVisible(false);
      if (currentWireRef.current) {
        canvas.remove(currentWireRef.current);
        currentWireRef.current = null;
      }
      if (startPinRef.current) {
        startPinRef.current.pin.set({
          fill: "rgba(0, 255, 0, 0.7)",
          stroke: "#059669",
        });
        startPinRef.current = null;
      }
      canvas.renderAll();
    }
  }, [canvas, setPinsVisible]);

  // Toggle wire mode on/off
  const toggleWireMode = useCallback(() => {
    setIsWireMode((prev) => {
      const newMode = !prev;
      if (canvas) {
        canvas.selection = !newMode;
        canvas.defaultCursor = newMode ? "crosshair" : "default";
        canvas.hoverCursor = newMode ? "crosshair" : "move";
        setPinsVisible(newMode);
        if (!newMode) exitWireMode(); // Now 'exitWireMode' is defined and accessible
      }
      return newMode;
    });
  }, [canvas, setPinsVisible, exitWireMode]);

  // Clear all wires from the canvas and netlist
  const clearAllWires = useCallback(() => {
    if (!canvas) return;
    connections.forEach((conn) => canvas.remove(conn.wire));
    setConnections([]);
    netlist.clearAllNets();
    if (onNetlistChange) {
      onNetlistChange(netlist.nets);
    }
    canvas.renderAll();
  }, [canvas, connections, netlist, onNetlistChange]);

  // Restore netlist from initial data
  const setNetlist = useCallback(
    (newNets: any[]) => {
      netlist.setNets(newNets);
      logger.wire("Netlist restored with", newNets.length, "nets");
    },
    [netlist]
  );

  // Set up and tear down event listeners
  useEffect(() => {
    if (!canvas || !enabled) return;
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
    };
  }, [canvas, enabled, handleMouseDown, handleMouseMove]);

  return {
    isWireMode,
    isDrawing,
    toggleWireMode,
    exitWireMode,
    connections,
    clearAllWires,
    nets: netlist.nets,
    setNetlist,
  };
}
