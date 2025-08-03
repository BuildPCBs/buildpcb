/**
 * Definitive Wiring Tool - Built from scratch for reliability
 * Fixes: invisible wire preview, inconsistent state, corner drawing
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

interface UseWiringToolProps {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
}

interface UseWiringToolReturn {
  isWireMode: boolean;
  isDrawingWire: boolean;
  wireState: string; // For UI compatibility: 'idle' | 'drawing'
  toggleWireMode: () => void;
  exitWireMode: () => void;
  // PART 2: Expose wire-component connection functions
  updateConnectedWires: (component: fabric.Group) => void;
}

export function useWiringTool({
  canvas,
  enabled = true,
}: UseWiringToolProps): UseWiringToolReturn {
  // PART 1: Define the State - Exact implementation as specified
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPin, setStartPin] = useState<fabric.Object | null>(null);
  const [currentLine, setCurrentLine] = useState<fabric.Polyline | null>(null);

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
        if ((obj as any).componentType && obj.type === "group") {
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

  // Calculate orthogonal point for 90-degree routing
  const calculateOrthogonalPoint = useCallback(
    (lastPoint: fabric.Point, currentPoint: fabric.Point): fabric.Point => {
      const deltaX = Math.abs(currentPoint.x - lastPoint.x);
      const deltaY = Math.abs(currentPoint.y - lastPoint.y);

      // Decide direction based on which delta is larger
      if (deltaX > deltaY) {
        // Horizontal line - fix Y coordinate
        return new fabric.Point(currentPoint.x, lastPoint.y);
      } else {
        // Vertical line - fix X coordinate
        return new fabric.Point(lastPoint.x, currentPoint.y);
      }
    },
    []
  );

  // PART 2: Create the "Reset" Function (The Most Important Step)
  const resetWiringTool = useCallback(() => {
    console.log("🔄 DEFINITIVE RESET: Resetting wiring tool to clean state");

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
    console.log("--- Wiring tool has been reset. ---");
  }, [currentLine, canvas, clearPinHighlight]);

  // Legacy reset function for backward compatibility
  const resetWiringState = resetWiringTool;

  // Start drawing a wire from a pin
  const startWireFromPin = useCallback(
    (pin: fabric.Object, clickPoint: fabric.Point) => {
      if (!canvas) return;

      console.log("🎯 Starting wire from pin");

      const pinCoords = getPinWorldCoordinates(pin);
      const orthogonalPoint = calculateOrthogonalPoint(pinCoords, clickPoint);

      // Create visible POLYLINE immediately with pin coordinates as start
      const initialPoints = [pinCoords, orthogonalPoint];
      const newLine = new fabric.Polyline(initialPoints, {
        fill: "transparent",
        stroke: "#0038DF",
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
    [canvas, getPinWorldCoordinates, calculateOrthogonalPoint]
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
      const orthogonalPoint = calculateOrthogonalPoint(
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
      calculateOrthogonalPoint,
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
      const orthogonalPoint = calculateOrthogonalPoint(
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
      calculateOrthogonalPoint,
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
      const orthogonalJunctionPoint = calculateOrthogonalPoint(
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

      // Update the current polyline to final state with junction connection
      wiringState.currentLine.set({
        points: finalPoints,
        selectable: true,
        evented: true,
        wireType: "connection",
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

      // Create and add junction dot
      const junctionDot = createJunctionDot(intersectionPoint);
      canvas.add(junctionDot);

      // Link the junction dot to both wires
      (junctionDot as any).connectedWires = [
        wiringState.currentLine,
        existingWire,
      ];
      (wiringState.currentLine as any).junctionDot = junctionDot;

      // Add junction reference to existing wire if not already present
      if (!(existingWire as any).junctionDots) {
        (existingWire as any).junctionDots = [];
      }
      (existingWire as any).junctionDots.push(junctionDot);

      canvas.renderAll();

      console.log("✅ Wire completed successfully with junction");
      console.log(
        "🔗 Junction created at:",
        intersectionPoint.x,
        intersectionPoint.y
      );

      // PART 3: Call the "Reset" Function - After Successfully Completing a Wire
      resetWiringTool();
    },
    [
      wiringState.currentLine,
      wiringState.startPin,
      wiringState.wirePoints,
      canvas,
      calculateOrthogonalPoint,
      createJunctionDot,
      resetWiringTool,
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
      const orthogonalEndPoint = calculateOrthogonalPoint(
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

      // Update the current polyline to final state with connection memory
      wiringState.currentLine.set({
        points: finalPoints,
        selectable: true,
        evented: true,
        wireType: "connection",
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

      canvas.renderAll();

      console.log(
        "✅ Wire completed successfully with",
        finalPoints.length,
        "points"
      );
      console.log("🔗 Wire memory stored:", {
        startComponentId,
        endComponentId,
        startPinIndex,
        endPinIndex,
      });

      // PART 3: Call the "Reset" Function - After Successfully Completing a Wire
      resetWiringTool();
    },
    [
      wiringState.currentLine,
      wiringState.startPin,
      wiringState.wirePoints,
      canvas,
      getPinWorldCoordinates,
      calculateOrthogonalPoint,
      resetWiringTool,
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

  // PART 2: Update connected wires when a component moves - ENHANCED WITH RULE #3 INTELLIGENT REROUTING
  const updateConnectedWires = useCallback(
    (movingComponent: fabric.Group) => {
      if (!canvas) return;

      console.log("🔄 Updating wires with intelligent rerouting");

      // Get component ID - try multiple fallback methods
      const componentId =
        (movingComponent as any)?.id ||
        (movingComponent as any)?.componentId ||
        `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log("📍 Component ID:", componentId);

      // Get all objects on canvas for obstacle detection
      const allObjects = canvas.getObjects();
      const obstacles = allObjects.filter(
        (obj) =>
          (obj as any).componentType &&
          obj.type === "group" &&
          obj !== movingComponent
      );

      // Find all wires connected to this component
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
        `📍 Found ${connectedWires.length} wires connected to component`
      );

      // Update each connected wire with intelligent rerouting
      connectedWires.forEach((wireObj, index) => {
        const wire = wireObj as fabric.Polyline & any;

        try {
          console.log(
            `🔗 Applying intelligent rerouting to wire ${index + 1}/${
              connectedWires.length
            }`
          );

          // Initialize pin coordinates
          let startPinCoords: fabric.Point;
          let endPinCoords: fabric.Point;
          let shouldReroute = false;

          // Always calculate both start and end coordinates first
          if (wire.startComponent && typeof wire.startPinIndex === "number") {
            const startPin =
              wire.startComponent.getObjects()[wire.startPinIndex];
            if (startPin) {
              startPinCoords = getPinWorldCoordinates(startPin);
            } else {
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

          if (wire.endComponent && typeof wire.endPinIndex === "number") {
            const endPin = wire.endComponent.getObjects()[wire.endPinIndex];
            if (endPin) {
              endPinCoords = getPinWorldCoordinates(endPin);
            } else {
              const lastPoint = wire.points[wire.points.length - 1];
              endPinCoords = new fabric.Point(lastPoint.x, lastPoint.y);
            }
          } else {
            const lastPoint = wire.points[wire.points.length - 1];
            endPinCoords = new fabric.Point(lastPoint.x, lastPoint.y);
          }

          // Determine if rerouting is needed
          if (
            wire.startComponentId === componentId ||
            wire.startComponent === movingComponent
          ) {
            shouldReroute = true;
            console.log("  📌 Start component moved - will reroute");
          }

          if (
            wire.endComponentId === componentId ||
            wire.endComponent === movingComponent
          ) {
            shouldReroute = true;
            console.log("  📌 End component moved - will reroute");
          }

          if (shouldReroute) {
            // RULE #3: Apply intelligent orthogonal rerouting
            console.log("  🧭 Calculating intelligent orthogonal path");
            const newPath = calculateOrthogonalPath(
              startPinCoords,
              endPinCoords,
              obstacles
            );

            // Update wire geometry with new intelligent path
            wire.set({ points: newPath });

            console.log(`  ✅ Wire rerouted with ${newPath.length} points`);
          } else {
            // Fallback: simple endpoint update for non-connected end
            const currentPoints = wire.points || [];
            let newPoints: fabric.Point[];

            if (currentPoints.length <= 2) {
              // Simple two-point wire
              newPoints = [startPinCoords, endPinCoords];
            } else {
              // Multi-point wire - preserve middle waypoints, update endpoints
              const middlePoints = currentPoints.slice(1, -1);
              newPoints = [startPinCoords, ...middlePoints, endPinCoords];
            }

            wire.set({ points: newPoints });
            console.log(
              `  ✅ Wire updated with preserved waypoints (${newPoints.length} points)`
            );
          }
        } catch (error) {
          console.error(`  ❌ Error updating wire ${index + 1}:`, error);
        }
      });

      // Force canvas redraw to show updates
      canvas.renderAll();
      console.log("🎨 Canvas redrawn with intelligently rerouted wires");
    },
    [canvas, getPinWorldCoordinates, calculateOrthogonalPath]
  );

  // Show/hide pins in wire mode
  useEffect(() => {
    if (!canvas) return;

    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if ((obj as any).componentType && obj.type === "group") {
        const group = obj as fabric.Group;
        const groupObjects = group.getObjects();

        groupObjects.forEach((groupObj) => {
          if ((groupObj as any).pin) {
            groupObj.set({
              strokeWidth: isWireMode ? 2 : 0,
              fill: isWireMode ? "rgba(0, 56, 223, 0.3)" : "transparent",
            });
          }
        });
      }
    });

    canvas.renderAll();
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

      // Handle pin highlighting
      if (pin && pin !== wiringState.startPin) {
        highlightPin(pin);
      } else {
        clearPinHighlight();
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
    toggleWireMode,
    exitWireMode,
    updateConnectedWires, // PART 2: Expose wire update function
  };
}
