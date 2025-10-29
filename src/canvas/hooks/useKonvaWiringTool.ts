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
    (componentId: string, pinNumber: string, x: number, y: number) => {
      if (!isWireMode || !stage) return;

      startPinRef.current = { componentId, pinNumber, x, y };
      bendPointsRef.current = [x, y]; // Start with just the initial point
      setIsDrawing(true);

      // Create a temporary wire that follows the mouse
      const layer = stage.findOne("Layer") as Konva.Layer;
      if (layer) {
        const wire = new Konva.Line({
          points: [x, y, x, y], // Start and end at same point initially
          stroke: "#00AAFF", // More KiCad-like blue color
          strokeWidth: 2,
          dash: [8, 4], // Longer dashes for better visibility
          opacity: 0.8, // Slight transparency for better UX
        });
        layer.add(wire);
        currentWireRef.current = wire;
        // Note: No manual draw() call needed - Konva handles this automatically
      }

      logger.wire("Started wire from pin", { componentId, pinNumber, x, y });
    },
    [isWireMode, stage]
  );

  // Add a bend point by clicking in empty space - ensures 90-degree bends
  const addBendPoint = useCallback(
    (x: number, y: number) => {
      if (!isDrawing || !startPinRef.current) return;

      const startX = startPinRef.current.x;
      const startY = startPinRef.current.y;

      // Calculate the current direction from start to last bend point (or mouse position)
      const lastPointX =
        bendPointsRef.current.length >= 2
          ? bendPointsRef.current[bendPointsRef.current.length - 2]
          : startX;
      const lastPointY =
        bendPointsRef.current.length >= 2
          ? bendPointsRef.current[bendPointsRef.current.length - 1]
          : startY;

      // Determine if we're currently going horizontal or vertical
      const deltaX = Math.abs(x - lastPointX);
      const deltaY = Math.abs(y - lastPointY);

      let bendX = x;
      let bendY = y;

      // If we're going more horizontal than vertical, snap to horizontal line
      if (deltaX > deltaY) {
        bendY = lastPointY; // Keep same Y, change X
      } else {
        bendX = lastPointX; // Keep same X, change Y
      }

      // Add the bend point
      bendPointsRef.current.push(bendX, bendY);

      logger.wire("Added orthogonal bend point", {
        x: bendX,
        y: bendY,
        totalPoints: bendPointsRef.current.length,
      });
    },
    [isDrawing]
  );

  // Calculate orthogonal (90-degree) wire path between two points
  const calculateOrthogonalPath = useCallback(
    (startX: number, startY: number, endX: number, endY: number): number[] => {
      // Calculate the differences
      const deltaX = endX - startX;
      const deltaY = endY - startY;

      // Simple orthogonal routing: go horizontal then vertical, or vertical then horizontal
      // Choose the path that creates fewer bends and looks more natural
      const points: number[] = [startX, startY];

      // If the horizontal distance is greater, go horizontal first
      if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        // Horizontal first: start -> horizontal to endX -> vertical to endY
        points.push(endX, startY, endX, endY);
      } else {
        // Vertical first: start -> vertical to endY -> horizontal to endX
        points.push(startX, endY, endX, endY);
      }

      return points;
    },
    []
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

      // Create orthogonal wire path with bend points
      const points =
        bendPointsRef.current.length >= 2
          ? calculateOrthogonalPathWithBends(
              startX,
              startY,
              bendPointsRef.current,
              mouseX,
              mouseY
            )
          : calculateOrthogonalPath(startX, startY, mouseX, mouseY);

      currentWireRef.current.points(points);
      // Note: No manual draw() call needed - Konva handles this automatically
    },
    [calculateOrthogonalPath, calculateOrthogonalPathWithBends]
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
    (componentId: string, pinNumber: string, x: number, y: number) => {
      if (!isDrawing || !startPinRef.current || !stage) return;

      const startPin = startPinRef.current;

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
          : calculateOrthogonalPath(startPin.x, startPin.y, x, y);

      const connection: WireConnection = {
        id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fromComponentId: startPin.componentId,
        fromPinNumber: startPin.pinNumber,
        toComponentId: componentId,
        toPinNumber: pinNumber,
        points: wirePoints,
        bendPoints: bendPointsRef.current.slice(2), // Exclude start point from bend points
        isMultiSegment: wirePoints.length > 4, // More than 2 points means bends
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
      const componentPins: Array<{ pinNumber: string; x: number; y: number }> =
        [];
      (componentObj as any).children?.forEach((child: any) => {
        if (child instanceof Konva.Circle && (child as any).data?.pinNumber) {
          componentPins.push({
            pinNumber: (child as any).data.pinNumber,
            x: child.absolutePosition().x,
            y: child.absolutePosition().y,
          });
        }
      });

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

        // Get start pin position
        if (connection.fromComponentId === componentId) {
          const startPin = componentPins.find(
            (p) => p.pinNumber === connection.fromPinNumber
          );
          if (startPin) {
            startX = startPin.x;
            startY = startPin.y;
          }
        } else {
          // Find the other component's pin position
          layer.children.forEach((node) => {
            if (
              node instanceof Konva.Group &&
              (node as any).data?.componentId === connection.fromComponentId
            ) {
              node.children?.forEach((child) => {
                if (
                  child instanceof Konva.Circle &&
                  (child as any).data?.pinNumber === connection.fromPinNumber
                ) {
                  const pos = child.absolutePosition();
                  startX = pos.x;
                  startY = pos.y;
                }
              });
            }
          });
        }

        // Get end pin position
        if (connection.toComponentId === componentId) {
          const endPin = componentPins.find(
            (p) => p.pinNumber === connection.toPinNumber
          );
          if (endPin) {
            endX = endPin.x;
            endY = endPin.y;
          }
        } else {
          // Find the other component's pin position
          layer.children.forEach((node) => {
            if (
              node instanceof Konva.Group &&
              (node as any).data?.componentId === connection.toComponentId
            ) {
              node.children?.forEach((child) => {
                if (
                  child instanceof Konva.Circle &&
                  (child as any).data?.pinNumber === connection.toPinNumber
                ) {
                  const pos = child.absolutePosition();
                  endX = pos.x;
                  endY = pos.y;
                }
              });
            }
          });
        }

        // Recalculate orthogonal path
        const newPoints = calculateOrthogonalPath(startX, startY, endX, endY);
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
    [stage, connections, calculateOrthogonalPath, refreshAllJunctionDots]
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
