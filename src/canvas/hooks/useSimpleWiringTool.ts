"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import * as fabric from "fabric";
import { useNetlist, NetConnection } from "./useNetlist";
import { useElasticWire } from "./useElasticWire";
import { logger } from "@/lib/logger";

interface WireConnection {
  fromComponentId: string;
  fromPinNumber: string;
  toComponentId: string;
  toPinNumber: string;
  wire: fabric.Line | fabric.Path;
  bendPoints?: fabric.Point[]; // Store original bend points for path reconstruction
  isMultiSegment?: boolean; // Flag to indicate if this is a multi-segment wire
}

interface UseSimpleWiringToolProps {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
  onNetlistChange?: (nets: any[]) => void;
  initialNetlist?: any[];
  elasticWires?: boolean; // Enable elastic wire behavior
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
  updateWiresForComponent: (componentId: string) => void;
  registerRestoredWire: (
    wire: fabric.Line | fabric.Path,
    fromComponentId: string,
    fromPinNumber: string,
    toComponentId: string,
    toPinNumber: string
  ) => void;
  refreshAllJunctionDots: () => void; // Add junction dot refresh function
  addWireIntersectionDots: () => void; // Add intersection dot calculation
}

export function useSimpleWiringTool({
  canvas,
  enabled = true,
  onNetlistChange,
  initialNetlist = [],
  elasticWires = false,
}: UseSimpleWiringToolProps): UseSimpleWiringToolReturn {
  const [isWireMode, setIsWireMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [connections, setConnections] = useState<WireConnection[]>([]);
  const [bendPoints, setBendPoints] = useState<fabric.Point[]>([]);
  const netlist = useNetlist(initialNetlist);
  const lastNotifiedNetlistLength = useRef(0);

  // Monitor netlist changes and notify parent (only when length actually changes)
  useEffect(() => {
    if (
      onNetlistChange &&
      netlist.nets.length > 0 &&
      netlist.nets.length !== lastNotifiedNetlistLength.current
    ) {
      logger.wire("🔔 Netlist changed, notifying parent:", {
        netCount: netlist.nets.length,
        totalConnections: netlist.nets.reduce(
          (sum, net) => sum + net.connections.length,
          0
        ),
        previousLength: lastNotifiedNetlistLength.current,
      });
      onNetlistChange(netlist.nets);
      lastNotifiedNetlistLength.current = netlist.nets.length;
    }
  }, [netlist.nets]); // Removed onNetlistChange from dependencies
  const startPinRef = useRef<{ pin: fabric.Object } | null>(null);
  const currentWireRef = useRef<fabric.Line | fabric.Path | null>(null);

  // Elastic wire system (conditionally enabled)
  const elasticWire = useElasticWire({
    canvas,
    enabled: elasticWires,
    onNetlistChange,
    initialNetlist,
  });

  // Find the closest pin at a given point on the canvas
  const findPinAtPoint = useCallback(
    (point: fabric.Point): fabric.Object | null => {
      if (!canvas) return null;

      logger.wire("Searching for pin at:", point.x, point.y);
      let foundPin: fabric.Object | null = null;
      let minDistance = Infinity;
      let totalPinsChecked = 0;

      const checkObjects = (objects: fabric.Object[]) => {
        for (const obj of objects) {
          if (obj.type === "group") {
            logger.wire("Checking group:", obj);
            // Recurse into groups like our componentSandwich
            checkObjects((obj as fabric.Group).getObjects());
          } else {
            const pinData = (obj as any).data;
            if (pinData && pinData.type === "pin") {
              totalPinsChecked++;
              // Get the absolute pin center, accounting for group transformation
              let pinCenter: fabric.Point;
              if (obj.group) {
                const relativeCenter = new fabric.Point(
                  obj.left || 0,
                  obj.top || 0
                );
                pinCenter = fabric.util.transformPoint(
                  relativeCenter,
                  obj.group.calcTransformMatrix()
                );
              } else {
                pinCenter = new fabric.Point(obj.left || 0, obj.top || 0);
              }

              logger.wire(
                `Pin ${pinData.pinNumber} at:`,
                pinCenter.x,
                pinCenter.y,
                "visible:",
                obj.visible
              );

              // Check the distance from the mouse pointer to the pin's center
              const distance = Math.sqrt(
                Math.pow(point.x - pinCenter.x, 2) +
                  Math.pow(point.y - pinCenter.y, 2)
              );

              logger.wire(`Distance to pin ${pinData.pinNumber}:`, distance);

              // If this pin is the closest so far and within the clickable radius, select it.
              if (distance < minDistance && distance <= 6) {
                minDistance = distance;
                foundPin = obj;
                logger.wire("New closest pin found:", pinData.pinNumber);
              }
            }
          }
        }
      };

      checkObjects(canvas.getObjects());
      logger.wire("Total pins checked:", totalPinsChecked);
      logger.wire("Closest distance:", minDistance);
      return foundPin;
    },
    [canvas]
  );

  // Get the absolute center of a pin object on the canvas
  // This should match how pins are positioned in componentHandlerSetup.ts
  const getAbsoluteCenter = (pin: fabric.Object) => {
    // If pin is in a group, we need to transform its coordinates
    if (pin.group) {
      const pinCenter = new fabric.Point(pin.left || 0, pin.top || 0);
      return fabric.util.transformPoint(
        pinCenter,
        pin.group.calcTransformMatrix()
      );
    }
    // If not in a group, use direct coordinates
    return new fabric.Point(pin.left || 0, pin.top || 0);
  };

  // RULE #3: Intelligent orthogonal pathfinding (from original useWiringTool)
  const calculateOrthogonalPath = useCallback(
    (
      startPoint: fabric.Point,
      endPoint: fabric.Point,
      obstacles: fabric.Object[] = []
    ): fabric.Point[] => {
      logger.wire("🧭 Calculating intelligent orthogonal path");

      // Simple but effective orthogonal routing algorithm
      const margin = 20; // Clearance around obstacles

      // Calculate direct path segments
      const deltaX = endPoint.x - startPoint.x;
      const deltaY = endPoint.y - startPoint.y;

      // Determine optimal routing direction based on distance
      const path: fabric.Point[] = [startPoint];

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal-first routing
        const midX = startPoint.x + deltaX;
        path.push(new fabric.Point(midX, startPoint.y));
        path.push(new fabric.Point(midX, endPoint.y));
      } else {
        // Vertical-first routing
        const midY = startPoint.y + deltaY;
        path.push(new fabric.Point(startPoint.x, midY));
        path.push(new fabric.Point(endPoint.x, midY));
      }

      path.push(endPoint);

      logger.wire(`📏 Generated path with ${path.length} points`);
      return path;
    },
    []
  );

  // Get pin world coordinates (from original useWiringTool)
  const getPinWorldCoordinates = useCallback(
    (pin: fabric.Object): fabric.Point => {
      const identityMatrix = [1, 0, 0, 1, 0, 0] as fabric.TMat2D;
      return fabric.util.transformPoint(
        new fabric.Point(pin.left || 0, pin.top || 0),
        pin.group?.calcTransformMatrix() || identityMatrix
      );
    },
    []
  );

  // Create a junction dot at a specific position
  const createJunctionDot = useCallback((position: fabric.Point) => {
    const dot = new fabric.Circle({
      radius: 3,
      fill: "#0038DF",
      stroke: "#ffffff",
      strokeWidth: 1,
      left: position.x, // Use exact position since origin is center
      top: position.y, // Use exact position since origin is center
      selectable: false,
      hasControls: false,
      hasBorders: false,
      evented: false,
      originX: "center",
      originY: "center",
    });
    // Mark the dot so we can identify it later
    (dot as any).data = { type: "junctionDot" };
    return dot;
  }, []);

  // Get the actual start and end points of a wire from its path
  const getWireEndpoints = useCallback((wire: fabric.Line | fabric.Path) => {
    if (wire.type === "line") {
      const line = wire as fabric.Line;
      return {
        start: { x: line.x1 || 0, y: line.y1 || 0 },
        end: { x: line.x2 || 0, y: line.y2 || 0 },
      };
    } else if (wire.type === "path") {
      const path = wire as fabric.Path;
      const pathData = path.path;
      if (pathData && pathData.length > 0) {
        // Get the first move command (start point)
        const startCmd = pathData[0];
        if (
          startCmd.length >= 3 &&
          typeof startCmd[1] === "number" &&
          typeof startCmd[2] === "number"
        ) {
          const start = { x: startCmd[1] as number, y: startCmd[2] as number };

          // Find the last line command with coordinates
          let end = start; // Default to start if no line commands found
          for (let i = pathData.length - 1; i >= 0; i--) {
            const cmd = pathData[i];
            if (
              cmd[0] === "L" &&
              cmd.length >= 3 &&
              typeof cmd[1] === "number" &&
              typeof cmd[2] === "number"
            ) {
              end = { x: cmd[1] as number, y: cmd[2] as number };
              break;
            }
          }

          return { start, end };
        }
      }
    }
    return null;
  }, []);

  // Add junction dots for a wire's start and end points - ALWAYS add dots
  const addWireEndpointDots = useCallback(
    (wire: fabric.Line | fabric.Path) => {
      if (!canvas) {
        logger.wire("❌ addWireEndpointDots: No canvas available");
        return;
      }

      // Get the actual wire endpoints from the wire's path
      const endpoints = getWireEndpoints(wire);
      if (!endpoints) {
        logger.wire("❌ addWireEndpointDots: Could not get wire endpoints");
        return;
      }

      logger.wire(
        `🔴 Adding dots at endpoints: start(${endpoints.start.x}, ${endpoints.start.y}), end(${endpoints.end.x}, ${endpoints.end.y})`
      );

      // ALWAYS add dots at the actual wire start and end points
      const startDot = createJunctionDot(
        new fabric.Point(endpoints.start.x, endpoints.start.y)
      );
      (startDot as any).data = { type: "junctionDot", pinConnection: true };
      canvas.add(startDot);

      const endDot = createJunctionDot(
        new fabric.Point(endpoints.end.x, endpoints.end.y)
      );
      (endDot as any).data = { type: "junctionDot", pinConnection: true };
      canvas.add(endDot);

      logger.wire(
        "✅ addWireEndpointDots: Successfully added start and end dots"
      );
    },
    [canvas, createJunctionDot, getWireEndpoints]
  );

  // Remove all junction dots
  const clearJunctionDots = useCallback(() => {
    if (!canvas) return;
    // Remove dots from canvas by checking their type
    const canvasObjects = canvas.getObjects();
    canvasObjects.forEach((obj) => {
      if (obj.type === "circle" && (obj as any).data?.type === "junctionDot") {
        canvas.remove(obj);
      }
    });
  }, [canvas]);

  // Check if two line segments intersect
  const doLinesIntersect = useCallback(
    (
      p1: fabric.Point,
      p2: fabric.Point,
      p3: fabric.Point,
      p4: fabric.Point
    ): fabric.Point | null => {
      const denom =
        (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
      if (Math.abs(denom) < 0.001) return null; // Lines are parallel

      const t =
        ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
      const u =
        -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) /
        denom;

      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return new fabric.Point(
          p1.x + t * (p2.x - p1.x),
          p1.y + t * (p2.y - p1.y)
        );
      }
      return null;
    },
    []
  );

  // Get line segments from a wire (handles both Line and Path objects)
  const getWireSegments = useCallback(
    (wire: fabric.Line | fabric.Path): fabric.Point[][] => {
      const segments: fabric.Point[][] = [];

      if (wire.type === "path") {
        const pathWire = wire as fabric.Path;
        const path = pathWire.path;

        if (!path || !Array.isArray(path)) return segments;

        let currentPoint: fabric.Point | null = null;

        for (const command of path) {
          if (command[0] === "M") {
            currentPoint = new fabric.Point(command[1], command[2]);
          } else if (command[0] === "L" && currentPoint) {
            const nextPoint = new fabric.Point(command[1], command[2]);
            segments.push([currentPoint, nextPoint]);
            currentPoint = nextPoint;
          }
        }
      } else if (wire.type === "line") {
        const lineWire = wire as fabric.Line;
        // For Line objects, create a single segment from start to end
        const startPoint = new fabric.Point(lineWire.x1!, lineWire.y1!);
        const endPoint = new fabric.Point(lineWire.x2!, lineWire.y2!);
        segments.push([startPoint, endPoint]);
      }

      return segments;
    },
    []
  );

  // Add junction dots at wire intersections
  const addWireIntersectionDots = useCallback(() => {
    if (!canvas) return;

    // FIRST: Clear ALL existing intersection dots (NOT endpoint dots)
    // This prevents old intersection dots from leaving "prints" when wires move
    const canvasObjects = canvas.getObjects();
    canvasObjects.forEach((obj) => {
      if (obj.type === "circle" && (obj as any).data?.type === "junctionDot") {
        // Only remove intersection dots (dots WITHOUT pinConnection flag)
        if (!(obj as any).data?.pinConnection) {
          canvas.remove(obj);
        }
      }
    });

    const allSegments: Array<{
      segment: fabric.Point[];
      wire: fabric.Line | fabric.Path;
    }> = [];

    // Collect all segments from all wires
    connections.forEach((connection) => {
      const segments = getWireSegments(connection.wire);
      segments.forEach((segment) => {
        allSegments.push({ segment, wire: connection.wire });
      });
    });

    // Find intersections between different wires
    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        const seg1 = allSegments[i].segment;
        const seg2 = allSegments[j].segment;

        // Skip if segments are from the same wire
        if (allSegments[i].wire === allSegments[j].wire) continue;

        const intersection = doLinesIntersect(
          seg1[0],
          seg1[1],
          seg2[0],
          seg2[1]
        );
        if (intersection) {
          // Create intersection dot (no need to check for existing since we cleared all)
          const intersectionDot = createJunctionDot(intersection);
          // Mark as intersection dot (WITHOUT pinConnection flag)
          (intersectionDot as any).data = { type: "junctionDot" };
          canvas.add(intersectionDot);
        }
      }
    }
  }, [
    canvas,
    connections,
    getWireSegments,
    doLinesIntersect,
    createJunctionDot,
  ]);

  // Comprehensive junction dot refresh - clears all and recalculates based on current wires
  const refreshAllJunctionDots = useCallback(() => {
    if (!canvas) return;

    logger.wire("🔄 Refreshing all junction dots (clear + recalculate)");

    // Clear all existing junction dots
    clearJunctionDots();

    // Add endpoint dots for all current connections
    connections.forEach((connection) => {
      addWireEndpointDots(connection.wire);
    });

    // Recalculate all intersection dots
    addWireIntersectionDots();

    logger.wire("✅ Junction dots refresh completed");
  }, [
    canvas,
    connections,
    clearJunctionDots,
    addWireEndpointDots,
    addWireIntersectionDots,
  ]);

  // Create an orthogonal wire between two pins (KiCad style - only 90° angles)
  const createOrthogonalWire = useCallback(
    (fromPin: fabric.Object, toPin: fabric.Object) => {
      if (!canvas) return null;

      const fromCenter = getAbsoluteCenter(fromPin);
      const toCenter = getAbsoluteCenter(toPin);
      const fromPinData = (fromPin as any).data;
      const toPinData = (toPin as any).data;

      // Calculate orthogonal path (L-shaped with 90° corners)
      const dx = toCenter.x - fromCenter.x;
      const dy = toCenter.y - fromCenter.y;

      // Decide whether to go horizontal first or vertical first
      // Use the longer distance to determine the primary direction
      const goHorizontalFirst = Math.abs(dx) > Math.abs(dy);

      // Create SVG path data for smooth wire rendering
      let pathData = `M ${fromCenter.x} ${fromCenter.y}`;

      if (goHorizontalFirst) {
        // Horizontal first, then vertical
        if (Math.abs(dx) > 1) {
          pathData += ` L ${toCenter.x} ${fromCenter.y}`;
        }
        if (Math.abs(dy) > 1) {
          pathData += ` L ${toCenter.x} ${toCenter.y}`;
        }
      } else {
        // Vertical first, then horizontal
        if (Math.abs(dy) > 1) {
          pathData += ` L ${fromCenter.x} ${toCenter.y}`;
        }
        if (Math.abs(dx) > 1) {
          pathData += ` L ${toCenter.x} ${toCenter.y}`;
        }
      }

      // Create a single path object for smooth wire rendering
      const wirePath = new fabric.Path(pathData, {
        stroke: "#0038DF",
        strokeWidth: 1,
        fill: "",
        selectable: false,
        hasControls: false,
        hasBorders: false,
        evented: false,
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });

      // Add connection data to the path
      (wirePath as any).connectionData = {
        fromComponentId: fromPinData.componentId,
        fromPinNumber: fromPinData.pinNumber.toString(),
        toComponentId: toPinData.componentId,
        toPinNumber: toPinData.pinNumber.toString(),
      };

      canvas.add(wirePath);

      // Return the path as the wire object
      return wirePath;
    },
    [canvas]
  );

  // Create a multi-segment wire with bend points
  const createMultiSegmentWire = useCallback(
    (
      fromPin: fabric.Object,
      bendPoints: fabric.Point[],
      toPoint: fabric.Point
    ) => {
      if (!canvas) return null;

      const fromCenter = getAbsoluteCenter(fromPin);
      const fromPinData = (fromPin as any).data;

      // Create path points: start -> bend points -> end
      const pathPoints = [fromCenter, ...bendPoints, toPoint];

      // Create SVG path data for smooth orthogonal routing
      let pathData = `M ${fromCenter.x} ${fromCenter.y}`;

      for (let i = 1; i < pathPoints.length; i++) {
        const current = pathPoints[i - 1];
        const next = pathPoints[i];

        const dx = next.x - current.x;
        const dy = next.y - current.y;

        // Decide direction based on which distance is larger
        const goHorizontalFirst = Math.abs(dx) > Math.abs(dy);

        if (goHorizontalFirst) {
          // Horizontal first, then vertical
          if (Math.abs(dx) > 1) {
            pathData += ` L ${next.x} ${current.y}`;
          }
          if (Math.abs(dy) > 1) {
            pathData += ` L ${next.x} ${next.y}`;
          }
        } else {
          // Vertical first, then horizontal
          if (Math.abs(dy) > 1) {
            pathData += ` L ${current.x} ${next.y}`;
          }
          if (Math.abs(dx) > 1) {
            pathData += ` L ${next.x} ${next.y}`;
          }
        }
      }

      // Create a single path object for smooth wire rendering
      const wirePath = new fabric.Path(pathData, {
        stroke: "#0038DF",
        strokeWidth: 1,
        fill: "",
        selectable: false,
        hasControls: false,
        hasBorders: false,
        evented: false,
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });

      // Add connection data to the path
      (wirePath as any).connectionData = {
        fromComponentId: fromPinData.componentId,
        fromPinNumber: fromPinData.pinNumber.toString(),
        toComponentId: null, // Will be set when connecting to a pin
        toPinNumber: null,
      };

      canvas.add(wirePath);

      // Return the path as the wire object
      return wirePath;
    },
    [canvas]
  );

  // Handle mouse down for starting or ending a wire
  const handleMouseDown = useCallback(
    (e: fabric.TEvent) => {
      if ((!isWireMode && !elasticWires) || !canvas) return;

      const event = e.e as MouseEvent;
      event.preventDefault();
      event.stopPropagation();

      const pointer = canvas.getPointer(e.e);
      logger.wire("Mouse clicked at:", pointer.x, pointer.y);

      const clickedPin = findPinAtPoint(pointer);
      logger.wire("Found pin:", clickedPin ? "YES" : "NO");

      if (clickedPin) {
        const pinData = (clickedPin as any).data;
        logger.wire("Pin data:", pinData);

        if (elasticWires) {
          // Use elastic wire system
          if (!elasticWire.isDrawing) {
            // Start elastic wire
            const startPoint = getAbsoluteCenter(clickedPin);
            elasticWire.startElasticWire(startPoint, clickedPin);
            clickedPin.set({ fill: "#FF6B35", stroke: "#E53E3E" });
          } else {
            // Finish elastic wire
            elasticWire.finishElasticWire(clickedPin);
            // Reset pin appearance
            clickedPin.set({ fill: "rgba(0, 255, 0, 0.7)", stroke: "#059669" });
          }
        } else {
          // Use traditional wire system
          if (!isWireMode) return;

          if (!startPinRef.current) {
            // Start drawing a new wire from this pin
            logger.wire("Starting wire from pin");
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

            // Create wire - use multi-segment if bend points exist
            const wire =
              bendPoints.length > 0
                ? createMultiSegmentWire(
                    fromPin,
                    bendPoints,
                    getAbsoluteCenter(clickedPin)
                  )
                : createOrthogonalWire(fromPin, clickedPin);

            if (wire) {
              // Determine the net ID for this wire
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

              let wireNetId: string;
              if (fromNet && toNet) {
                if (fromNet.netId !== toNet.netId) {
                  logger.wire(
                    `Merging nets: ${fromNet.netId} + ${toNet.netId}`
                  );
                  netlist.mergeNets(fromNet.netId, toNet.netId);
                  wireNetId = fromNet.netId; // Use the first net's ID
                } else {
                  wireNetId = fromNet.netId;
                }
              } else if (fromNet) {
                logger.wire(`Adding pin to existing net: ${fromNet.netId}`);
                netlist.addConnectionToNet(fromNet.netId, toConnection);
                wireNetId = fromNet.netId;
              } else if (toNet) {
                logger.wire(`Adding pin to existing net: ${toNet.netId}`);
                netlist.addConnectionToNet(toNet.netId, fromConnection);
                wireNetId = toNet.netId;
              } else {
                wireNetId = netlist.createNet([fromConnection, toConnection]);
                logger.wire(`Created new net: ${wireNetId}`);
              }

              // Assign netId to the wire object
              (wire as any).netId = wireNetId;
              (wire as any).wireType = "connection";

              const connection: WireConnection = {
                fromComponentId: fromPinData.componentId,
                fromPinNumber: fromPinData.pinNumber,
                toComponentId: pinData.componentId,
                toPinNumber: pinData.pinNumber,
                wire,
                bendPoints: bendPoints.length > 0 ? [...bendPoints] : undefined,
                isMultiSegment: bendPoints.length > 0,
              };
              setConnections((prev) => [...prev, connection]);

              // Add junction dots at wire endpoints and intersections
              addWireEndpointDots(wire);
              addWireIntersectionDots();

              // Clear bend points after creating the wire
              setBendPoints([]);

              // The useNetlist hook methods (createNet, addConnectionToNet, mergeNets)
              // have already been called and updated the internal state. The useEffect
              // that monitors netlist.nets will automatically notify the parent component
              // when the state update completes.
              logger.wire(
                "🎯 Wire creation completed, useEffect will handle parent notification"
              );
            }

            // Reset drawing state and pin appearance
            logger.wire("Resetting start pin appearance and state");
            fromPin.set({ fill: "rgba(0, 255, 0, 0.7)", stroke: "#059669" });
            startPinRef.current = null;
            setIsDrawing(false);

            // Also clear any preview wires
            if (currentWireRef.current) {
              const previewGroup = (currentWireRef.current as any).previewGroup;
              if (previewGroup && Array.isArray(previewGroup)) {
                previewGroup.forEach((wire: fabric.Line) =>
                  canvas.remove(wire)
                );
              } else {
                canvas.remove(currentWireRef.current);
              }
              currentWireRef.current = null;
            }

            canvas.renderAll();
          } else {
            // Clicked the same pin - cancel the wire
            logger.wire("Clicked same pin, canceling wire");
            const fromPin = startPinRef.current.pin;
            fromPin.set({ fill: "rgba(0, 255, 0, 0.7)", stroke: "#059669" });
            startPinRef.current = null;
            setIsDrawing(false);

            // Clear any preview wires
            if (currentWireRef.current) {
              const previewGroup = (currentWireRef.current as any).previewGroup;
              if (previewGroup && Array.isArray(previewGroup)) {
                previewGroup.forEach((wire: fabric.Line) =>
                  canvas.remove(wire)
                );
              } else {
                canvas.remove(currentWireRef.current);
              }
              currentWireRef.current = null;
            }

            canvas.renderAll();
          }
        }
      } else {
        // Clicked somewhere that's not a pin while drawing - add a bend point
        if (startPinRef.current) {
          logger.wire("Clicked non-pin while drawing, adding bend point");
          const pointer = canvas.getPointer(e.e);

          // Add the current pointer position as a bend point
          setBendPoints((prev) => [
            ...prev,
            new fabric.Point(pointer.x, pointer.y),
          ]);

          // Keep drawing active - don't reset the state
          canvas.renderAll();
        }
      }
    },
    [
      isWireMode,
      elasticWires,
      canvas,
      findPinAtPoint,
      createOrthogonalWire,
      createMultiSegmentWire,
      bendPoints,
      netlist,
      onNetlistChange,
      elasticWire,
      getAbsoluteCenter,
    ]
  );

  // Handle mouse move for orthogonal wire preview (KiCad style)
  const handleMouseMove = useCallback(
    (e: fabric.TEvent) => {
      if ((!isDrawing && !elasticWire.isDrawing) || !canvas) return;

      const event = e.e as MouseEvent;
      const pointer = canvas.getPointer(event);

      if (elasticWires && elasticWire.isDrawing) {
        // Use elastic wire system
        const targetPin = findPinAtPoint(pointer);
        elasticWire.updateElasticWire(pointer, targetPin || undefined);
      } else if (isDrawing && startPinRef.current) {
        // Use traditional wire system
        const startPoint = getAbsoluteCenter(startPinRef.current.pin);

        // Check for pin snapping (6px radius like pin detection)
        const targetPin = findPinAtPoint(pointer);
        const endPoint = targetPin ? getAbsoluteCenter(targetPin) : pointer;

        // Calculate orthogonal preview path
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;

        // Decide direction based on which distance is larger
        const goHorizontalFirst = Math.abs(dx) > Math.abs(dy);

        // Remove ALL existing preview wires properly
        if (currentWireRef.current) {
          const previewGroup = (currentWireRef.current as any).previewGroup;
          if (previewGroup && Array.isArray(previewGroup)) {
            // Remove all preview wires from the previous mouse move
            previewGroup.forEach((wire: fabric.Line) => canvas.remove(wire));
          } else {
            // Remove single preview wire
            canvas.remove(currentWireRef.current);
          }
          currentWireRef.current = null;
        }

        // Create new orthogonal preview wires
        const previewWires: (fabric.Line | fabric.Path)[] = [];
        const values = [2, 3];

        // If we have bend points, create multi-segment preview path
        if (bendPoints.length > 0) {
          // Create path points: start -> bend points -> current mouse position
          const pathPoints = [startPoint, ...bendPoints, endPoint];

          // Create SVG path data for smooth orthogonal preview routing
          let pathData = `M ${startPoint.x} ${startPoint.y}`;

          for (let i = 1; i < pathPoints.length; i++) {
            const current = pathPoints[i - 1];
            const next = pathPoints[i];

            const segmentDx = next.x - current.x;
            const segmentDy = next.y - current.y;

            // Decide direction based on which distance is larger
            const segmentGoHorizontalFirst =
              Math.abs(segmentDx) > Math.abs(segmentDy);

            if (segmentGoHorizontalFirst) {
              // Horizontal first, then vertical
              if (Math.abs(segmentDx) > 1) {
                pathData += ` L ${next.x} ${current.y}`;
              }
              if (Math.abs(segmentDy) > 1) {
                pathData += ` L ${next.x} ${next.y}`;
              }
            } else {
              // Vertical first, then horizontal
              if (Math.abs(segmentDy) > 1) {
                pathData += ` L ${current.x} ${next.y}`;
              }
              if (Math.abs(segmentDx) > 1) {
                pathData += ` L ${next.x} ${next.y}`;
              }
            }
          }

          // Create a single path object for smooth preview rendering
          const previewPath = new fabric.Path(pathData, {
            stroke: "#0038DF",
            strokeWidth: 1,
            strokeDashArray: [values[0], values[1]],
            strokeLineCap: "round",
            strokeLineJoin: "round",
            fill: "",
            selectable: false,
            evented: false,
          });

          previewWires.push(previewPath);
        } else if (goHorizontalFirst) {
          // Horizontal first, then vertical
          if (Math.abs(dx) > 1) {
            const horizontalPreview = new fabric.Line(
              [startPoint.x, startPoint.y, endPoint.x, startPoint.y],
              {
                stroke: "#0038DF",
                strokeWidth: 1,
                strokeDashArray: [values[0], values[1]],
                strokeLineCap: "round",
                selectable: false,
                evented: false,
              }
            );
            previewWires.push(horizontalPreview);
          }
          if (Math.abs(dy) > 1) {
            const verticalPreview = new fabric.Line(
              [endPoint.x, startPoint.y, endPoint.x, endPoint.y],
              {
                stroke: "#0038DF",
                strokeWidth: 1,
                strokeDashArray: [values[0], values[1]],
                strokeLineCap: "round",
                selectable: false,
                evented: false,
              }
            );
            previewWires.push(verticalPreview);
          }
        } else {
          // Vertical first, then horizontal
          if (Math.abs(dy) > 1) {
            const verticalPreview = new fabric.Line(
              [startPoint.x, startPoint.y, startPoint.x, endPoint.y],
              {
                stroke: "#0038DF",
                strokeWidth: 1,
                strokeDashArray: [values[0], values[1]],
                strokeLineCap: "round",
                selectable: false,
                evented: false,
              }
            );
            previewWires.push(verticalPreview);
          }

          if (Math.abs(dx) > 1) {
            const horizontalPreview = new fabric.Line(
              [startPoint.x, endPoint.y, endPoint.x, endPoint.y],
              {
                stroke: "#0038DF",
                strokeWidth: 1,
                strokeDashArray: [values[0], values[1]],
                strokeLineCap: "round",
                selectable: false,
                evented: false,
              }
            );
            previewWires.push(horizontalPreview);
          }
        }

        // Add new preview wires to canvas
        previewWires.forEach((wire) => canvas.add(wire));

        // Store reference to first wire and attach the full group for cleanup
        if (previewWires.length > 0) {
          currentWireRef.current = previewWires[0];
          (currentWireRef.current as any).previewGroup = previewWires;
        }

        canvas.requestRenderAll();
      }
    },
    [
      isDrawing,
      elasticWires,
      elasticWire,
      canvas,
      startPinRef,
      findPinAtPoint,
      getAbsoluteCenter,
      bendPoints,
    ]
  );

  // Recursively show or hide pins within any group structure
  const setPinsVisible = useCallback(
    (visible: boolean) => {
      if (!canvas) return;
      logger.wire("Setting pins visible:", visible);
      const objects = canvas.getObjects();
      let pinsFound = 0;

      const visibilityFn = (objects: fabric.Object[]) => {
        for (const obj of objects) {
          if (obj.type === "group") {
            visibilityFn((obj as fabric.Group).getObjects());
          } else if ((obj as any).data?.type === "pin") {
            pinsFound++;
            obj.set({
              visible: visible,
              opacity: visible ? 1 : 0,
              evented: visible, // Make pins interactive when visible
            });
          }
        }
      };
      visibilityFn(objects);
      logger.wire("Total pins found and updated:", pinsFound);
      canvas.renderAll();
    },
    [canvas]
  );

  // ** MOVED THIS FUNCTION UP **
  // Clean up and exit wire mode
  const exitWireMode = useCallback(() => {
    setIsWireMode(false);
    setIsDrawing(false);
    setBendPoints([]); // Clear bend points
    if (canvas) {
      canvas.selection = true;
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
      (canvas as any).wireMode = false;
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
        (canvas as any).wireMode = newMode;
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
    setBendPoints([]); // Clear bend points
    clearJunctionDots(); // Clear junction dots
    netlist.clearAllNets();
    if (onNetlistChange) {
      logger.wire("🧹 Clearing all nets (netlist empty)");
      onNetlistChange([]); // Pass empty array directly since clearAllNets is asynchronous
    }
    canvas.renderAll();
  }, [canvas, connections, netlist, onNetlistChange, clearJunctionDots]);

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

    // Add keyboard handler for escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (elasticWires && elasticWire.isDrawing) {
          logger.wire("Escape pressed, canceling elastic wire");
          elasticWire.cancelElasticWire();
        } else if (isWireMode && startPinRef.current) {
          logger.wire("Escape pressed, canceling wire");
          const fromPin = startPinRef.current.pin;
          fromPin.set({ fill: "rgba(0, 255, 0, 0.7)", stroke: "#059669" });
          startPinRef.current = null;
          setIsDrawing(false);
          setBendPoints([]); // Clear bend points when canceling

          // Clear any preview wires - use same logic as other cleanup functions
          if (currentWireRef.current) {
            const previewGroup = (currentWireRef.current as any).previewGroup;
            if (previewGroup && Array.isArray(previewGroup)) {
              previewGroup.forEach((wire: fabric.Line | fabric.Path) =>
                canvas.remove(wire)
              );
            } else {
              canvas.remove(currentWireRef.current);
            }
            currentWireRef.current = null;
          }

          canvas.renderAll();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    canvas,
    enabled,
    handleMouseDown,
    handleMouseMove,
    isWireMode,
    elasticWires,
    elasticWire,
  ]);

  // Update wire positions when components move - SIMPLIFIED APPROACH from original useWiringTool
  const updateWiresForComponent = useCallback(
    (componentId: string) => {
      if (!canvas) {
        logger.wire("❌ No canvas available for wire updates");
        return;
      }

      logger.wire(
        "🔄 Updating wires with intelligent rerouting for component:",
        componentId
      );
      logger.wire("📊 Current connections count:", connections.length);

      // Find component - check both canvas objects AND active selection
      const allObjects = canvas.getObjects();
      const activeSelection = canvas.getActiveObject();

      let componentObj = allObjects.find(
        (obj: any) =>
          obj.data?.componentId === componentId || obj.id === componentId
      );

      // If not found in canvas, check if it's in an active selection
      if (
        !componentObj &&
        activeSelection &&
        activeSelection.type === "activeSelection"
      ) {
        const selectedObjects = (activeSelection as any)._objects || [];
        componentObj = selectedObjects.find(
          (obj: any) =>
            obj.data?.componentId === componentId || obj.id === componentId
        );
      }

      if (componentObj && componentObj.type === "group") {
        const groupObjects = (componentObj as fabric.Group).getObjects();
        const pins = groupObjects.filter(
          (obj: any) => obj.data?.type === "pin"
        );
        logger.wire(
          `🔍 Component ${componentId} structure before wire update:`,
          {
            totalObjects: groupObjects.length,
            pins: pins.length,
            inActiveSelection: !allObjects.includes(componentObj),
          }
        );
      }

      // Continue with existing logic using allObjects for obstacles
      const obstacles = allObjects.filter(
        (obj) =>
          (obj as any).componentType &&
          obj.type === "group" &&
          (obj as any).id !== componentId
      );

      // Find all wires connected to this component from our connections array
      const connectedConnections = connections.filter((connection) => {
        return (
          connection.fromComponentId === componentId ||
          connection.toComponentId === componentId
        );
      });

      logger.wire(
        `📍 Found ${connectedConnections.length} wires connected to component`
      );

      // Collect OLD endpoint positions BEFORE updating wires
      // We'll use these to remove old dots at their exact positions
      logger.wire("🧹 Collecting old endpoint positions for cleanup");
      const oldEndpoints = new Set<string>();

      connectedConnections.forEach((connection) => {
        const endpoints = getWireEndpoints(connection.wire);
        if (endpoints) {
          oldEndpoints.add(`${endpoints.start.x},${endpoints.start.y}`);
          oldEndpoints.add(`${endpoints.end.x},${endpoints.end.y}`);
        }
      });

      logger.wire(`📍 Collected ${oldEndpoints.size} old endpoint positions`);

      // Update each connected wire with intelligent rerouting
      connectedConnections.forEach((connection, index) => {
        logger.wire(
          `🔗 Processing connection ${index + 1}/${
            connectedConnections.length
          }:`,
          {
            fromComponentId: connection.fromComponentId,
            toComponentId: connection.toComponentId,
            fromPinNumber: connection.fromPinNumber,
            toPinNumber: connection.toPinNumber,
          }
        );

        const wire = connection.wire;

        try {
          logger.wire(
            `🔗 Applying intelligent rerouting to wire ${index + 1}/${
              connectedConnections.length
            }`
          );

          // Get pin coordinates for the connection
          const fromPin = findPinByComponentAndNumber(
            connection.fromComponentId,
            connection.fromPinNumber
          );
          const toPin = findPinByComponentAndNumber(
            connection.toComponentId,
            connection.toPinNumber
          );

          if (!fromPin || !toPin) {
            logger.wire(
              `  ❌ Could not find pins for connection ${index + 1}:`,
              {
                fromPinFound: !!fromPin,
                toPinFound: !!toPin,
                fromComponentId: connection.fromComponentId,
                toComponentId: connection.toComponentId,
              }
            );
            return;
          }

          logger.wire(`  ✅ Found pins for connection ${index + 1}`);

          // Get current pin positions
          const startPinCoords = getPinWorldCoordinates(fromPin);
          const endPinCoords = getPinWorldCoordinates(toPin);

          logger.wire(`  📍 Pin coordinates:`, {
            start: { x: startPinCoords.x, y: startPinCoords.y },
            end: { x: endPinCoords.x, y: endPinCoords.y },
          });

          // Determine if rerouting is needed
          const shouldReroute =
            connection.fromComponentId === componentId ||
            connection.toComponentId === componentId;

          if (shouldReroute) {
            // Use the same approach as original wire creation - create a single Path object
            logger.wire(
              "  🔧 Recreating wire using original Path-based approach"
            );

            // Get original wire properties to preserve them
            const originalStroke = wire.stroke || "#0038DF";
            const originalStrokeWidth = wire.strokeWidth || 1;

            // Remove existing wire
            canvas.remove(wire);

            // Create new wire using the same logic as createOrthogonalWire
            const dx = endPinCoords.x - startPinCoords.x;
            const dy = endPinCoords.y - startPinCoords.y;
            const goHorizontalFirst = Math.abs(dx) > Math.abs(dy);

            // Create SVG path data for smooth wire rendering
            let pathData = `M ${startPinCoords.x} ${startPinCoords.y}`;

            if (goHorizontalFirst) {
              // Horizontal first, then vertical
              if (Math.abs(dx) > 1) {
                pathData += ` L ${endPinCoords.x} ${startPinCoords.y}`;
              }
              if (Math.abs(dy) > 1) {
                pathData += ` L ${endPinCoords.x} ${endPinCoords.y}`;
              }
            } else {
              // Vertical first, then horizontal
              if (Math.abs(dy) > 1) {
                pathData += ` L ${startPinCoords.x} ${endPinCoords.y}`;
              }
              if (Math.abs(dx) > 1) {
                pathData += ` L ${endPinCoords.x} ${endPinCoords.y}`;
              }
            }

            // Create a single path object for smooth wire rendering (same as original)
            const newWire = new fabric.Path(pathData, {
              stroke: originalStroke,
              strokeWidth: originalStrokeWidth,
              fill: "",
              selectable: false,
              hasControls: false,
              hasBorders: false,
              evented: false,
              strokeLineCap: "round",
              strokeLineJoin: "round",
            });

            // Preserve connection data
            (newWire as any).connectionData = (wire as any).connectionData;

            // Add new wire to canvas
            canvas.add(newWire);

            // Update the connection to reference the new wire
            connection.wire = newWire;

            // Preserve net ID and wire type
            (newWire as any).netId = (wire as any).netId;
            (newWire as any).wireType = (wire as any).wireType || "connection";

            logger.wire(
              `  ✅ Wire recreated with preserved properties: stroke=${originalStroke}, width=${originalStrokeWidth}`
            );
          }
        } catch (error) {
          logger.wire(`  ❌ Error updating wire ${index + 1}:`, error);
        }
      });

      // NOW remove old dots at the OLD endpoint positions
      // This ensures we don't remove the NEW dots we're about to create
      logger.wire("🧹 Removing old dots at old endpoint positions");
      const canvasObjects = canvas.getObjects();
      let dotsRemoved = 0;

      canvasObjects.forEach((obj) => {
        if (
          obj.type === "circle" &&
          (obj as any).data?.type === "junctionDot"
        ) {
          const dotPos = `${obj.left},${obj.top}`;
          if (oldEndpoints.has(dotPos)) {
            canvas.remove(obj);
            dotsRemoved++;
          }
        }
      });

      logger.wire(`🧹 Removed ${dotsRemoved} old junction dots`);

      // Add NEW endpoint dots to all updated wires
      connectedConnections.forEach((connection, index) => {
        logger.wire(`🔴 Adding endpoint dots for wire ${index + 1}`);
        addWireEndpointDots(connection.wire);
      });

      // DON'T recalculate intersection dots during movement - only after movement completes
      // This prevents duplicate intersection dots from being created on every frame
      // Intersection dots will be added in handleObjectMoved event instead

      // Force canvas redraw to show updates
      canvas.renderAll();
      logger.wire(
        "🎨 Canvas redrawn with intelligently rerouted wires and endpoint dots"
      );

      // Handle elastic wires if enabled
      if (elasticWires) {
        elasticWire.elasticConnections.forEach((connection) => {
          if (
            connection.fromComponentId === componentId ||
            connection.toComponentId === componentId
          ) {
            logger.wire(
              "Found elastic wire connection to update:",
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
                "Updating elastic wire endpoint from",
                fromPoint,
                "to",
                toPoint
              );
              connection.elasticWire.updateEndPoint(toPoint);
            } else {
              logger.wire("Could not find pins for elastic wire update");
            }
          }
        });
      }

      // DEBUG: Check component structure after wire updates
      if (componentObj && componentObj.type === "group") {
        const groupObjects = (componentObj as fabric.Group).getObjects();
        const pins = groupObjects.filter(
          (obj: any) => obj.data?.type === "pin"
        );
        logger.wire(
          `🔍 Component ${componentId} structure after wire update:`,
          {
            totalObjects: groupObjects.length,
            pins: pins.length,
            pinDetails: pins.map((pin: any) => ({
              id: pin.data?.pinId,
              visible: pin.visible,
              opacity: pin.opacity,
            })),
          }
        );
      }
    },
    [
      canvas,
      connections,
      calculateOrthogonalPath,
      getPinWorldCoordinates,
      getAbsoluteCenter,
      elasticWires,
      elasticWire,
    ]
  );

  // Helper function to find a pin by component ID and pin number
  const findPinByComponentAndNumber = useCallback(
    (componentId: string, pinNumber: string): fabric.Object | null => {
      if (!canvas) return null;

      // Search in canvas objects
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

      // Also search in active selection if present
      const activeSelection = canvas.getActiveObject();
      if (activeSelection && activeSelection.type === "activeSelection") {
        const selectedObjects = (activeSelection as any)._objects || [];
        for (const obj of selectedObjects) {
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
          }
        }
      }

      return null;
    },
    [canvas]
  );

  // Handle component movement to update connected wires (throttled)
  const handleComponentMoving = useCallback(
    (e: fabric.TEvent) => {
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
            `Multiple components moving (${componentIds.length}) - updating wires`
          );

          // Use requestAnimationFrame to throttle updates and ensure smooth rendering
          requestAnimationFrame(() => {
            componentIds.forEach((componentId) => {
              updateWiresForComponent(componentId);
            });
          });
        }
        return;
      }

      // Handle single component movement
      const componentData = (target as any).data;
      if (!componentData || componentData.type !== "component") return;

      const componentId = componentData.componentId;
      if (!componentId) return;

      logger.wire("Component moving - updating wires for:", componentId);

      // Use requestAnimationFrame to throttle updates and ensure smooth rendering
      requestAnimationFrame(() => {
        updateWiresForComponent(componentId);
      });
    },
    [updateWiresForComponent]
  );

  // Register a wire that was restored from netlist data
  const registerRestoredWire = useCallback(
    (
      wire: fabric.Line | fabric.Path,
      fromComponentId: string,
      fromPinNumber: string,
      toComponentId: string,
      toPinNumber: string
    ) => {
      logger.wire("📝 Registering restored wire with wiring tool:", {
        fromComponentId,
        fromPinNumber,
        toComponentId,
        toPinNumber,
      });

      const wireConnection: WireConnection = {
        fromComponentId,
        fromPinNumber,
        toComponentId,
        toPinNumber,
        wire,
      };

      setConnections((prev) => [...prev, wireConnection]);
      logger.wire("✅ Restored wire registered successfully");
    },
    []
  );

  // Set up component movement listener
  useEffect(() => {
    if (!canvas || !enabled) return;

    canvas.on("object:moving", handleComponentMoving);

    return () => {
      canvas.off("object:moving", handleComponentMoving);
    };
  }, [canvas, enabled, handleComponentMoving]);

  // Update junction dots whenever connections change
  useEffect(() => {
    if (connections.length > 0 && canvas) {
      // Only clear and recalculate intersection dots
      const canvasObjects = canvas.getObjects();
      canvasObjects.forEach((obj) => {
        if (
          obj.type === "circle" &&
          (obj as any).data?.type === "junctionDot" &&
          (obj as any).data?.isIntersection // Only remove intersection dots
        ) {
          canvas.remove(obj);
        }
      });

      // Don't add pin connection dots here - they're handled by movement and creation
      // Only calculate intersection dots

      // Add intersection dots
      const allSegments: Array<{
        segment: fabric.Point[];
        wire: fabric.Line | fabric.Path;
      }> = [];

      // Collect all segments from all wires
      connections.forEach((connection) => {
        const segments = getWireSegments(connection.wire);
        segments.forEach((segment) => {
          allSegments.push({ segment, wire: connection.wire });
        });
      });

      // Find intersections between different wires
      for (let i = 0; i < allSegments.length; i++) {
        for (let j = i + 1; j < allSegments.length; j++) {
          const seg1 = allSegments[i].segment;
          const seg2 = allSegments[j].segment;

          // Skip if segments are from the same wire
          if (allSegments[i].wire === allSegments[j].wire) continue;

          const intersection = doLinesIntersect(
            seg1[0],
            seg1[1],
            seg2[0],
            seg2[1]
          );
          if (intersection) {
            // Check if we already have a dot at this position by looking at canvas objects
            const canvasObjects = canvas.getObjects();
            const existingDot = canvasObjects.find((obj) => {
              if (
                obj.type === "circle" &&
                (obj as any).data?.type === "junctionDot"
              ) {
                const distance = Math.sqrt(
                  Math.pow(obj.left! - intersection.x, 2) +
                    Math.pow(obj.top! - intersection.y, 2)
                );
                return distance < 3; // 3px tolerance
              }
              return false;
            });

            if (!existingDot) {
              const intersectionDot = createJunctionDot(intersection);
              // Mark the dot as a true intersection junction (not a pin connection)
              (intersectionDot as any).data = {
                type: "junctionDot",
                isIntersection: true,
              };
              canvas.add(intersectionDot);
            }
          }
        }
      }
    }
  }, [
    connections,
    canvas,
    createJunctionDot,
    getWireSegments,
    doLinesIntersect,
  ]);

  return {
    isWireMode: elasticWires ? elasticWire.isElasticMode : isWireMode,
    isDrawing: elasticWires ? elasticWire.isDrawing : isDrawing,
    toggleWireMode: elasticWires
      ? elasticWire.toggleElasticMode
      : toggleWireMode,
    exitWireMode: elasticWires ? elasticWire.exitElasticMode : exitWireMode,
    connections: elasticWires
      ? elasticWire.elasticConnections.map((conn) => ({
          fromComponentId: conn.fromComponentId,
          fromPinNumber: conn.fromPinNumber,
          toComponentId: conn.toComponentId,
          toPinNumber: conn.toPinNumber,
          wire: conn.elasticWire.getFabricObject()!,
        }))
      : connections,
    clearAllWires: elasticWires
      ? elasticWire.clearAllElasticWires
      : clearAllWires,
    nets: elasticWires ? elasticWire.nets : netlist.nets,
    setNetlist: elasticWires ? elasticWire.setNetlist : netlist.setNets,
    updateWiresForComponent,
    registerRestoredWire,
    refreshAllJunctionDots, // Add the junction dot refresh function
    addWireIntersectionDots, // Add intersection dot calculation
  };
}
