"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Konva from "konva";
import { logger } from "@/lib/logger";
import { useNetlist, NetConnection, Net } from "./useNetlist";

interface WireConnection {
  id: string;
  fromComponentId: string;
  fromPinNumber: string;
  toComponentId: string;
  toPinNumber: string;
  points: number[]; // [x1, y1, x2, y2, x3, y3, ...] for multi-segment wires
  bendPoints?: number[]; // Store bend points for complex wires
  isMultiSegment?: boolean; // Flag to indicate if this is a multi-segment wire
  wire?: Konva.Line; // Reference to the Konva wire object
}

interface UseKonvaWiringToolProps {
  stage: Konva.Stage | null;
  enabled?: boolean;
  onNetlistChange?: (nets: Net[]) => void;
  initialNetlist?: Net[];
  elasticWires?: boolean; // Enable elastic wire behavior
}

interface UseKonvaWiringToolReturn {
  isWireMode: boolean;
  isDrawing: boolean;
  toggleWireMode: () => void;
  exitWireMode: () => void;
  connections: WireConnection[];
  clearAllWires: () => void;
  startWireFromPin: (
    componentId: string,
    pinNumber: string,
    x: number,
    y: number
  ) => void;
  completeWireToPin: (
    componentId: string,
    pinNumber: string,
    x: number,
    y: number
  ) => void;
  addBendPoint: (x: number, y: number) => void;
  cancelWire: () => void;
  nets: Net[];
  setNetlist: (nets: Net[]) => void;
  updateWiresForComponent: (componentId: string) => void;
  registerRestoredWire: (
    wire: Konva.Line,
    fromComponentId: string,
    fromPinNumber: string,
    toComponentId: string,
    toPinNumber: string
  ) => void;
  refreshAllJunctionDots: () => void;
  addWireIntersectionDots: () => void;
  removeConnectionsForComponent: (componentId: string) => void;
}

export function useKonvaWiringTool({
  stage,
  enabled = true,
  onNetlistChange,
  initialNetlist = [],
  elasticWires = false,
}: UseKonvaWiringToolProps): UseKonvaWiringToolReturn {
  const [isWireMode, setIsWireMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [connections, setConnections] = useState<WireConnection[]>([]);

  const startPinRef = useRef<{
    componentId: string;
    pinNumber: string;
    x: number;
    y: number;
  } | null>(null);
  const currentWireRef = useRef<Konva.Line | null>(null);
  const bendPointsRef = useRef<number[]>([]); // Store bend points as [x1, y1, x2, y2, ...]
  const lastNotifiedNetlistLength = useRef(0);

  // Netlist management
  const netlist = useNetlist(initialNetlist);

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

  // Create a junction dot at a specific position
  const createJunctionDot = useCallback(
    (position: { x: number; y: number }) => {
      const dot = new Konva.Circle({
        radius: 3,
        fill: "#0038DF",
        stroke: "#ffffff",
        strokeWidth: 1,
        x: position.x,
        y: position.y,
        // Use exact position since origin is center
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
    },
    []
  );

  // Get the actual start and end points of a wire from its points array
  const getWireEndpoints = useCallback((wire: Konva.Line) => {
    const points = wire.points();
    if (points.length >= 4) {
      return {
        start: { x: points[0], y: points[1] },
        end: { x: points[points.length - 2], y: points[points.length - 1] },
      };
    }
    return null;
  }, []);

  // Add junction dots for a wire's start and end points - ALWAYS add dots
  const addWireEndpointDots = useCallback(
    (wire: Konva.Line) => {
      if (!stage) return;

      const layer = stage.findOne("Layer") as Konva.Layer;
      if (!layer) return;

      // Get the actual wire endpoints from the wire's points
      const endpoints = getWireEndpoints(wire);
      if (!endpoints) return;

      logger.wire(
        `🔴 Adding dots at endpoints: start(${endpoints.start.x}, ${endpoints.start.y}), end(${endpoints.end.x}, ${endpoints.end.y})`
      );

      // ALWAYS add dots at the actual wire start and end points
      const startDot = createJunctionDot(endpoints.start);
      (startDot as any).data = { type: "junctionDot", pinConnection: true };
      layer.add(startDot);

      const endDot = createJunctionDot(endpoints.end);
      (endDot as any).data = { type: "junctionDot", pinConnection: true };
      layer.add(endDot);

      logger.wire(
        "✅ addWireEndpointDots: Successfully added start and end dots"
      );
    },
    [stage, createJunctionDot, getWireEndpoints]
  );

  // Remove all junction dots
  const clearJunctionDots = useCallback(() => {
    if (!stage) return;

    const layer = stage.findOne("Layer") as Konva.Layer;
    if (!layer) return;

    // Remove dots from layer by checking their type
    layer.children.forEach((node) => {
      if (
        node instanceof Konva.Circle &&
        (node as any).data?.type === "junctionDot"
      ) {
        node.destroy();
      }
    });
  }, [stage]);

  // Check if two line segments intersect
  const doLinesIntersect = useCallback(
    (
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number },
      p4: { x: number; y: number }
    ): { x: number; y: number } | null => {
      const denom =
        (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
      if (Math.abs(denom) < 0.001) return null; // Lines are parallel

      const t =
        ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
      const u =
        -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) /
        denom;

      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
          x: p1.x + t * (p2.x - p1.x),
          y: p1.y + t * (p2.y - p1.y),
        };
      }
      return null;
    },
    []
  );

  // Get line segments from a wire's points array
  const getWireSegments = useCallback(
    (
      wire: Konva.Line
    ): Array<{
      start: { x: number; y: number };
      end: { x: number; y: number };
    }> => {
      const segments: Array<{
        start: { x: number; y: number };
        end: { x: number; y: number };
      }> = [];
      const points = wire.points();

      for (let i = 0; i < points.length - 2; i += 2) {
        segments.push({
          start: { x: points[i], y: points[i + 1] },
          end: { x: points[i + 2], y: points[i + 3] },
        });
      }

      return segments;
    },
    []
  );

  // Add junction dots at wire intersections
  const addWireIntersectionDots = useCallback(() => {
    if (!stage) return;

    const layer = stage.findOne("Layer") as Konva.Layer;
    if (!layer) return;

    // FIRST: Clear ALL existing intersection dots (NOT endpoint dots)
    // This prevents old intersection dots from leaving "prints" when wires move
    layer.children.forEach((node) => {
      if (
        node instanceof Konva.Circle &&
        (node as any).data?.type === "junctionDot" &&
        !(node as any).data?.pinConnection
      ) {
        node.destroy();
      }
    });

    const allSegments: Array<{
      segment: {
        start: { x: number; y: number };
        end: { x: number; y: number };
      };
      wire: Konva.Line;
    }> = [];

    // Collect all segments from all wires
    connections.forEach((connection) => {
      if (connection.wire) {
        const segments = getWireSegments(connection.wire);
        segments.forEach((segment) => {
          allSegments.push({ segment, wire: connection.wire! });
        });
      }
    });

    // Find intersections between different wires
    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        const seg1 = allSegments[i].segment;
        const seg2 = allSegments[j].segment;

        const intersection = doLinesIntersect(
          seg1.start,
          seg1.end,
          seg2.start,
          seg2.end
        );

        if (intersection) {
          // Check if intersection dot already exists at this position
          const existingDot = layer.children.find(
            (node) =>
              node instanceof Konva.Circle &&
              (node as any).data?.type === "junctionDot" &&
              Math.abs(node.x() - intersection.x) < 1 &&
              Math.abs(node.y() - intersection.y) < 1
          );

          if (!existingDot) {
            const intersectionDot = createJunctionDot(intersection);
            layer.add(intersectionDot);
          }
        }
      }
    }
  }, [
    stage,
    connections,
    getWireSegments,
    doLinesIntersect,
    createJunctionDot,
  ]);

  // Comprehensive junction dot refresh - clears all and recalculates based on current wires
  const refreshAllJunctionDots = useCallback(() => {
    if (!stage) return;

    logger.wire("🔄 Refreshing all junction dots (clear + recalculate)");

    // Clear all existing junction dots
    clearJunctionDots();

    // Add endpoint dots for all current connections
    connections.forEach((connection) => {
      if (connection.wire) {
        addWireEndpointDots(connection.wire);
      }
    });

    // Recalculate all intersection dots
    addWireIntersectionDots();

    logger.wire("✅ Junction dots refresh completed");
  }, [
    stage,
    connections,
    clearJunctionDots,
    addWireEndpointDots,
    addWireIntersectionDots,
  ]);

  // Toggle wire mode
  const toggleWireMode = useCallback(() => {
    setIsWireMode((prev) => !prev);
    if (isWireMode) {
      exitWireMode();
    }
    logger.wire(`Wire mode ${!isWireMode ? "enabled" : "disabled"}`);
  }, [isWireMode]);

  // Exit wire mode
  const exitWireMode = useCallback(() => {
    setIsWireMode(false);
    setIsDrawing(false);
    cancelWire();
    logger.wire("Exited wire mode");
  }, []);

  // Start drawing a wire from a pin
  const startWireFromPin = useCallback(
    (
      componentId: string,
      pinNumber: string,
      x: number,
      y: number,
      angle?: number
    ) => {
      if (!isWireMode || !stage) return;

      // Attempt to find pin angle if not provided
      let pinAngle = angle;
      if (pinAngle === undefined && stage) {
        // Quick lookup in stage (optional optimization)
        const pinNode = stage.findOne(`.pin-${pinNumber}`); // Class access?
        // Actually finding specific pin inside group is harder without reference.
        // We will rely on caller passing it or default to null.
      }

      startPinRef.current = {
        componentId,
        pinNumber,
        x,
        y,
        angle: pinAngle,
      } as any;
      bendPointsRef.current = [x, y]; // Start with just the initial point
      setIsDrawing(true);

      // Create a temporary wire that follows the mouse
      const layer = stage.findOne("Layer") as Konva.Layer;
      if (layer) {
        const wire = new Konva.Line({
          points: [x, y, x, y],
          stroke: "#00AAFF",
          strokeWidth: 2,
          dash: [8, 4],
          opacity: 0.8,
        });
        layer.add(wire);
        currentWireRef.current = wire;
      }

      logger.wire("Started wire from pin", {
        componentId,
        pinNumber,
        x,
        y,
        angle: pinAngle,
      });
    },
    [isWireMode, stage]
  );

  // Add a bend point by clicking in empty space - ensures 90-degree bends
  const addBendPoint = useCallback(
    (x: number, y: number) => {
      if (!isDrawing || !startPinRef.current || !stage) return;

      const layer = stage.findOne("Layer") as Konva.Layer;
      if (!layer) return;

      // Transform Click Position to Layer Space
      const transform = layer.getAbsoluteTransform().copy();
      transform.invert();
      const pos = transform.point({ x, y });

      // Use transformed coordinates
      const clickX = pos.x;
      const clickY = pos.y;

      const startX = startPinRef.current.x;
      const startY = startPinRef.current.y;

      const lastPointX =
        bendPointsRef.current.length >= 2
          ? bendPointsRef.current[bendPointsRef.current.length - 2]
          : startX;
      const lastPointY =
        bendPointsRef.current.length >= 2
          ? bendPointsRef.current[bendPointsRef.current.length - 1]
          : startY;

      const deltaX = Math.abs(clickX - lastPointX);
      const deltaY = Math.abs(clickY - lastPointY);

      let bendX = clickX;
      let bendY = clickY;

      if (deltaX > deltaY) {
        bendY = lastPointY;
      } else {
        bendX = lastPointX;
      }

      bendPointsRef.current.push(bendX, bendY);

      logger.wire("Added orthogonal bend point", {
        x: bendX,
        y: bendY,
        totalPoints: bendPointsRef.current.length,
      });
    },
    [isDrawing, stage]
  );

  // --- Advanced Wiring Helpers ---

  // Constants
  const STUB_LENGTH = 20; // Length of the straight wire segment coming out of a pin

  // Helper to get vector for a pin angle (0, 90, 180, 270)
  const getDirVector = useCallback((angle: number) => {
    const rad = (angle * Math.PI) / 180;
    // Round to avoid floating point errors
    return {
      x: Math.round(Math.cos(rad)),
      y: Math.round(Math.sin(rad)),
    };
  }, []);

  // Advanced Smart Routing: Calculates a path respecting start/end directions
  const calculateSmartPath = useCallback(
    (
      startX: number,
      startY: number,
      startAngle: number | null, // Angle the pin is facing (0=Right, 90=Down, etc.)
      endX: number,
      endY: number,
      endAngle: number | null // Angle the target pin is facing
    ): number[] => {
      const points: number[] = [startX, startY];

      // 1. Calculate Start Stub
      // If no angle provided (e.g. mouse cursor), default to no stub or dynamic
      let currX = startX;
      let currY = startY;

      // Directions: 0=Right, 90=Down, 180=Left, 270=Up
      // If startAngle is defined, we MUST move STUB_LENGTH in that direction first
      if (startAngle !== null) {
        const dir = getDirVector(startAngle);
        currX += dir.x * STUB_LENGTH;
        currY += dir.y * STUB_LENGTH;
        points.push(currX, currY);
      }

      // 2. Calculate End Stub (Target point to aim for)
      let targetX = endX;
      let targetY = endY;

      // If endAngle is defined, we want to arrive AT the pin FROM that direction.
      // So the previous point should be 'out' from the pin.
      if (endAngle !== null) {
        const dir = getDirVector(endAngle);
        targetX += dir.x * STUB_LENGTH;
        targetY += dir.y * STUB_LENGTH;
      }

      // 3. Route between curr (end of start stub) and target (start of end stub)
      // We use a mid-point routing strategy (Z-shape or U-shape)

      const dx = targetX - currX;
      const dy = targetY - currY;

      // Decide whether to move Horizontal or Vertical first based on "preferred" axis
      // If we are exiting Horizontally, we prefer to continue Horizontally if possible,
      // OR switch to Vertical if we need to clear an obstacle (basic logic here)

      let goHorizontalFirst = Math.abs(dx) > Math.abs(dy);

      // Override based on current direction if strictly necessary to avoid backtracking
      // (Simplified logic: just stick to standard Manhattan routing between stubs for now)

      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        if (goHorizontalFirst) {
          // Move X then Y
          points.push(targetX, currY);
          points.push(targetX, targetY);
        } else {
          // Move Y then X
          points.push(currX, targetY);
          points.push(targetX, targetY);
        }
      }

      // 4. Add End Stub if needed
      if (endAngle !== null) {
        points.push(endX, endY);
      } else if (
        Math.abs(points[points.length - 2] - endX) > 0.1 ||
        Math.abs(points[points.length - 1] - endY) > 0.1
      ) {
        // If we didn't have an end stub but the last routed point isn't the end (rare), add it
        // Usually step 3 covers this for non-stub cases
      }

      // Filter out duplicate points (segments with 0 length)
      const cleanPoints: number[] = [points[0], points[1]];
      for (let i = 2; i < points.length; i += 2) {
        const lx = cleanPoints[cleanPoints.length - 2];
        const ly = cleanPoints[cleanPoints.length - 1];
        const cx = points[i];
        const cy = points[i + 1];
        if (Math.abs(lx - cx) > 1 || Math.abs(ly - cy) > 1) {
          cleanPoints.push(cx, cy);
        }
      }

      return cleanPoints;
    },
    [getDirVector]
  );

  // Calculate orthogonal path with existing bend points
  const calculateOrthogonalPathWithBends = useCallback(
    (
      startX: number,
      startY: number,
      bendPoints: number[],
      endX: number,
      endY: number
    ): number[] => {
      const points: number[] = [startX, startY];

      // Add all bend points (ensuring they create 90-degree angles)
      for (let i = 0; i < bendPoints.length; i += 2) {
        const bendX = bendPoints[i];
        const bendY = bendPoints[i + 1];

        // Ensure bend point creates orthogonal segment
        const prevX = points[points.length - 2];
        const prevY = points[points.length - 1];

        // Only add bend if it creates a 90-degree turn
        const isHorizontalMove =
          Math.abs(bendX - prevX) > Math.abs(bendY - prevY);
        const isVerticalMove =
          Math.abs(bendY - prevY) > Math.abs(bendX - prevX);

        if (isHorizontalMove || isVerticalMove) {
          points.push(bendX, bendY);
        }
      }

      // Add final segment to end point
      points.push(endX, endY);

      return points;
    },
    []
  );

  // Update the temporary wire as mouse moves
  const updateWirePreview = useCallback(
    (mouseX: number, mouseY: number) => {
      if (!currentWireRef.current || !startPinRef.current) return;

      const startX = startPinRef.current.x;
      const startY = startPinRef.current.y;
      const startAngle = (startPinRef.current as any).angle ?? null;

      // Get the last point (either start or last bend point)
      let lastX = startX;
      let lastY = startY;

      if (bendPointsRef.current.length >= 2) {
        lastX = bendPointsRef.current[bendPointsRef.current.length - 2];
        lastY = bendPointsRef.current[bendPointsRef.current.length - 1];
      }

      // SNAP CURSOR TO 90-DEGREE ANGLES
      // Force wire to be either horizontal or vertical from the last point
      let snappedMouseX = mouseX;
      let snappedMouseY = mouseY;

      const deltaX = Math.abs(mouseX - lastX);
      const deltaY = Math.abs(mouseY - lastY);

      // Snap to whichever direction is closer
      if (deltaX > deltaY) {
        // More horizontal movement - lock Y to create horizontal line
        snappedMouseY = lastY;
      } else {
        // More vertical movement - lock X to create vertical line
        snappedMouseX = lastX;
      }

      // Create orthogonal wire path with bend points
      const points =
        bendPointsRef.current.length >= 2
          ? calculateOrthogonalPathWithBends(
              startX,
              startY,
              bendPointsRef.current,
              snappedMouseX,
              snappedMouseY
            )
          : calculateSmartPath(
              startX,
              startY,
              startAngle,
              snappedMouseX,
              snappedMouseY,
              null
            ); // End angle is null for cursor

      currentWireRef.current.points(points);
    },
    [calculateSmartPath, calculateOrthogonalPathWithBends]
  );

  // Handle stage click (for bend points)
  const handleStageClick = useCallback(
    (e: any) => {
      if (!isDrawing || !stage) return;

      // Only handle clicks on empty space (not on components or pins)
      const clickedOn = e.target;
      if (clickedOn !== stage && clickedOn.getClassName() !== "Stage") {
        // Clicked on a component or pin, let the pin click handler deal with it
        return;
      }

      const pos = stage.getPointerPosition();
      if (pos) {
        addBendPoint(pos.x, pos.y);
      }
    },
    [isDrawing, stage, addBendPoint]
  );

  // Handle mouse move for wire preview
  useEffect(() => {
    if (!stage || !isDrawing) return;

    const handleMouseMove = (e: any) => {
      const pos = stage.getPointerPosition();
      if (pos) {
        updateWirePreview(pos.x, pos.y);
      }
    };

    stage.on("mousemove", handleMouseMove);

    return () => {
      stage.off("mousemove", handleMouseMove);
    };
  }, [stage, isDrawing, updateWirePreview]);

  // Complete the wire to a target pin
  const completeWireToPin = useCallback(
    (
      componentId: string,
      pinNumber: string,
      x: number,
      y: number,
      angle?: number
    ) => {
      if (!isDrawing || !startPinRef.current || !stage) return;

      const startPin = startPinRef.current as any;

      // Don't connect to the same pin
      if (
        startPin.componentId === componentId &&
        startPin.pinNumber === pinNumber
      ) {
        cancelWire();
        return;
      }

      // Calculate orthogonal wire path instead of using arbitrary bend points
      const wirePoints =
        bendPointsRef.current.length >= 2
          ? calculateOrthogonalPathWithBends(
              startPin.x,
              startPin.y,
              bendPointsRef.current,
              x,
              y
            )
          : calculateSmartPath(
              startPin.x,
              startPin.y,
              startPin.angle ?? null,
              x,
              y,
              angle ?? null
            );

      const connection: WireConnection = {
        id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fromComponentId: startPin.componentId,
        fromPinNumber: startPin.pinNumber,
        toComponentId: componentId,
        toPinNumber: pinNumber,
        points: wirePoints,
        bendPoints: bendPointsRef.current.slice(2),
        isMultiSegment: wirePoints.length > 4,
      };

      // Update netlist
      const fromConnection: NetConnection = {
        componentId: startPin.componentId,
        pinNumber: startPin.pinNumber,
      };
      const toConnection: NetConnection = {
        componentId,
        pinNumber,
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
          netlist.mergeNets(fromNet.netId, toNet.netId);
        }
      } else if (fromNet) {
        netlist.addConnectionToNet(fromNet.netId, toConnection);
      } else if (toNet) {
        netlist.addConnectionToNet(toNet.netId, fromConnection);
      } else {
        netlist.createNet([fromConnection, toConnection]);
      }

      // Replace the dashed preview wire with a solid wire
      if (currentWireRef.current) {
        currentWireRef.current.destroy();
        currentWireRef.current = null;

        const layer = stage.findOne("Layer") as Konva.Layer;
        if (layer) {
          const finalWire = new Konva.Line({
            points: connection.points,
            stroke: "#0066CC", // More professional blue color
            strokeWidth: 2,
          });
          connection.wire = finalWire;
          layer.add(finalWire);
          // Note: No manual draw() call needed - Konva handles this automatically

          // Add junction dots for the new wire
          addWireEndpointDots(finalWire);
        }
      }

      setConnections((prev) => [...prev, connection]);
      setIsDrawing(false);
      startPinRef.current = null;
      bendPointsRef.current = []; // Reset bend points

      logger.wire("Completed wire connection", connection);
    },
    [isDrawing, stage, netlist, addWireEndpointDots]
  );

  // Cancel the current wire drawing
  const cancelWire = useCallback(() => {
    if (currentWireRef.current) {
      currentWireRef.current.destroy();
      currentWireRef.current = null;
    }
    setIsDrawing(false);
    startPinRef.current = null;
    bendPointsRef.current = []; // Reset bend points
    logger.wire("Cancelled wire drawing");
  }, []);

  // Handle escape key to cancel wire
  useEffect(() => {
    if (!isWireMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelWire();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWireMode, cancelWire]);

  // Clear all wires
  const clearAllWires = useCallback(() => {
    if (!stage) return;

    const layer = stage.findOne("Layer") as Konva.Layer;
    if (layer) {
      // Find and remove all wire lines (solid blue wires)
      layer.children.forEach((node: Konva.Node) => {
        if (node instanceof Konva.Line && node.stroke() === "#0066CC") {
          node.destroy();
        }
      });
      // Note: No manual draw() call needed - Konva handles this automatically
    }

    setConnections([]);
    clearJunctionDots(); // Clear junction dots
    netlist.clearAllNets();
    if (onNetlistChange) {
      onNetlistChange([]);
    }
    logger.wire("Cleared all wires");
  }, [stage, netlist, onNetlistChange, clearJunctionDots]);

  // Set nets (for restoration)
  const setNetlist = useCallback(
    (newNets: Net[]) => {
      netlist.setNets(newNets);
      logger.wire("Netlist restored with", newNets.length, "nets");
    },
    [netlist]
  );

  // Helper to get position relative to the layer (handling Zoom/Pan)
  const getLayerPos = useCallback((node: Konva.Node, layer: Konva.Layer) => {
    // Basic fallback: if absolutePosition is causing issues, check if we need to inverse transform
    // The node.absolutePosition() returns screen coords.
    // The layer.getAbsoluteTransform() maps local->screen.
    // So to get local, we do inverse(layerAbsTrans).point(screenPos).
    const transform = layer.getAbsoluteTransform().copy();
    transform.invert();
    const pos = node.getAbsolutePosition();
    return transform.point(pos);
  }, []);

  // Update wire positions when components move - with proper orthogonal rerouting
  const updateWiresForComponent = useCallback(
    (componentId: string) => {
      if (!stage) return;

      logger.wire(
        "🔄 Updating wires with orthogonal rerouting for component:",
        componentId
      );

      const layer = stage.findOne("Layer") as Konva.Layer;
      if (!layer) return;

      // Find component to get its current position
      let componentObj: Konva.Group | null = null;
      layer.children.forEach((node) => {
        if (
          node instanceof Konva.Group &&
          (node as any).data?.componentId === componentId
        ) {
          componentObj = node;
        }
      });

      if (!componentObj) {
        logger.wire("Component not found for wire updates:", componentId);
        return;
      }

      // Get all pins for this component to calculate new wire endpoints
      const componentPins: Array<{
        pinNumber: string;
        x: number;
        y: number;
        angle: number | null;
      }> = [];
      // Try recursive find instead of direct children
      const circles = (componentObj as Konva.Group).find("Circle");
      logger.wire(
        `🔍 Found ${circles.length} circles in component ${componentId}`
      );

      circles.forEach((child: any) => {
        if ((child as any).data?.pinNumber) {
          const absPos = child.getAbsolutePosition();
          const layerPos = getLayerPos(child, layer);
          logger.wire(
            `📍 Pin ${(child as any).data.pinNumber}: abs(${absPos.x}, ${
              absPos.y
            }) -> layer(${layerPos.x}, ${layerPos.y})`
          );
          componentPins.push({
            pinNumber: (child as any).data.pinNumber,
            x: layerPos.x,
            y: layerPos.y,
            angle: child.attrs.angle ?? null,
          });
        }
      });

      logger.wire(`✅ Extracted ${componentPins.length} pins from component`);

      // Find all wires connected to this component
      const connectedConnections = connections.filter(
        (connection) =>
          connection.fromComponentId === componentId ||
          connection.toComponentId === componentId
      );

      logger.wire(
        `📍 Rerouting ${connectedConnections.length} wires for component ${componentId}`
      );

      // Update each connected wire with new orthogonal path
      connectedConnections.forEach((connection) => {
        const wire = connection.wire;
        if (!wire) return;

        // Find the start and end pin positions
        let startX = 0,
          startY = 0,
          endX = 0,
          endY = 0;
        let startAngle: number | null = null;
        let endAngle: number | null = null;

        // Get start pin position
        if (connection.fromComponentId === componentId) {
          const startPin = componentPins.find(
            (p) => p.pinNumber === connection.fromPinNumber
          );
          if (startPin) {
            startX = startPin.x;
            startY = startPin.y;
            startAngle = startPin.angle ?? null;
            logger.wire(
              `✅ START pin found (self): ${connection.fromPinNumber} at (${startX}, ${startY})`
            );
          } else {
            logger.warn(
              `❌ Could not find START PIN ${connection.fromPinNumber} on self. Available pins:`,
              componentPins.map((p) => p.pinNumber)
            );
          }
        } else {
          // Find the other component's pin position
          const node = layer.children.find(
            (n) =>
              n instanceof Konva.Group &&
              (n as any).data?.componentId === connection.fromComponentId
          );
          if (node) {
            // Try recursive find
            const circles = (node as Konva.Group).find("Circle");
            const pin = circles.find(
              (c) => (c as any).data?.pinNumber === connection.fromPinNumber
            );

            if (pin) {
              const absPos = pin.getAbsolutePosition();
              const layerPos = getLayerPos(pin, layer);
              startX = layerPos.x;
              startY = layerPos.y;
              startAngle = (pin as any).attrs.angle ?? null;
              logger.wire(
                `✅ START pin found (other): ${connection.fromPinNumber} at abs(${absPos.x}, ${absPos.y}) -> layer(${startX}, ${startY})`
              );
            } else {
              const availablePins = circles
                .map((c) => (c as any).data?.pinNumber)
                .filter(Boolean);
              logger.warn(
                `❌ Found component ${connection.fromComponentId} but NOT pin ${connection.fromPinNumber}. Available:`,
                availablePins
              );
            }
          } else {
            logger.warn(
              `❌ Could not find START COMPONENT ${connection.fromComponentId}`
            );
          }
        }

        // Get end pin position
        if (connection.toComponentId === componentId) {
          const endPin = componentPins.find(
            (p) => p.pinNumber === connection.toPinNumber
          );
          if (endPin) {
            endX = endPin.x;
            endY = endPin.y;
            endAngle = endPin.angle ?? null;
            logger.wire(
              `✅ END pin found (self): ${connection.toPinNumber} at (${endX}, ${endY})`
            );
          } else {
            logger.warn(
              `❌ Could not find END PIN ${connection.toPinNumber} on self. Available:`,
              componentPins.map((p) => p.pinNumber)
            );
          }
        } else {
          // Find the other component's pin position
          const node = layer.children.find(
            (n) =>
              n instanceof Konva.Group &&
              (n as any).data?.componentId === connection.toComponentId
          );
          if (node) {
            // Try recursive find
            const circles = (node as Konva.Group).find("Circle");
            const pin = circles.find(
              (c) => (c as any).data?.pinNumber === connection.toPinNumber
            );

            if (pin) {
              const absPos = pin.getAbsolutePosition();
              const layerPos = getLayerPos(pin, layer);
              endX = layerPos.x;
              endY = layerPos.y;
              endAngle = (pin as any).attrs.angle ?? null;
              logger.wire(
                `✅ END pin found (other): ${connection.toPinNumber} at abs(${absPos.x}, ${absPos.y}) -> layer(${endX}, ${endY})`
              );
            } else {
              const availablePins = circles
                .map((c) => (c as any).data?.pinNumber)
                .filter(Boolean);
              logger.warn(
                `❌ Found component ${connection.toComponentId} but NOT pin ${connection.toPinNumber}. Available:`,
                availablePins
              );
            }
          } else {
            logger.warn(
              `❌ Could not find END COMPONENT ${connection.toComponentId}`
            );
          }
        }

        // Log final coordinates before calculating path
        logger.wire(
          `🎯 Calculating path: START(${startX}, ${startY}, angle=${startAngle}) -> END(${endX}, ${endY}, angle=${endAngle})`
        );

        // Recalculate smart path
        const newPoints = calculateSmartPath(
          startX,
          startY,
          startAngle,
          endX,
          endY,
          endAngle
        );

        logger.wire(`📐 New wire points:`, newPoints);
        wire.points(newPoints);

        // Update connection points
        connection.points = newPoints;
      });

      // Refresh junction dots after rerouting
      refreshAllJunctionDots();

      logger.wire(
        "✅ Orthogonal wire rerouting completed for component movement"
      );
    },
    [stage, connections, calculateSmartPath, refreshAllJunctionDots]
  );

  // Register a wire that was restored from netlist data
  const registerRestoredWire = useCallback(
    (
      wire: Konva.Line,
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

      // Create netlist connections
      const fromConnection: NetConnection = {
        componentId: fromComponentId,
        pinNumber: fromPinNumber,
      };
      const toConnection: NetConnection = {
        componentId: toComponentId,
        pinNumber: toPinNumber,
      };

      // Update netlist - same logic as when creating wire through UI
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
          netlist.mergeNets(fromNet.netId, toNet.netId);
        }
        wireNetId = fromNet.netId;
      } else if (fromNet) {
        netlist.addConnectionToNet(fromNet.netId, toConnection);
        wireNetId = fromNet.netId;
      } else if (toNet) {
        netlist.addConnectionToNet(toNet.netId, fromConnection);
        wireNetId = toNet.netId;
      } else {
        wireNetId = netlist.createNet([fromConnection, toConnection]);
      }

      // Assign netId to the wire object
      (wire as any).netId = wireNetId;
      (wire as any).wireType = "connection";

      const wireConnection: WireConnection = {
        id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fromComponentId,
        fromPinNumber,
        toComponentId,
        toPinNumber,
        points: wire.points(),
        wire,
      };

      setConnections((prev) => [...prev, wireConnection]);
      logger.wire("✅ Restored wire registered successfully with netlist");
    },
    [netlist]
  );

  // Handle mouse move for wire preview
  useEffect(() => {
    if (!stage || !isDrawing) return;

    const handleMouseMove = (e: any) => {
      const pos = stage.getPointerPosition();
      if (pos) {
        updateWirePreview(pos.x, pos.y);
      }
    };

    stage.on("mousemove", handleMouseMove);

    return () => {
      stage.off("mousemove", handleMouseMove);
    };
  }, [stage, isDrawing, updateWirePreview]);

  // Handle stage click for bend points
  useEffect(() => {
    if (!stage || !isDrawing) return;

    stage.on("click", handleStageClick);

    return () => {
      stage.off("click", handleStageClick);
    };
  }, [stage, isDrawing, handleStageClick]);

  // Handle escape key to cancel wire
  useEffect(() => {
    if (!isWireMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelWire();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWireMode, cancelWire]);

  // Remove all connections for a specific component
  const removeConnectionsForComponent = useCallback(
    (componentId: string) => {
      if (!stage) return;

      logger.wire("Removing all connections for component", { componentId });

      // Find connections to remove
      const connectionsToRemove = connections.filter(
        (connection) =>
          connection.fromComponentId === componentId ||
          connection.toComponentId === componentId
      );

      // Remove wire objects from stage
      connectionsToRemove.forEach((connection) => {
        if (connection.wire) {
          connection.wire.destroy();
        }
      });

      // Update connections state
      setConnections((prev) =>
        prev.filter(
          (connection) =>
            connection.fromComponentId !== componentId &&
            connection.toComponentId !== componentId
        )
      );

      // Update netlist - remove connections from nets
      connectionsToRemove.forEach((connection) => {
        netlist.removeConnection(
          connection.fromComponentId,
          connection.fromPinNumber
        );
        if (connection.toComponentId && connection.toPinNumber) {
          netlist.removeConnection(
            connection.toComponentId,
            connection.toPinNumber
          );
        }
      });

      logger.wire("Removed connections for component", {
        componentId,
        removedCount: connectionsToRemove.length,
      });
    },
    [stage, connections, netlist]
  );

  return {
    isWireMode,
    isDrawing,
    toggleWireMode,
    exitWireMode,
    connections,
    clearAllWires,
    startWireFromPin,
    completeWireToPin,
    addBendPoint,
    cancelWire,
    nets: netlist.nets,
    setNetlist,
    updateWiresForComponent,
    registerRestoredWire,
    refreshAllJunctionDots,
    addWireIntersectionDots,
    removeConnectionsForComponent,
  };
}
