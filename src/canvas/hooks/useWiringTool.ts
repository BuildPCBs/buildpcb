/**
 * Professional Wiring Tool - Built for reliability and professional behavior
 * Features:
 * - Automatic net coloring system for electrical networks
 * - Professional wire editing with vertex manipulation
 * - Intelligent wire rerouting when components move
 * - Rule-based wire behavior for predictable user experience
 *
 * PROFESSIONAL WIRING RULES:
 * Rule #1: Wires are defined by connections, not moved freely
 * Rule #2: Wires are edited by moving corners/vertices
 * Rule #3: Components moving trigger intelligent wire rerouting
 * Rule #4: Wires only disconnect when explicitly deleted
 */

import { useEffect, useState, useCallback, useRef } from "react";
import * as fabric from "fabric";

// Simple, reliable state management - DEFINITIVE IMPLEMENTATION
interface WiringState {
  isDrawingWire: boolean;
  currentLine: fabric.Polyline | null;
  startPin: fabric.Object | null;
  wirePoints: fabric.Point[]; // Array of fixed waypoints
}

// AUTOMATIC NET COLORING SYSTEM
interface ElectricalNet {
  netId: string;
  color: string;
  pins: Set<fabric.Object>;
  wires: Set<fabric.Polyline>;
}

// Color palette for distinct electrical nets
const NET_COLOR_PALETTE = [
  "#0038DF", // Blue
  "#00C851", // Green
  "#8E44AD", // Purple
  "#FF8C00", // Orange
  "#E53E3E", // Red
  "#00B7C3", // Teal
  "#FF6B9D", // Pink
  "#9C88FF", // Light Purple
  "#FFD93D", // Yellow
  "#6BCF7F", // Light Green
  "#FF7043", // Deep Orange
  "#42A5F5", // Light Blue
] as const;

// PART 2: TRAFFIC LIGHT STATE MANAGEMENT
// The wiring tool has EXACTLY three states: Red → Yellow → Green → Red
type TrafficLightState = "RED" | "YELLOW" | "GREEN";

interface UseWiringToolProps {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
}

interface UseWiringToolReturn {
  isWireMode: boolean;
  isDrawingWire: boolean;
  wireState: string; // For UI compatibility: 'idle' | 'drawing'
  trafficLightState: TrafficLightState; // NEW: Traffic light state
  toggleWireMode: () => void;
  exitWireMode: () => void;
  // PART 2: Expose wire-component connection functions
  updateConnectedWires: (component: fabric.Group) => void;
  // RULE #4: Professional wiring behavior functions
  safeComponentMovement: (component: fabric.Group) => void;
  deleteWire: (wire: fabric.Polyline & any) => void;
  // NET COLORING: Expose net information
  getNetInfo: () => { netCount: number; nets: ElectricalNet[] };
}

export function useWiringTool({
  canvas,
  enabled = true,
}: UseWiringToolProps): UseWiringToolReturn {
  // PART 1: Define the State - Exact implementation as specified
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPin, setStartPin] = useState<fabric.Object | null>(null);
  const [currentLine, setCurrentLine] = useState<fabric.Polyline | null>(null);

  // PART 2: THE WIRING TOOL "BRAIN" - Traffic Light State Management
  // 🔴 RED = Idle (ready to start wire)
  // 🟡 YELLOW = Drawing (wire in progress)
  // 🟢 GREEN = Finishing (completing the wire)
  const [trafficLightState, setTrafficLightState] =
    useState<TrafficLightState>("RED");

  // AUTOMATIC NET COLORING STATE MANAGEMENT
  const [electricalNets, setElectricalNets] = useState<
    Map<string, ElectricalNet>
  >(new Map());
  const [nextColorIndex, setNextColorIndex] = useState(0);

  // Additional state for compatibility
  const [isWireMode, setIsWireMode] = useState(false);
  const [wirePoints, setWirePoints] = useState<fabric.Point[]>([]);

  // Legacy state for compatibility - we'll sync these with the new state
  const wiringState = {
    isDrawingWire: isDrawing,
    currentLine: currentLine,
    startPin: startPin,
    wirePoints: wirePoints,
  };

  // Pin highlighting state
  const [highlightedPin, setHighlightedPin] = useState<fabric.Object | null>(
    null
  );
  const originalPinState = useRef<Map<fabric.Object, any>>(new Map());

  // Find pin at coordinates with tolerance
  const findPinAtPoint = useCallback(
    (point: fabric.Point): fabric.Object | null => {
      if (!canvas) return null;

      const objects = canvas.getObjects();
      for (const obj of objects) {
        if ((obj as any).data?.isComponentSandwich && obj.type === "group") {
          const group = obj as fabric.Group;
          const groupObjects = group.getObjects();

          for (const groupObj of groupObjects) {
            if ((groupObj as any).pin) {
              const pinPoint = fabric.util.transformPoint(
                new fabric.Point(groupObj.left || 0, groupObj.top || 0),
                group.calcTransformMatrix()
              );
              if (point.distanceFrom(pinPoint) <= 8) {
                return groupObj;
              }
            }
          }
        }
        // Legacy support
        else if ((obj as any).componentType && obj.type === "group") {
          const group = obj as fabric.Group;
          const groupObjects = group.getObjects();

          for (const groupObj of groupObjects) {
            if ((groupObj as any).pin) {
              const pinPoint = fabric.util.transformPoint(
                new fabric.Point(groupObj.left || 0, groupObj.top || 0),
                group.calcTransformMatrix()
              );
              if (point.distanceFrom(pinPoint) <= 8) {
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

  // RULE #2: Find wire at point for junction creation
  const findWireAtPoint = useCallback(
    (
      point: fabric.Point
    ): {
      wire: fabric.Polyline;
      segmentIndex: number;
      intersectionPoint: fabric.Point;
    } | null => {
      if (!canvas) return null;

      const tolerance = 5;
      const objects = canvas.getObjects();

      for (const obj of objects) {
        if ((obj as any).wireType === "connection" && obj.type === "polyline") {
          const wire = obj as fabric.Polyline;
          const points = wire.points || [];

          // Check each line segment of the wire
          for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            // Calculate distance from point to line segment
            const A = point.x - p1.x;
            const B = point.y - p1.y;
            const C = p2.x - p1.x;
            const D = p2.y - p1.y;

            const dot = A * C + B * D;
            const lenSq = C * C + D * D;

            if (lenSq === 0) continue; // Zero-length segment

            const param = dot / lenSq;

            let xx, yy;

            if (param < 0) {
              xx = p1.x;
              yy = p1.y;
            } else if (param > 1) {
              xx = p2.x;
              yy = p2.y;
            } else {
              xx = p1.x + param * C;
              yy = p1.y + param * D;
            }

            const dx = point.x - xx;
            const dy = point.y - yy;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= tolerance && param >= 0 && param <= 1) {
              return {
                wire: wire,
                segmentIndex: i,
                intersectionPoint: new fabric.Point(xx, yy),
              };
            }
          }
        }
      }

      return null;
    },
    [canvas]
  );

  // RULE #2: Create junction dot at connection point
  const createJunctionDot = useCallback(
    (point: fabric.Point): fabric.Circle => {
      const junctionDot = new fabric.Circle({
        left: point.x,
        top: point.y,
        radius: 3,
        fill: "#0038DF",
        stroke: "#FFFFFF",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        selectable: false,
        evented: false,
        junctionDot: true,
        excludeFromExport: false,
      });

      return junctionDot;
    },
    []
  );

  // RULE #3: Intelligent orthogonal pathfinding
  const calculateOrthogonalPath = useCallback(
    (
      startPoint: fabric.Point,
      endPoint: fabric.Point,
      obstacles: fabric.Object[] = []
    ): fabric.Point[] => {
      console.log("🧭 Calculating intelligent orthogonal path");

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

      // TODO: Add obstacle avoidance logic here for more sophisticated routing
      // For now, we use the simple orthogonal path

      console.log(`📏 Generated path with ${path.length} points`);
      return path;
    },
    []
  );

  // Get pin world coordinates
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

  // Highlight pin
  const highlightPin = useCallback(
    (pin: fabric.Object) => {
      if (highlightedPin === pin) return;

      // Clear previous highlight
      if (highlightedPin) {
        const originalState = originalPinState.current.get(highlightedPin);
        if (originalState) {
          highlightedPin.set(originalState);
          originalPinState.current.delete(highlightedPin);
        }
      }

      // Store original state and apply highlight
      if (!originalPinState.current.has(pin)) {
        originalPinState.current.set(pin, {
          strokeWidth: pin.strokeWidth,
          fill: pin.fill,
          radius: (pin as any).radius,
        });
      }

      pin.set({
        strokeWidth: 3,
        fill: "rgba(0, 56, 223, 0.7)",
        radius: (originalPinState.current.get(pin)?.radius || 4) * 1.3,
      });

      setHighlightedPin(pin);
      canvas?.renderAll();
    },
    [highlightedPin, canvas]
  );

  // Clear pin highlight
  const clearPinHighlight = useCallback(() => {
    if (highlightedPin) {
      const originalState = originalPinState.current.get(highlightedPin);
      if (originalState) {
        highlightedPin.set(originalState);
        originalPinState.current.delete(highlightedPin);
      }
      setHighlightedPin(null);
      canvas?.renderAll();
    }
  }, [highlightedPin, canvas]);

  // ===== PROFESSIONAL WIRE LAPPING RULES =====

  // RULE #3: Prevent wire self-overlapping and crossing
  const validateWirePath = useCallback(
    (
      newPoints: fabric.Point[],
      existingWires: fabric.Polyline[] = []
    ): boolean => {
      if (newPoints.length < 2) return true;

      // Rule 3A: Prevent self-intersection within the new wire path
      for (let i = 0; i < newPoints.length - 2; i++) {
        for (let j = i + 2; j < newPoints.length - 1; j++) {
          if (
            linesIntersect(
              newPoints[i],
              newPoints[i + 1],
              newPoints[j],
              newPoints[j + 1]
            )
          ) {
            console.log(
              "🚫 RULE #3A: Wire self-intersection detected - path invalid"
            );
            return false;
          }
        }
      }

      // Rule 3B: Prevent overlapping with existing wires (except at junctions)
      for (const existingWire of existingWires) {
        if (!existingWire.points) continue;

        const existingPoints = existingWire.points;
        for (let i = 0; i < newPoints.length - 1; i++) {
          for (let j = 0; j < existingPoints.length - 1; j++) {
            // Convert XY points to fabric.Point for distance calculation
            const existingPointJ = new fabric.Point(
              existingPoints[j].x,
              existingPoints[j].y
            );
            const existingPointJ1 = new fabric.Point(
              existingPoints[j + 1].x,
              existingPoints[j + 1].y
            );

            // Skip if this is a legitimate junction (very close endpoints)
            const isNearStart =
              distanceBetweenPoints(newPoints[i], existingPointJ) < 5;
            const isNearEnd =
              distanceBetweenPoints(newPoints[i + 1], existingPointJ1) < 5;

            if (isNearStart || isNearEnd) continue;

            if (
              linesIntersect(
                newPoints[i],
                newPoints[i + 1],
                existingPointJ,
                existingPointJ1
              )
            ) {
              console.log("🚫 RULE #3B: Wire crossing detected - path invalid");
              return false;
            }
          }
        }
      }

      return true;
    },
    []
  );

  // Helper function: Check if two line segments intersect
  const linesIntersect = useCallback(
    (
      p1: fabric.Point,
      p2: fabric.Point,
      p3: fabric.Point,
      p4: fabric.Point
    ): boolean => {
      const denom =
        (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
      if (Math.abs(denom) < 1e-10) return false; // Lines are parallel

      const t =
        ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
      const u =
        -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) /
        denom;

      return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    },
    []
  );

  // Helper function: Calculate distance between two points
  const distanceBetweenPoints = useCallback(
    (p1: fabric.Point, p2: fabric.Point): number => {
      return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    },
    []
  );

  // RULE #3: Enhanced calculateOrthogonalPoint with lapping prevention
  const calculateOrthogonalPointWithValidation = useCallback(
    (
      lastPoint: fabric.Point,
      currentPoint: fabric.Point,
      existingWires: fabric.Polyline[] = []
    ): fabric.Point => {
      // Get all existing wires from canvas if not provided
      const wiresToCheck =
        existingWires.length > 0
          ? existingWires
          : canvas
          ? (canvas
              .getObjects()
              .filter(
                (obj: any) =>
                  obj.wireType === "connection" && obj.type === "polyline"
              ) as fabric.Polyline[])
          : [];

      const deltaX = Math.abs(currentPoint.x - lastPoint.x);
      const deltaY = Math.abs(currentPoint.y - lastPoint.y);

      let candidatePoint: fabric.Point;

      // Try the preferred orthogonal direction first
      if (deltaX > deltaY) {
        candidatePoint = new fabric.Point(currentPoint.x, lastPoint.y);
      } else {
        candidatePoint = new fabric.Point(lastPoint.x, currentPoint.y);
      }

      // Test if this path would cause lapping
      const testPoints = [lastPoint, candidatePoint];
      if (validateWirePath(testPoints, wiresToCheck)) {
        return candidatePoint;
      }

      // If preferred direction causes lapping, try the alternative
      console.log(
        "⚠️ RULE #3: Preferred orthogonal path causes lapping, trying alternative"
      );
      if (deltaX > deltaY) {
        candidatePoint = new fabric.Point(lastPoint.x, currentPoint.y);
      } else {
        candidatePoint = new fabric.Point(currentPoint.x, lastPoint.y);
      }

      // Test the alternative path
      const altTestPoints = [lastPoint, candidatePoint];
      if (validateWirePath(altTestPoints, wiresToCheck)) {
        return candidatePoint;
      }

      // If both directions cause lapping, use direct line (last resort)
      console.log(
        "⚠️ RULE #3: Both orthogonal paths cause lapping, using direct line"
      );
      return currentPoint;
    },
    [validateWirePath, canvas]
  );

  // ===== END PROFESSIONAL WIRE LAPPING RULES =====

  // ===== AUTOMATIC NET COLORING SYSTEM =====

  // Generate a unique net ID
  const generateNetId = useCallback(() => {
    return `net_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Get the next available color from the palette
  const getNextNetColor = useCallback(() => {
    const color = NET_COLOR_PALETTE[nextColorIndex % NET_COLOR_PALETTE.length];
    setNextColorIndex((prev) => prev + 1);
    return color;
  }, [nextColorIndex]);

  // Find which net a pin belongs to
  const findPinNet = useCallback(
    (pin: fabric.Object): ElectricalNet | null => {
      for (const net of electricalNets.values()) {
        if (net.pins.has(pin)) {
          return net;
        }
      }
      return null;
    },
    [electricalNets]
  );

  // Create a new electrical net
  const createNewNet = useCallback(
    (pins: fabric.Object[], wires: fabric.Polyline[] = []): ElectricalNet => {
      const netId = generateNetId();
      const color = getNextNetColor();

      const newNet: ElectricalNet = {
        netId,
        color,
        pins: new Set(pins),
        wires: new Set(wires),
      };

      console.log(
        `🎨 NET COLORING: Created new net ${netId} with color ${color}`
      );

      setElectricalNets((prev) => {
        const updated = new Map(prev);
        updated.set(netId, newNet);
        return updated;
      });

      return newNet;
    },
    [generateNetId, getNextNetColor]
  );

  // Add items to an existing net
  const addToNet = useCallback(
    (
      net: ElectricalNet,
      pins: fabric.Object[] = [],
      wires: fabric.Polyline[] = []
    ) => {
      console.log(
        `🎨 NET COLORING: Adding ${pins.length} pins and ${wires.length} wires to net ${net.netId}`
      );

      setElectricalNets((prev) => {
        const updated = new Map(prev);
        const updatedNet = { ...net };

        pins.forEach((pin) => updatedNet.pins.add(pin));
        wires.forEach((wire) => updatedNet.wires.add(wire));

        updated.set(net.netId, updatedNet);
        return updated;
      });
    },
    []
  );

  // Merge two electrical nets into one
  const mergeNets = useCallback(
    (net1: ElectricalNet, net2: ElectricalNet): ElectricalNet => {
      console.log(
        `🎨 NET COLORING: Merging net ${net2.netId} into net ${net1.netId}`
      );

      // Merge all pins and wires into net1
      const mergedNet: ElectricalNet = {
        ...net1,
        pins: new Set([...net1.pins, ...net2.pins]),
        wires: new Set([...net1.wires, ...net2.wires]),
      };

      setElectricalNets((prev) => {
        const updated = new Map(prev);
        updated.set(net1.netId, mergedNet);
        updated.delete(net2.netId); // Remove the merged net
        return updated;
      });

      return mergedNet;
    },
    []
  );

  // Apply net color to all wires in a net
  const applyNetColoring = useCallback(
    (net: ElectricalNet) => {
      if (!canvas) return;

      console.log(
        `🎨 NET COLORING: Applying color ${net.color} to ${net.wires.size} wires`
      );

      net.wires.forEach((wire) => {
        wire.set({
          stroke: net.color,
          netId: net.netId,
        } as any);
      });

      // Also store netId on pins for future reference
      net.pins.forEach((pin) => {
        (pin as any).netId = net.netId;
      });

      canvas.renderAll();
    },
    [canvas]
  );

  // The main net coloring algorithm - determines what happens when a wire is completed
  const handleNetColoring = useCallback(
    (
      startPin: fabric.Object,
      endPin: fabric.Object,
      newWire: fabric.Polyline
    ) => {
      const startNet = findPinNet(startPin);
      const endNet = findPinNet(endPin);

      console.log(
        `🎨 NET COLORING: Analyzing connection - Start pin net: ${
          startNet?.netId || "none"
        }, End pin net: ${endNet?.netId || "none"}`
      );

      if (!startNet && !endNet) {
        // Case A: Connecting two new pins - create a new net
        console.log("🎨 Case A: Creating new net for two unconnected pins");
        const newNet = createNewNet([startPin, endPin], [newWire]);
        applyNetColoring(newNet);
      } else if (startNet && !endNet) {
        // Case B: Connecting to existing net from start pin
        console.log("🎨 Case B: Adding end pin to existing start net");
        addToNet(startNet, [endPin], [newWire]);
        applyNetColoring(startNet);
      } else if (!startNet && endNet) {
        // Case B: Connecting to existing net from end pin
        console.log("🎨 Case B: Adding start pin to existing end net");
        addToNet(endNet, [startPin], [newWire]);
        applyNetColoring(endNet);
      } else if (startNet && endNet && startNet.netId !== endNet.netId) {
        // Case C: Merging two different nets
        console.log("🎨 Case C: Merging two different nets");
        const mergedNet = mergeNets(startNet, endNet);
        addToNet(mergedNet, [], [newWire]);
        applyNetColoring(mergedNet);
      } else if (startNet && endNet && startNet.netId === endNet.netId) {
        // Connecting within the same net - just add the wire
        console.log("🎨 Adding wire within same existing net");
        addToNet(startNet, [], [newWire]);
        applyNetColoring(startNet);
      }
    },
    [findPinNet, createNewNet, addToNet, mergeNets, applyNetColoring]
  );

  // Get net information for debugging/UI purposes
  const getNetInfo = useCallback(() => {
    const nets = Array.from(electricalNets.values());
    console.log(
      `🎨 NET INFO: Currently tracking ${nets.length} electrical nets`
    );
    nets.forEach((net) => {
      console.log(
        `  Net ${net.netId}: ${net.color} - ${net.pins.size} pins, ${net.wires.size} wires`
      );
    });
    return {
      netCount: nets.length,
      nets: nets,
    };
  }, [electricalNets]);

  // ===== END NET COLORING SYSTEM =====

  // ===== PROFESSIONAL WIRE EDITING SYSTEM =====
  // RULE #2: Wire editing through vertex manipulation

  const [selectedWire, setSelectedWire] = useState<fabric.Polyline | null>(
    null
  );
  const [wireVertexHandles, setWireVertexHandles] = useState<fabric.Circle[]>(
    []
  );

  // Update wire path when a vertex is moved
  const updateWirePathFromVertex = useCallback(
    (
      wire: fabric.Polyline,
      vertexIndex: number,
      newX: number,
      newY: number
    ) => {
      if (!wire.points) return;

      console.log(
        `✏️ RULE #2: Updating wire path - vertex ${vertexIndex} moved to (${newX}, ${newY})`
      );

      const newPoints = [...wire.points];
      newPoints[vertexIndex] = new fabric.Point(newX, newY);

      wire.set({ points: newPoints });

      // Apply net coloring to maintain color consistency
      const wireNetId = (wire as any).netId;
      if (wireNetId && electricalNets.has(wireNetId)) {
        const net = electricalNets.get(wireNetId)!;
        wire.set({ stroke: net.color });
      }

      canvas?.renderAll();
    },
    [canvas, electricalNets]
  );

  // Hide vertex handles
  const hideWireVertexHandles = useCallback(() => {
    if (!canvas) return;

    wireVertexHandles.forEach((handle) => {
      canvas.remove(handle);
    });
    setWireVertexHandles([]);
    setSelectedWire(null);
    canvas.renderAll();
  }, [canvas, wireVertexHandles]);

  // Create vertex handle for wire editing
  const createVertexHandle = useCallback(
    (
      point: fabric.Point,
      index: number,
      isEndpoint: boolean
    ): fabric.Circle => {
      const handle = new fabric.Circle({
        left: point.x,
        top: point.y,
        radius: isEndpoint ? 6 : 4, // Endpoints are larger
        fill: isEndpoint ? "#FF4444" : "#4444FF", // Red for endpoints, blue for corners
        stroke: "#FFFFFF",
        strokeWidth: 2,
        originX: "center",
        originY: "center",
        selectable: !isEndpoint, // RULE #2: Endpoints cannot be moved
        evented: !isEndpoint,
        hasControls: false,
        hasBorders: false,
        hoverCursor: isEndpoint ? "not-allowed" : "move",
        moveCursor: isEndpoint ? "not-allowed" : "move",
        vertexIndex: index,
        isWireEndpoint: isEndpoint,
        isWireVertex: true,
      } as any);

      return handle;
    },
    []
  );

  // Show vertex handles for selected wire
  const showWireVertexHandles = useCallback(
    (wire: fabric.Polyline) => {
      if (!canvas || !wire.points) return;

      console.log("✏️ RULE #2: Showing vertex handles for wire editing");

      // Clear existing handles
      hideWireVertexHandles();

      const handles: fabric.Circle[] = [];
      const points = wire.points;

      points.forEach((point, index) => {
        const isEndpoint = index === 0 || index === points.length - 1;
        const fabricPoint = new fabric.Point(point.x, point.y);
        const handle = createVertexHandle(fabricPoint, index, isEndpoint);

        // Add drag behavior for non-endpoint vertices
        if (!isEndpoint) {
          handle.on("moving", (e) => {
            // RULE #2: Update wire path when vertex is moved
            updateWirePathFromVertex(wire, index, handle.left!, handle.top!);
          });
        }

        handles.push(handle);
        canvas.add(handle);
      });

      setWireVertexHandles(handles);
      setSelectedWire(wire);
      canvas.renderAll();
    },
    [
      canvas,
      createVertexHandle,
      hideWireVertexHandles,
      updateWirePathFromVertex,
    ]
  );

  // ===== END PROFESSIONAL WIRE EDITING SYSTEM =====

  // PART 2: Create the "Reset" Function (The Most Important Step)
  // Updated with Traffic Light State Management
  const resetWiringTool = useCallback(() => {
    console.log("🔄 DEFINITIVE RESET: Resetting wiring tool to clean state");

    // TRAFFIC LIGHT RESET: Always return to RED (Idle)
    setTrafficLightState("RED");
    console.log("🔴 TRAFFIC LIGHT: RED (Idle - Ready to start wire)");

    setIsDrawing(false);
    setStartPin(null);
    if (currentLine && canvas) {
      canvas.remove(currentLine); // Remove the temporary line
    }
    setCurrentLine(null);
    setWirePoints([]);

    // Clear highlights
    clearPinHighlight();

    if (canvas) {
      canvas.renderAll();
    }
    console.log("--- Wiring tool has been reset to RED state. ---");
  }, [currentLine, canvas, clearPinHighlight]);

  // Legacy reset function for backward compatibility
  const resetWiringState = resetWiringTool;

  // Start drawing a wire from a pin
  const startWireFromPin = useCallback(
    (pin: fabric.Object, clickPoint: fabric.Point) => {
      if (!canvas) return;

      // TRAFFIC LIGHT: RED → YELLOW transition
      if (trafficLightState !== "RED") {
        console.log("🚨 TRAFFIC VIOLATION: Can only start wire from RED state");
        return;
      }

      console.log("🎯 Starting wire from pin");
      setTrafficLightState("YELLOW");
      console.log("🟡 TRAFFIC LIGHT: YELLOW (Drawing - Wire in progress)");

      const pinCoords = getPinWorldCoordinates(pin);
      const orthogonalPoint = calculateOrthogonalPointWithValidation(
        pinCoords,
        clickPoint
      );

      // Create visible POLYLINE immediately with pin coordinates as start
      const initialPoints = [pinCoords, orthogonalPoint];
      const newLine = new fabric.Polyline(initialPoints, {
        fill: "transparent",
        stroke: "#0038DF", // Temporary preview color - final color determined by net coloring
        strokeWidth: 2,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        selectable: false,
        evented: false,
        excludeFromExport: true,
        clipPath: undefined, // CRITICAL: Disable clipping
        objectCaching: false, // CRITICAL: Prevent visual glitches
      });

      // Add to canvas immediately for instant visibility
      canvas.add(newLine);
      canvas.renderAll(); // Force immediate render

      // Update state using new state setters
      setIsDrawing(true);
      setCurrentLine(newLine);
      setStartPin(pin);
      setWirePoints([pinCoords]); // Store fixed waypoints

      console.log("✅ Wire preview created and visible - now following cursor");
    },
    [
      canvas,
      getPinWorldCoordinates,
      calculateOrthogonalPointWithValidation,
      trafficLightState,
    ]
  );

  // Update wire preview during mouse move - THE CRITICAL LIVE PREVIEW FIX
  const updateWirePreview = useCallback(
    (mousePoint: fabric.Point) => {
      if (
        !wiringState.currentLine ||
        !canvas ||
        wiringState.wirePoints.length === 0
      )
        return;

      // Get the last fixed waypoint
      const lastWaypoint =
        wiringState.wirePoints[wiringState.wirePoints.length - 1];

      // Calculate orthogonal point from last waypoint to current mouse position
      const orthogonalPoint = calculateOrthogonalPointWithValidation(
        lastWaypoint,
        mousePoint
      );

      // Create new points array: all fixed waypoints + current orthogonal preview point
      const newPoints = [...wiringState.wirePoints, orthogonalPoint];

      // Update polyline points
      wiringState.currentLine.set({ points: newPoints });

      // CRITICAL: Force canvas update for live preview
      canvas.renderAll();
    },
    [
      wiringState.currentLine,
      wiringState.wirePoints,
      canvas,
      calculateOrthogonalPointWithValidation,
    ]
  );

  // Add corner point when clicking on empty space - THE CORNER CREATION LOGIC
  const addCornerPoint = useCallback(
    (clickPoint: fabric.Point) => {
      if (
        !wiringState.currentLine ||
        !canvas ||
        wiringState.wirePoints.length === 0
      )
        return;

      console.log("📐 Adding corner point");

      // Get the last waypoint
      const lastWaypoint =
        wiringState.wirePoints[wiringState.wirePoints.length - 1];

      // Calculate orthogonal point from last waypoint to click location
      const orthogonalPoint = calculateOrthogonalPointWithValidation(
        lastWaypoint,
        clickPoint
      );

      // Add this point as a new fixed waypoint
      const newWirePoints = [...wiringState.wirePoints, orthogonalPoint];

      // Update state with new waypoint using new state setters
      setWirePoints(newWirePoints);

      console.log(
        "✅ Corner added at",
        orthogonalPoint.x,
        orthogonalPoint.y,
        "- preview continues"
      );
    },
    [
      wiringState.currentLine,
      wiringState.wirePoints,
      canvas,
      calculateOrthogonalPointWithValidation,
    ]
  );

  // RULE #2: Complete wire at junction (wire-to-wire connection)
  const completeWireAtJunction = useCallback(
    (wireInfo: {
      wire: fabric.Polyline;
      segmentIndex: number;
      intersectionPoint: fabric.Point;
    }) => {
      if (!wiringState.currentLine || !wiringState.startPin || !canvas) return;

      console.log("🔗 Completing wire at junction point");

      const { wire: existingWire, segmentIndex, intersectionPoint } = wireInfo;

      // Get the last waypoint for orthogonal calculation
      const lastWaypoint =
        wiringState.wirePoints[wiringState.wirePoints.length - 1];
      const orthogonalJunctionPoint = calculateOrthogonalPointWithValidation(
        lastWaypoint,
        intersectionPoint
      );

      // Create final points array: all waypoints + orthogonal segment + junction point
      const finalPoints = [
        ...wiringState.wirePoints,
        orthogonalJunctionPoint,
        intersectionPoint,
      ];

      // Get component IDs for wire memory
      const startComponent = wiringState.startPin.group;
      const startComponentId =
        (startComponent as any)?.id || `component_${Date.now()}_start`;
      const startPinIndex =
        startComponent?.getObjects().indexOf(wiringState.startPin) || 0;

      // STEP 1: CREATE THE PERMANENT WIRE
      console.log("🔧 STEP 1: Creating permanent junction wire");
      const permanentWire = new fabric.Polyline(finalPoints, {
        fill: "transparent",
        stroke: "#888888", // Neutral color - will be overridden by net coloring
        strokeWidth: 2, // Final solid style
        strokeLineCap: "round",
        strokeLineJoin: "round",
        selectable: true,
        evented: true,
        // RULE #1: Wires are defined by connections, not moved freely
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hasControls: false, // No scaling/rotation controls
        hasBorders: true, // Show selection border for editing
        wireType: "connection",
        id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique wire ID
        startPin: wiringState.startPin,
        startComponentId: startComponentId,
        startPinIndex: startPinIndex,
        startComponent: startComponent,
        // Junction-specific properties
        endsAtJunction: true,
        junctionWire: existingWire,
        junctionPoint: intersectionPoint,
        clipPath: undefined,
        objectCaching: false,
      } as any);

      // Add the permanent wire to canvas
      canvas.add(permanentWire);
      console.log("✅ STEP 1: Permanent junction wire safely added to canvas");

      // APPLY AUTOMATIC NET COLORING FOR JUNCTION
      console.log("🎨 STEP 1.5: Applying automatic net coloring for junction");
      if (wiringState.startPin) {
        const startNet = findPinNet(wiringState.startPin);
        const existingWireNetId = (existingWire as any).netId;

        if (
          existingWireNetId &&
          startNet &&
          startNet.netId !== existingWireNetId
        ) {
          // Merging with existing wire's net
          const existingNet = electricalNets.get(existingWireNetId);
          if (existingNet) {
            console.log("🎨 Junction merging nets");
            const mergedNet = mergeNets(startNet, existingNet);
            addToNet(mergedNet, [], [permanentWire]);
            applyNetColoring(mergedNet);
          }
        } else if (existingWireNetId && !startNet) {
          // Adding to existing wire's net
          const existingNet = electricalNets.get(existingWireNetId);
          if (existingNet) {
            console.log("🎨 Junction adding to existing net");
            addToNet(existingNet, [wiringState.startPin], [permanentWire]);
            applyNetColoring(existingNet);
          }
        } else if (startNet && !existingWireNetId) {
          // Extending existing net to include junction wire
          console.log("🎨 Junction extending existing net");
          addToNet(startNet, [], [permanentWire]);
          applyNetColoring(startNet);
        } else if (!startNet && !existingWireNetId) {
          // Creating new net for junction
          console.log("🎨 Junction creating new net");
          const newNet = createNewNet(
            [wiringState.startPin],
            [permanentWire, existingWire]
          );
          applyNetColoring(newNet);
        }
      }

      // Create and add junction dot
      const junctionDot = createJunctionDot(intersectionPoint);
      canvas.add(junctionDot);

      // Link the junction dot to both wires
      (junctionDot as any).connectedWires = [permanentWire, existingWire];
      (permanentWire as any).junctionDot = junctionDot;

      // Add junction reference to existing wire if not already present
      if (!(existingWire as any).junctionDots) {
        (existingWire as any).junctionDots = [];
      }
      (existingWire as any).junctionDots.push(junctionDot);

      // STEP 2: CLEAN UP THE TEMPORARY PREVIEW
      console.log("🧹 STEP 2: Removing temporary ghost wire");
      const temporaryGhostWire = wiringState.currentLine;
      if (temporaryGhostWire) {
        canvas.remove(temporaryGhostWire);
        console.log("✅ STEP 2: Temporary ghost wire removed");
      }

      // STEP 3: RESET THE TOOL'S STATE
      console.log("🔄 STEP 3: Resetting tool state");
      setIsDrawing(false);
      setCurrentLine(null); // Clear the temporary line reference
      setStartPin(null);
      setWirePoints([]);

      // Clear highlights
      clearPinHighlight();

      // TRAFFIC LIGHT: YELLOW → GREEN → RED transition
      setTrafficLightState("GREEN");
      console.log("🟢 TRAFFIC LIGHT: GREEN (Finishing - Wire completed)");

      // Final render to update the screen
      canvas.renderAll();
      console.log("✅ STEP 3: Tool state reset and canvas updated");

      console.log("🎉 Wire completed successfully with junction");
      console.log(
        "🔗 Junction created at:",
        intersectionPoint.x,
        intersectionPoint.y
      );

      // Transition back to RED state after a brief moment
      setTimeout(() => {
        setTrafficLightState("RED");
        console.log("🔴 TRAFFIC LIGHT: RED (Idle - Ready for next wire)");
      }, 100);
    },
    [
      wiringState.currentLine,
      wiringState.startPin,
      wiringState.wirePoints,
      canvas,
      calculateOrthogonalPointWithValidation,
      createJunctionDot,
      clearPinHighlight,
      findPinNet,
      electricalNets,
      mergeNets,
      addToNet,
      applyNetColoring,
      createNewNet,
    ]
  );

  // Complete wire at end pin
  const completeWireAtPin = useCallback(
    (endPin: fabric.Object) => {
      if (!wiringState.currentLine || !wiringState.startPin || !canvas) return;

      console.log("🎯 Completing wire at end pin");

      const endPinCoords = getPinWorldCoordinates(endPin);

      // Get the last waypoint for orthogonal calculation
      const lastWaypoint =
        wiringState.wirePoints[wiringState.wirePoints.length - 1];
      const orthogonalEndPoint = calculateOrthogonalPointWithValidation(
        lastWaypoint,
        endPinCoords
      );

      // Create final points array: all waypoints + orthogonal segment + end pin
      const finalPoints = [
        ...wiringState.wirePoints,
        orthogonalEndPoint,
        endPinCoords,
      ];

      // Get component IDs and pin indices for wire memory
      const startComponent = wiringState.startPin.group;
      const endComponent = endPin.group;
      const startComponentId =
        (startComponent as any)?.id || `component_${Date.now()}_start`;
      const endComponentId =
        (endComponent as any)?.id || `component_${Date.now()}_end`;

      // Find pin indices within their respective components
      const startPinIndex =
        startComponent?.getObjects().indexOf(wiringState.startPin) || 0;
      const endPinIndex = endComponent?.getObjects().indexOf(endPin) || 0;

      // STEP 1: CREATE THE PERMANENT WIRE
      console.log("🔧 STEP 1: Creating permanent wire");
      const permanentWire = new fabric.Polyline(finalPoints, {
        fill: "transparent",
        stroke: "#888888", // Neutral color - will be overridden by net coloring
        strokeWidth: 2, // Final solid style
        strokeLineCap: "round",
        strokeLineJoin: "round",
        selectable: true,
        evented: true,
        // RULE #1: Wires are defined by connections, not moved freely
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hasControls: false, // No scaling/rotation controls
        hasBorders: true, // Show selection border for editing
        wireType: "connection",
        id: `wire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique wire ID
        startPin: wiringState.startPin,
        endPin: endPin,
        // PART 1: Wire Memory - Store connection information
        startComponentId: startComponentId,
        endComponentId: endComponentId,
        startPinIndex: startPinIndex,
        endPinIndex: endPinIndex,
        startComponent: startComponent,
        endComponent: endComponent,
        clipPath: undefined, // CRITICAL: Disable clipping for final wire
        objectCaching: false, // CRITICAL: Prevent visual glitches
      } as any);

      // Add the permanent wire to canvas
      canvas.add(permanentWire);
      console.log("✅ STEP 1: Permanent wire safely added to canvas");

      // APPLY AUTOMATIC NET COLORING
      console.log("🎨 STEP 1.5: Applying automatic net coloring");
      if (wiringState.startPin && endPin) {
        handleNetColoring(wiringState.startPin, endPin, permanentWire);
      }

      // STEP 2: CLEAN UP THE TEMPORARY PREVIEW
      console.log("🧹 STEP 2: Removing temporary ghost wire");
      const temporaryGhostWire = wiringState.currentLine;
      if (temporaryGhostWire) {
        canvas.remove(temporaryGhostWire);
        console.log("✅ STEP 2: Temporary ghost wire removed");
      }

      // STEP 3: RESET THE TOOL'S STATE
      console.log("🔄 STEP 3: Resetting tool state");
      setIsDrawing(false);
      setCurrentLine(null); // Clear the temporary line reference
      setStartPin(null);
      setWirePoints([]);

      // Clear highlights
      clearPinHighlight();

      // TRAFFIC LIGHT: YELLOW → GREEN → RED transition
      setTrafficLightState("GREEN");
      console.log("🟢 TRAFFIC LIGHT: GREEN (Finishing - Wire completed)");

      // Final render to update the screen
      canvas.renderAll();
      console.log("✅ STEP 3: Tool state reset and canvas updated");

      console.log(
        "🎉 Wire completed successfully with",
        finalPoints.length,
        "points"
      );
      console.log("🔗 Wire memory stored:", {
        startComponentId,
        endComponentId,
        startPinIndex,
        endPinIndex,
      });

      // Transition back to RED state after a brief moment
      setTimeout(() => {
        setTrafficLightState("RED");
        console.log("🔴 TRAFFIC LIGHT: RED (Idle - Ready for next wire)");
      }, 100);
    },
    [
      wiringState.currentLine,
      wiringState.startPin,
      wiringState.wirePoints,
      canvas,
      getPinWorldCoordinates,
      calculateOrthogonalPointWithValidation,
      clearPinHighlight,
      handleNetColoring,
    ]
  );

  // Toggle wire mode
  const toggleWireMode = useCallback(() => {
    if (isWireMode) {
      exitWireMode();
    } else {
      console.log("🔧 Entering wire mode");
      setIsWireMode(true);
      // PART 3: Call the "Reset" Function - When Switching to Wire Tool (Ensure Clean State)
      resetWiringState(); // Ensure clean state
    }
  }, [isWireMode]);

  // Exit wire mode
  const exitWireMode = useCallback(() => {
    console.log("🚪 Exiting wire mode");
    // PART 3: Call the "Reset" Function - When Switching to Another Tool
    resetWiringState();
    setIsWireMode(false);
  }, [resetWiringState]);

  // RULE #4: Wires only disconnect when explicitly deleted
  const deleteWire = useCallback(
    (targetWire: fabric.Polyline & any) => {
      if (!canvas) return;

      console.log("🗑️ RULE #4: Explicit wire deletion initiated");

      try {
        // Remove from electrical nets
        if (targetWire.netId && electricalNets.has(targetWire.netId)) {
          const net = electricalNets.get(targetWire.netId)!;

          // Remove this wire from the net (wires is a Set)
          net.wires.delete(targetWire);

          console.log(`🔌 RULE #4: Wire removed from net ${targetWire.netId}`);

          // If net is empty, remove it entirely
          if (net.wires.size === 0) {
            electricalNets.delete(targetWire.netId);
            console.log(`🗑️ RULE #4: Empty net ${targetWire.netId} deleted`);
          }
        }

        // Remove from canvas
        canvas.remove(targetWire);
        canvas.renderAll();

        console.log(
          "✅ RULE #4: Wire explicitly deleted - no accidental disconnection"
        );
      } catch (error) {
        console.error(
          "❌ RULE #4: Error during explicit wire deletion:",
          error
        );
      }
    },
    [canvas, electricalNets]
  );

  const updateConnectedWires = useCallback(
    (movingComponent: fabric.Group) => {
      if (!canvas) return;

      console.log(
        "🔄 RULE #3: Intelligent wire rerouting for component movement"
      );

      // Get component ID - try multiple fallback methods
      const componentId =
        (movingComponent as any)?.id ||
        (movingComponent as any)?.componentId ||
        `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Find all wires connected to this component
      const allObjects = canvas.getObjects();
      const connectedWires = allObjects.filter((obj) => {
        if ((obj as any).wireType !== "connection") return false;
        const wire = obj as any;

        // Check both component ID and direct component reference
        return (
          wire.startComponentId === componentId ||
          wire.endComponentId === componentId ||
          wire.startComponent === movingComponent ||
          wire.endComponent === movingComponent
        );
      });

      console.log(
        `📍 RULE #3: Found ${connectedWires.length} wires to reroute`
      );

      // RULE #3: Completely recalculate wire paths instead of stretching
      connectedWires.forEach((wireObj, index) => {
        const wire = wireObj as fabric.Polyline & any;

        try {
          console.log(`🔗 RULE #3: Recalculating path for wire ${index + 1}`);

          // Get fresh pin coordinates (one will have moved)
          let startPinCoords: fabric.Point;
          let endPinCoords: fabric.Point;

          // Calculate start pin coordinates
          if (wire.startComponent && typeof wire.startPinIndex === "number") {
            const startPin =
              wire.startComponent.getObjects()[wire.startPinIndex];
            if (startPin) {
              startPinCoords = getPinWorldCoordinates(startPin);
            } else {
              console.warn("Start pin not found, using wire start point");
              startPinCoords = new fabric.Point(
                wire.points[0].x,
                wire.points[0].y
              );
            }
          } else {
            startPinCoords = new fabric.Point(
              wire.points[0].x,
              wire.points[0].y
            );
          }

          // Calculate end pin coordinates
          if (wire.endComponent && typeof wire.endPinIndex === "number") {
            const endPin = wire.endComponent.getObjects()[wire.endPinIndex];
            if (endPin) {
              endPinCoords = getPinWorldCoordinates(endPin);
            } else {
              const lastPoint = wire.points[wire.points.length - 1];
              endPinCoords = new fabric.Point(lastPoint.x, lastPoint.y);
            }
          } else if (wire.endsAtJunction) {
            // Junction wire - use the junction point
            endPinCoords =
              wire.junctionPoint ||
              new fabric.Point(
                wire.points[wire.points.length - 1].x,
                wire.points[wire.points.length - 1].y
              );
          } else {
            const lastPoint = wire.points[wire.points.length - 1];
            endPinCoords = new fabric.Point(lastPoint.x, lastPoint.y);
          }

          // RULE #3: Calculate completely new, clean orthogonal path
          console.log(
            `  🧭 Calculating fresh orthogonal path from (${startPinCoords.x}, ${startPinCoords.y}) to (${endPinCoords.x}, ${endPinCoords.y})`
          );

          const obstacles = allObjects.filter(
            (obj) =>
              (obj as any).componentType &&
              obj.type === "group" &&
              obj !== movingComponent
          );

          const newPath = calculateOrthogonalPath(
            startPinCoords,
            endPinCoords,
            obstacles
          );

          // Apply the new path
          wire.set({ points: newPath });

          // Maintain net coloring
          const wireNetId = wire.netId;
          if (wireNetId && electricalNets.has(wireNetId)) {
            const net = electricalNets.get(wireNetId)!;
            wire.set({ stroke: net.color });
          }

          console.log(
            `  ✅ RULE #3: Wire rerouted with ${newPath.length} points using intelligent pathfinding`
          );
        } catch (error) {
          console.error(
            `  ❌ RULE #3: Error rerouting wire ${index + 1}:`,
            error
          );
        }
      });

      // Force canvas redraw to show updates
      canvas.renderAll();
      console.log(
        "🎨 RULE #3: Canvas redrawn with intelligently rerouted wires"
      );
    },
    [canvas, getPinWorldCoordinates, calculateOrthogonalPath, electricalNets]
  );

  // RULE #4: Safe component movement that never accidentally disconnects wires
  const safeComponentMovement = useCallback(
    (movingComponent: fabric.Group) => {
      console.log(
        "🔒 RULE #4: Safe component movement - wires will reroute, never disconnect"
      );

      // Apply Rule #3 intelligent rerouting
      updateConnectedWires(movingComponent);

      // Rule #4 guarantee: No wire deletion during component movement
      console.log(
        "✅ RULE #4: Component moved safely - all connections preserved"
      );
    },
    [updateConnectedWires]
  );

  // PART 3: THE "PIN VISIBILITY" RULE - Perfect Wiring System
  // Rule: Pins are ONLY visible in Wire Mode, hidden everywhere else
  useEffect(() => {
    if (!canvas) return;

    console.log(
      `🔍 PIN VISIBILITY: Updating pin visibility for Wire Mode: ${isWireMode}`
    );

    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      // Handle new Component Sandwich architecture
      if ((obj as any).data?.isComponentSandwich && obj.type === "group") {
        const componentSandwich = obj as fabric.Group;
        const sandwichLayers = componentSandwich.getObjects();

        sandwichLayers.forEach((layer) => {
          // Find interactive pins (yellow circles) in the sandwich
          if ((layer as any).pin && layer.type === "circle") {
            if (isWireMode) {
              // SHOW pins in Wire Mode
              layer.set({
                opacity: 1,
                strokeWidth: 2,
                fill: "rgba(255, 255, 0, 0.8)", // Bright yellow
                stroke: "rgba(0, 56, 223, 1)", // Blue border
                visible: true,
              });
            } else {
              // HIDE pins in all other modes
              layer.set({
                opacity: 0.1, // Nearly invisible but still there
                strokeWidth: 0,
                fill: "transparent",
                stroke: "transparent",
                visible: true, // Keep in DOM for hit detection
              });
            }
          }
        });
      }

      // Legacy support for old component structure (if any exist)
      else if ((obj as any).componentType && obj.type === "group") {
        const group = obj as fabric.Group;
        const groupObjects = group.getObjects();

        groupObjects.forEach((groupObj) => {
          if ((groupObj as any).pin) {
            if (isWireMode) {
              groupObj.set({
                strokeWidth: 2,
                fill: "rgba(0, 56, 223, 0.3)",
                visible: true,
              });
            } else {
              groupObj.set({
                strokeWidth: 0,
                fill: "transparent",
                visible: true, // Keep for hit detection
              });
            }
          }
        });
      }
    });

    canvas.renderAll();
    console.log(
      `✅ PIN VISIBILITY: ${
        isWireMode ? "SHOWN" : "HIDDEN"
      } all pins based on Wire Mode`
    );
  }, [canvas, isWireMode]);

  // Main mouse event handlers for wire mode
  useEffect(() => {
    if (!canvas || !enabled || !isWireMode) return;

    console.log("🎮 Setting up wire mode event handlers");

    // Configure canvas for wire mode
    canvas.selection = false;
    canvas.defaultCursor = "crosshair";

    // Disable component interaction in wire mode
    canvas.forEachObject((obj) => {
      if ((obj as any).componentType) {
        obj.selectable = false;
        obj.evented = false;
      }
    });

    const handleMouseMove = (options: any) => {
      const pointer = canvas.getPointer(options.e);
      const currentPoint = new fabric.Point(pointer.x, pointer.y);
      const pin = findPinAtPoint(currentPoint);

      // Handle pin highlighting and cursor changes
      if (pin && pin !== wiringState.startPin) {
        highlightPin(pin);
        // Change cursor to "+" when hovering over a valid pin
        canvas.defaultCursor = "copy"; // "+" cursor
      } else {
        clearPinHighlight();
        // Reset to crosshair when not over a pin
        canvas.defaultCursor = "crosshair";
      }

      // PART 1 FIX: Update live wire preview
      if (wiringState.isDrawingWire) {
        updateWirePreview(currentPoint);
      }
    };

    const handleMouseDown = (options: any) => {
      const pointer = canvas.getPointer(options.e);
      const currentPoint = new fabric.Point(pointer.x, pointer.y);
      const pin = findPinAtPoint(currentPoint);

      // PART 3: Call the "Reset" Function - After Cancelling with a Right-Click
      if (options.e.button === 2 && wiringState.isDrawingWire) {
        // Right-click
        console.log("❌ Wire cancelled by right-click");
        resetWiringTool();
        return;
      }

      // RULE #2: Check for wire intersection when drawing
      const wireInfo = findWireAtPoint(currentPoint);

      if (!wiringState.isDrawingWire && pin) {
        // Start new wire from pin
        startWireFromPin(pin, currentPoint);
      } else if (wiringState.isDrawingWire) {
        if (pin && pin !== wiringState.startPin) {
          // Complete wire at end pin
          completeWireAtPin(pin);
        } else if (wireInfo && !pin) {
          // RULE #2: Complete wire at junction point (wire-to-wire connection)
          console.log(
            "🔗 Junction detected - creating wire-to-wire connection"
          );
          completeWireAtJunction(wireInfo);
        } else {
          // CORNER CREATION: Add waypoint on empty canvas click
          addCornerPoint(currentPoint);
        }
      }
    };

    // Attach event listeners
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:down", handleMouseDown);

    return () => {
      console.log("🧹 Cleaning up wire mode event handlers");

      // Restore canvas state
      canvas.selection = true;
      canvas.defaultCursor = "default";

      // Restore component interaction
      canvas.forEachObject((obj) => {
        if ((obj as any).componentType) {
          obj.selectable = true;
          obj.evented = true;
        }
      });

      // Remove event listeners
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:down", handleMouseDown);
    };
  }, [
    canvas,
    enabled,
    isWireMode,
    wiringState,
    findPinAtPoint,
    highlightPin,
    clearPinHighlight,
    updateWirePreview,
    startWireFromPin,
    completeWireAtPin,
    addCornerPoint,
  ]);

  // Keyboard event handlers
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key.toLowerCase() === "w" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        toggleWireMode();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (wiringState.isDrawingWire) {
          // PART 3: Call the "Reset" Function - After Cancelling with the Esc Key
          console.log("❌ Wire cancelled by user");
          resetWiringState();
        } else {
          exitWireMode();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    enabled,
    toggleWireMode,
    exitWireMode,
    wiringState.isDrawingWire,
    resetWiringState,
  ]);

  return {
    isWireMode,
    isDrawingWire: wiringState.isDrawingWire,
    wireState: wiringState.isDrawingWire ? "drawing" : "idle", // For UI compatibility
    trafficLightState, // NEW: Traffic light state for perfect state management
    toggleWireMode,
    exitWireMode,
    updateConnectedWires, // PART 2: Expose wire update function
    safeComponentMovement, // RULE #4: Safe component movement that preserves connections
    deleteWire, // RULE #4: Explicit wire deletion
    getNetInfo, // NET COLORING: Expose net information for debugging/UI
  };
}
