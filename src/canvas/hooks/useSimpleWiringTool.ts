/**
 * Simple Wiring Tool - Works with Database Pin Data
 * A clean, straightforward           if (data && data.type === "pin") {
            console.log(
              `🔍 Found pin: ${pinData.pinNumber} of component ${pinData.componentId}`
            );
            // Get the pin's center point, transforming if it's inside a group
            let pinCenter = obj.getCenterPoint();
            if (groupTransform) {
              pinCenter = fabric.util.transformPoint(pinCenter, groupTransform);
            }

            console.log(`🔍 Pin local center: (${obj.getCenterPoint().x.toFixed(1)}, ${obj.getCenterPoint().y.toFixed(1)})`);
            console.log(`🔍 Pin transformed center: (${pinCenter.x.toFixed(1)}, ${pinCenter.y.toFixed(1)})`);
            console.log(`🔍 Mouse point: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);

            // Check if mouse is within pin bounds (simple circle collision)
            const distance = Math.sqrt(
              Math.pow(point.x - pinCenter.x, 2) +
                Math.pow(point.y - pinCenter.y, 2)
            );

            console.log(`🔍 Distance: ${distance.toFixed(2)}px (threshold: 6px)`);for connecting component pins
 * Integrated with netlist management for electrical connectivity tracking
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import * as fabric from "fabric";
import { useNetlist, NetConnection } from "./useNetlist";

interface PinData {
  name: string;
  number: string;
  electrical_type: string;
  x: number;
  y: number;
  orientation: number;
}

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
  onNetlistChange?: (nets: any[]) => void; // Callback when netlist changes
  initialNetlist?: any[]; // Initial netlist data for restoration
}

interface UseSimpleWiringToolReturn {
  isWireMode: boolean;
  isDrawing: boolean;
  toggleWireMode: () => void;
  exitWireMode: () => void;
  connections: WireConnection[];
  clearAllWires: () => void;
  nets: any[]; // Expose nets for external access
  setNetlist: (nets: any[]) => void; // Method to restore netlist
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

  // Netlist management
  const netlist = useNetlist(initialNetlist);

  // Refs for current drawing state
  const startPinRef = useRef<{
    componentId: string;
    pinNumber: string;
    pin: fabric.Object;
  } | null>(null);
  const currentWireRef = useRef<fabric.Line | null>(null);

  // Find pin at mouse position
  const findPinAtPoint = useCallback(
    (point: fabric.Point): fabric.Object | null => {
      if (!canvas) return null;

      console.log(
        `🔍 Finding pin at point: (${point.x.toFixed(1)}, ${point.y.toFixed(
          1
        )})`
      );

      // Helper function to search for pins recursively
      const findPinRecursive = (
        objects: fabric.Object[],
        groupTransform?: any
      ): fabric.Object | null => {
        for (const obj of objects) {
          // Check if this object itself is a pin
          const pinData = (obj as any).data;
          if (pinData && pinData.type === "pin") {
            console.log(
              `🔍 Found pin: ${pinData.pinNumber} of component ${pinData.componentId}`
            );
            // Get the pin's center point, transforming if it's inside a group
            let pinCenter = obj.getCenterPoint();
            if (groupTransform) {
              pinCenter = fabric.util.transformPoint(pinCenter, groupTransform);
            }

            // Check if mouse is within pin bounds (simple circle collision)
            const distance = Math.sqrt(
              Math.pow(point.x - pinCenter.x, 2) +
                Math.pow(point.y - pinCenter.y, 2)
            );

            console.log(
              `🔍 Pin distance: ${distance.toFixed(
                2
              )}px, center: (${pinCenter.x.toFixed(1)}, ${pinCenter.y.toFixed(
                1
              )}), mouse: (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`
            );

            // Pin radius is approximately 4-6 pixels
            if (distance <= 6) {
              console.log(`✅ Pin clicked: ${pinData.pinNumber}`);
              return obj;
            }
          }

          // If this is a group, search inside it
          if (obj.type === "group") {
            console.log(`🔍 Searching inside group: ${obj.type}`);
            const group = obj as fabric.Group;
            const groupTransformMatrix = group.calcTransformMatrix();
            const groupObjects = group.getObjects();
            console.log(`🔍 Group has ${groupObjects.length} objects`);
            const found = findPinRecursive(groupObjects, groupTransformMatrix);
            if (found) return found;
          }
        }
        return null;
      };

      const objects = canvas.getObjects();
      return findPinRecursive(objects);
    },
    [canvas]
  );

  // Create a wire between two pins
  const createWire = useCallback(
    (
      fromPin: fabric.Object,
      toPin: fabric.Object,
      fromPinData: any,
      toPinData: any
    ) => {
      if (!canvas) return null;

      // Get absolute center points for pins (handling grouped pins)
      const getAbsoluteCenter = (pin: fabric.Object) => {
        const center = pin.getCenterPoint();
        // If pin is in a group, transform to absolute coordinates
        const group = pin.group;
        if (group) {
          return fabric.util.transformPoint(
            center,
            group.calcTransformMatrix()
          );
        }
        return center;
      };

      const fromCenter = getAbsoluteCenter(fromPin);
      const toCenter = getAbsoluteCenter(toPin);

      // Create wire line
      const wire = new fabric.Line(
        [fromCenter.x, fromCenter.y, toCenter.x, toCenter.y],
        {
          stroke: "#0038DF",
          strokeWidth: 2,
          fill: "",
          selectable: true,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
          hoverCursor: "pointer",
        }
      );

      // Store connection data on the wire
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

  // Handle mouse down for starting wire
  const handleMouseDown = useCallback(
    (e: any) => {
      console.log("🔗 handleMouseDown called", {
        isWireMode,
        canvas: !!canvas,
      });
      if (!isWireMode || !canvas) return;

      // Prevent default canvas selection behavior
      e.e.preventDefault();
      e.e.stopPropagation();

      const pointer = canvas.getPointer(e.e);
      const point = new fabric.Point(pointer.x, pointer.y);

      const clickedPin = findPinAtPoint(point);
      console.log(
        "🔗 Clicked pin:",
        clickedPin
          ? `pin ${(clickedPin as any).data?.pinNumber} of component ${
              (clickedPin as any).data?.componentId
            }`
          : "none"
      );
      console.log("🔗 Total objects on canvas:", canvas.getObjects().length);

      if (clickedPin) {
        const pinData = (clickedPin as any).data;

        if (!startPinRef.current) {
          // Start drawing from this pin
          startPinRef.current = {
            componentId: pinData.componentId,
            pinNumber: pinData.pinNumber.toString(),
            pin: clickedPin,
          };

          setIsDrawing(true);

          // Highlight the start pin
          clickedPin.set({
            fill: "#FF6B35",
            stroke: "#E53E3E",
          });
          canvas.renderAll();
        } else if (startPinRef.current.pin !== clickedPin) {
          // Complete the wire to this pin
          const fromPinData = (startPinRef.current.pin as any).data;
          const toPinData = pinData;

          // Check if trying to connect same component
          if (startPinRef.current.componentId === pinData.componentId) {
            console.warn("Cannot connect pin to same component");
            return;
          }

          // Check if trying to connect same pin
          if (
            startPinRef.current.pinNumber === toPinData.pinNumber.toString() &&
            startPinRef.current.componentId === pinData.componentId
          ) {
            console.warn("Cannot connect pin to itself");
            return;
          }

          // Create the wire
          const wire = createWire(
            startPinRef.current.pin,
            clickedPin,
            fromPinData,
            toPinData
          );

          if (wire) {
            const connection: WireConnection = {
              fromComponentId: startPinRef.current.componentId,
              fromPinNumber: startPinRef.current.pinNumber,
              toComponentId: pinData.componentId,
              toPinNumber: toPinData.pinNumber.toString(),
              wire: wire,
            };

            // Netlist management: Add connections to appropriate nets
            const fromConnection: NetConnection = {
              componentId: startPinRef.current.componentId,
              pinNumber: startPinRef.current.pinNumber,
            };
            const toConnection: NetConnection = {
              componentId: pinData.componentId,
              pinNumber: toPinData.pinNumber.toString(),
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
              // Both pins are already in nets
              if (fromNet.netId === toNet.netId) {
                // Already in the same net - this is redundant but allowed
                console.log(
                  `🔗 Connecting pins already in same net: ${fromNet.netId}`
                );
              } else {
                // Different nets - merge them
                console.log(
                  `🔗 Merging nets: ${fromNet.netId} + ${toNet.netId}`
                );
                netlist.mergeNets(fromNet.netId, toNet.netId);
              }
            } else if (fromNet) {
              // Only from pin is in a net - add to pin to it
              console.log(`🔗 Adding pin to existing net: ${fromNet.netId}`);
              netlist.addConnectionToNet(fromNet.netId, toConnection);
            } else if (toNet) {
              // Only to pin is in a net - add from pin to it
              console.log(`🔗 Adding pin to existing net: ${toNet.netId}`);
              netlist.addConnectionToNet(toNet.netId, fromConnection);
            } else {
              // Neither pin is in a net - create a new net
              const newNetId = netlist.createNet([
                fromConnection,
                toConnection,
              ]);
              console.log(`🔗 Created new net: ${newNetId}`);
            }

            setConnections((prev) => [...prev, connection]);

            // Notify parent of netlist change
            if (onNetlistChange) {
              onNetlistChange(netlist.nets);
            }

            console.log(`📊 Current netlist:`, netlist.nets);
          }

          // Reset drawing state
          startPinRef.current.pin.set({
            fill: "#10B981",
            stroke: "#059669",
          });

          startPinRef.current = null;
          setIsDrawing(false);
          canvas.renderAll();
        }
      }
    },
    [isWireMode, canvas, findPinAtPoint, createWire]
  );

  // Handle mouse move for wire preview
  const handleMouseMove = useCallback(
    (e: any) => {
      if (!isWireMode || !isDrawing || !canvas || !startPinRef.current) return;

      // Prevent default canvas behavior during wire drawing
      e.e.preventDefault();
      e.e.stopPropagation();

      const pointer = canvas.getPointer(e.e);

      // Get absolute start point (handling grouped pins)
      const rawStartPoint = startPinRef.current.pin.getCenterPoint();
      const startPoint = startPinRef.current.pin.group
        ? fabric.util.transformPoint(
            rawStartPoint,
            startPinRef.current.pin.group.calcTransformMatrix()
          )
        : rawStartPoint;

      // Update or create preview wire
      if (currentWireRef.current) {
        currentWireRef.current.set({
          x2: pointer.x,
          y2: pointer.y,
        });
      } else {
        currentWireRef.current = new fabric.Line(
          [startPoint.x, startPoint.y, pointer.x, pointer.y],
          {
            stroke: "#0038DF",
            strokeWidth: 2,
            strokeDashArray: [5, 5], // Dashed line for preview
            fill: "",
            selectable: false,
            hasControls: false,
            hasBorders: false,
          }
        );
        canvas.add(currentWireRef.current);
      }

      canvas.renderAll();
    },
    [isWireMode, isDrawing, canvas]
  );

  // Show component pins when entering wire mode
  const showComponentPins = useCallback((canvas: fabric.Canvas) => {
    console.log("👁️ Showing component pins");
    const objects = canvas.getObjects();
    let pinCount = 0;

    const showPinsRecursive = (objects: fabric.Object[], depth = 0) => {
      const indent = "  ".repeat(depth);
      console.log(
        `${indent}🔍 Searching ${objects.length} objects at depth ${depth}`
      );

      for (const obj of objects) {
        console.log(
          `${indent}📦 Object type: ${obj.type}, visible: ${obj.visible}, opacity: ${obj.opacity}`
        );

        if (obj.type === "group") {
          const groupObjects = (obj as fabric.Group).getObjects();
          console.log(
            `${indent}📂 Group has ${groupObjects.length} child objects`
          );

          // Check if this is a component sandwich
          const groupData = (obj as any).data;
          if (groupData && groupData.type === "component") {
            console.log(
              `${indent}🏗️ Found component: ${groupData.componentName} with ${groupObjects.length} parts`
            );
          }

          showPinsRecursive(groupObjects, depth + 1);
        } else {
          // Check if this is a pin
          const data = (obj as any).data;
          console.log(`${indent}🔍 Checking object data:`, data);

          if (data && data.type === "pin") {
            console.log(`${indent}✅ Found pin! Setting visible...`);
            console.log(
              `${indent}📍 Pin position: left=${obj.left}, top=${obj.top}`
            );
            console.log(`${indent}📍 Pin center:`, obj.getCenterPoint());
            if (obj.group) {
              console.log(
                `${indent}📍 Pin is in group, group position: left=${obj.group.left}, top=${obj.group.top}`
              );
              const transformedCenter = fabric.util.transformPoint(
                obj.getCenterPoint(),
                obj.group.calcTransformMatrix()
              );
              console.log(`${indent}📍 Transformed center:`, transformedCenter);
            }
            obj.set({
              visible: true,
              opacity: 1,
            });
            pinCount++;
            console.log(
              `${indent}👁️ Showed pin: ${data.pinId} (${data.pinNumber})`
            );
          } else {
            console.log(`${indent}❌ Not a pin (data.type: ${data?.type})`);
          }
        }
      }
    };

    showPinsRecursive(objects);
    console.log(`👁️ Total pins shown: ${pinCount}`);
    canvas.renderAll();
  }, []);

  // Hide component pins when exiting wire mode
  const hideComponentPins = useCallback((canvas: fabric.Canvas) => {
    console.log("🙈 Hiding component pins");
    const objects = canvas.getObjects();
    let pinCount = 0;

    const hidePinsRecursive = (objects: fabric.Object[]) => {
      for (const obj of objects) {
        if (obj.type === "group") {
          const groupObjects = (obj as fabric.Group).getObjects();
          hidePinsRecursive(groupObjects);
        } else {
          // Check if this is a pin
          const data = (obj as any).data;
          if (data && data.type === "pin") {
            obj.set({
              visible: false,
              opacity: 0,
            });
            pinCount++;
          }
        }
      }
    };

    hidePinsRecursive(objects);
    console.log(`🙈 Total pins hidden: ${pinCount}`);
    canvas.renderAll();
  }, []);

  // Toggle wire mode
  const toggleWireMode = useCallback(() => {
    if (!canvas) {
      console.log("⚠️ toggleWireMode: No canvas available");
      return;
    }

    const newWireMode = !isWireMode;
    console.log(`🔌 toggleWireMode: ${isWireMode} -> ${newWireMode}`);
    setIsWireMode(newWireMode);

    if (!newWireMode) {
      console.log("🔌 Exiting wire mode");
      exitWireMode();
      // Re-enable selection
      canvas.selection = true;
      // Hide pins
      hideComponentPins(canvas);
    } else {
      console.log("🔌 Entering wire mode - setting cursor to crosshair");
      // Enter wire mode - change cursor
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
      // Disable selection to prevent component selection during wiring
      canvas.selection = false;
      // Show pins
      showComponentPins(canvas);
      console.log("🔌 Cursor set to:", canvas.defaultCursor);
    }

    canvas.renderAll();
  }, [isWireMode, canvas]);

  // Exit wire mode
  const exitWireMode = useCallback(() => {
    if (!canvas) return;

    setIsWireMode(false);
    setIsDrawing(false);

    // Reset cursor
    canvas.defaultCursor = "default";
    canvas.hoverCursor = "move";

    // Re-enable selection
    canvas.selection = true;

    // Clean up any preview wire
    if (currentWireRef.current) {
      canvas.remove(currentWireRef.current);
      currentWireRef.current = null;
    }

    // Reset start pin highlight
    if (startPinRef.current) {
      startPinRef.current.pin.set({
        fill: "#10B981",
        stroke: "#059669",
      });
      startPinRef.current = null;
    }

    canvas.renderAll();
  }, [canvas]);

  // Clear all wires
  const clearAllWires = useCallback(() => {
    if (!canvas) return;

    connections.forEach((connection) => {
      canvas.remove(connection.wire);
    });

    setConnections([]);
    netlist.clearAllNets(); // Also clear the netlist

    // Notify parent of netlist change
    if (onNetlistChange) {
      onNetlistChange(netlist.nets);
    }

    canvas.renderAll();
  }, [canvas, connections, netlist, onNetlistChange]);

  // Set up event listeners
  useEffect(() => {
    if (!canvas || !enabled) return;

    console.log("🔗 Setting up wire mode event listeners");

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);

    return () => {
      console.log("🔗 Cleaning up wire mode event listeners");
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
    };
  }, [canvas, enabled, handleMouseDown, handleMouseMove]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (currentWireRef.current && canvas) {
        canvas.remove(currentWireRef.current);
      }
    };
  }, [canvas]);

  // Set netlist (for restoration)
  const setNetlist = useCallback(
    (newNets: any[]) => {
      netlist.setNets(newNets);
      // Update connections based on restored nets
      const allConnections = netlist.getAllConnections();
      // Note: This is a simplified restoration - in a full implementation,
      // you might want to recreate the wire objects on the canvas
      console.log(
        "🔗 Netlist restored with",
        allConnections.length,
        "connections"
      );
    },
    [netlist]
  );

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
