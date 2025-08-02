/**
 * Definitive Wiring Tool - Built from scratch for reliability
 * Fixes: invisible wire preview, inconsistent state, corner drawing
 */

import { useEffect, useState, useCallback, useRef } from "react";
import * as fabric from "fabric";

// Simple, reliable state management
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
  const [isWireMode, setIsWireMode] = useState(false);
  const [wiringState, setWiringState] = useState<WiringState>({
    isDrawingWire: false,
    currentLine: null,
    startPin: null,
    wirePoints: [],
  });

  // Pin highlighting state
  const [highlightedPin, setHighlightedPin] = useState<fabric.Object | null>(null);
  const originalPinState = useRef<Map<fabric.Object, any>>(new Map());

  // Find pin at coordinates with tolerance
  const findPinAtPoint = useCallback((point: fabric.Point): fabric.Object | null => {
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
  }, [canvas]);

  // Get pin world coordinates
  const getPinWorldCoordinates = useCallback((pin: fabric.Object): fabric.Point => {
    const identityMatrix = [1, 0, 0, 1, 0, 0] as fabric.TMat2D;
    return fabric.util.transformPoint(
      new fabric.Point(pin.left || 0, pin.top || 0),
      pin.group?.calcTransformMatrix() || identityMatrix
    );
  }, []);

  // Highlight pin
  const highlightPin = useCallback((pin: fabric.Object) => {
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
  }, [highlightedPin, canvas]);

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

  // CRITICAL: Reset the tool to clean state
  const resetWiringState = useCallback(() => {
    console.log("🔄 Resetting wiring tool to clean state");
    
    // Remove current line if exists
    if (wiringState.currentLine && canvas) {
      canvas.remove(wiringState.currentLine);
      canvas.renderAll();
    }

    // Clear highlights
    clearPinHighlight();

    // Reset state variables - THIS IS THE CRITICAL FIX
    setWiringState({
      isDrawingWire: false,
      currentLine: null,
      startPin: null,
      wirePoints: [],
    });

    console.log("✅ Tool reset complete - ready for next wire");
  }, [wiringState.currentLine, canvas, clearPinHighlight]);

  // Start drawing a wire from a pin
  const startWireFromPin = useCallback((pin: fabric.Object, clickPoint: fabric.Point) => {
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
      clipPath: undefined,     // CRITICAL: Disable clipping
      objectCaching: false,    // CRITICAL: Prevent visual glitches
    });

    // Add to canvas immediately for instant visibility
    canvas.add(newLine);
    canvas.renderAll(); // Force immediate render

    // Update state
    setWiringState({
      isDrawingWire: true,
      currentLine: newLine,
      startPin: pin,
      wirePoints: [pinCoords], // Store fixed waypoints
    });

    console.log("✅ Wire preview created and visible - now following cursor");
  }, [canvas, getPinWorldCoordinates, calculateOrthogonalPoint]);

  // Update wire preview during mouse move - THE CRITICAL LIVE PREVIEW FIX
  const updateWirePreview = useCallback((mousePoint: fabric.Point) => {
    if (!wiringState.currentLine || !canvas || wiringState.wirePoints.length === 0) return;

    // Get the last fixed waypoint
    const lastWaypoint = wiringState.wirePoints[wiringState.wirePoints.length - 1];
    
    // Calculate orthogonal point from last waypoint to current mouse position
    const orthogonalPoint = calculateOrthogonalPoint(lastWaypoint, mousePoint);

    // Create new points array: all fixed waypoints + current orthogonal preview point
    const newPoints = [...wiringState.wirePoints, orthogonalPoint];
    
    // Update polyline points
    wiringState.currentLine.set({ points: newPoints });
    
    // CRITICAL: Force canvas update for live preview
    canvas.renderAll();
  }, [wiringState.currentLine, wiringState.wirePoints, canvas, calculateOrthogonalPoint]);

  // Add corner point when clicking on empty space - THE CORNER CREATION LOGIC
  const addCornerPoint = useCallback((clickPoint: fabric.Point) => {
    if (!wiringState.currentLine || !canvas || wiringState.wirePoints.length === 0) return;

    console.log("📐 Adding corner point");

    // Get the last waypoint
    const lastWaypoint = wiringState.wirePoints[wiringState.wirePoints.length - 1];
    
    // Calculate orthogonal point from last waypoint to click location
    const orthogonalPoint = calculateOrthogonalPoint(lastWaypoint, clickPoint);

    // Add this point as a new fixed waypoint
    const newWirePoints = [...wiringState.wirePoints, orthogonalPoint];
    
    // Update state with new waypoint
    setWiringState(prev => ({
      ...prev,
      wirePoints: newWirePoints,
    }));

    console.log("✅ Corner added at", orthogonalPoint.x, orthogonalPoint.y, "- preview continues");
  }, [wiringState.currentLine, wiringState.wirePoints, canvas, calculateOrthogonalPoint]);

  // Complete wire at end pin
  const completeWireAtPin = useCallback((endPin: fabric.Object) => {
    if (!wiringState.currentLine || !wiringState.startPin || !canvas) return;

    console.log("🎯 Completing wire at end pin");

    const endPinCoords = getPinWorldCoordinates(endPin);
    
    // Get the last waypoint for orthogonal calculation
    const lastWaypoint = wiringState.wirePoints[wiringState.wirePoints.length - 1];
    const orthogonalEndPoint = calculateOrthogonalPoint(lastWaypoint, endPinCoords);

    // Create final points array: all waypoints + orthogonal segment + end pin
    const finalPoints = [...wiringState.wirePoints, orthogonalEndPoint, endPinCoords];

    // Get component IDs and pin indices for wire memory
    const startComponent = wiringState.startPin.group;
    const endComponent = endPin.group;
    const startComponentId = (startComponent as any)?.id || `component_${Date.now()}_start`;
    const endComponentId = (endComponent as any)?.id || `component_${Date.now()}_end`;
    
    // Find pin indices within their respective components
    const startPinIndex = startComponent?.getObjects().indexOf(wiringState.startPin) || 0;
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
      clipPath: undefined,     // CRITICAL: Disable clipping for final wire
      objectCaching: false,    // CRITICAL: Prevent visual glitches
    } as any);

    canvas.renderAll();

    console.log("✅ Wire completed successfully with", finalPoints.length, "points");
    console.log("🔗 Wire memory stored:", {
      startComponentId,
      endComponentId,
      startPinIndex,
      endPinIndex
    });

    // CRITICAL: Reset for next wire (but don't remove the completed line)
    setWiringState({
      isDrawingWire: false,
      currentLine: null,
      startPin: null,
      wirePoints: [],
    });

    // Clear highlights
    clearPinHighlight();

    console.log("✅ Tool reset complete - ready for next wire");
  }, [wiringState.currentLine, wiringState.startPin, wiringState.wirePoints, canvas, getPinWorldCoordinates, calculateOrthogonalPoint, clearPinHighlight]);

  // Toggle wire mode
  const toggleWireMode = useCallback(() => {
    if (isWireMode) {
      exitWireMode();
    } else {
      console.log("🔧 Entering wire mode");
      setIsWireMode(true);
      resetWiringState(); // Ensure clean state
    }
  }, [isWireMode]);

  // Exit wire mode
  const exitWireMode = useCallback(() => {
    console.log("🚪 Exiting wire mode");
    resetWiringState();
    setIsWireMode(false);
  }, [resetWiringState]);

  // PART 2: Update connected wires when a component moves
  const updateConnectedWires = useCallback((movingComponent: fabric.Group) => {
    if (!canvas) return;

    console.log("🔄 Updating wires connected to moving component");

    // Get component ID
    const componentId = (movingComponent as any)?.id;
    if (!componentId) return;

    // Find all wires connected to this component
    const allObjects = canvas.getObjects();
    const connectedWires = allObjects.filter(obj => {
      if ((obj as any).wireType !== "connection") return false;
      const wire = obj as any;
      return wire.startComponentId === componentId || wire.endComponentId === componentId;
    });

    console.log(`📍 Found ${connectedWires.length} wires connected to component ${componentId}`);

    // Update each connected wire
    connectedWires.forEach((wireObj) => {
      const wire = wireObj as fabric.Polyline & any;
      
      try {
        // Get current pin coordinates
        let startPinCoords: fabric.Point;
        let endPinCoords: fabric.Point;

        if (wire.startComponentId === componentId) {
          // Start component moved - recalculate start pin position
          const startPin = wire.startComponent?.getObjects()[wire.startPinIndex];
          if (startPin) {
            startPinCoords = getPinWorldCoordinates(startPin);
          } else {
            startPinCoords = new fabric.Point(wire.points[0].x, wire.points[0].y);
          }
          // End pin stays the same
          const endPin = wire.endComponent?.getObjects()[wire.endPinIndex];
          if (endPin) {
            endPinCoords = getPinWorldCoordinates(endPin);
          } else {
            const lastPoint = wire.points[wire.points.length - 1];
            endPinCoords = new fabric.Point(lastPoint.x, lastPoint.y);
          }
        } else {
          // End component moved - recalculate end pin position
          const startPin = wire.startComponent?.getObjects()[wire.startPinIndex];
          if (startPin) {
            startPinCoords = getPinWorldCoordinates(startPin);
          } else {
            startPinCoords = new fabric.Point(wire.points[0].x, wire.points[0].y);
          }
          // Recalculate end pin
          const endPin = wire.endComponent?.getObjects()[wire.endPinIndex];
          if (endPin) {
            endPinCoords = getPinWorldCoordinates(endPin);
          } else {
            const lastPoint = wire.points[wire.points.length - 1];
            endPinCoords = new fabric.Point(lastPoint.x, lastPoint.y);
          }
        }

        // Reconstruct wire path maintaining middle waypoints
        const currentPoints = wire.points || [];
        let newPoints: fabric.Point[];

        if (currentPoints.length <= 2) {
          // Simple two-point wire
          newPoints = [startPinCoords, endPinCoords];
        } else {
          // Multi-point wire - keep middle waypoints, update endpoints
          const middlePoints = currentPoints.slice(1, -1);
          newPoints = [startPinCoords, ...middlePoints, endPinCoords];
        }

        // Update wire geometry
        wire.set({ points: newPoints });
        
        console.log(`🔗 Updated wire with ${newPoints.length} points`);

      } catch (error) {
        console.warn("⚠️ Error updating wire:", error);
      }
    });

    // Force canvas redraw
    canvas.renderAll();
  }, [canvas, getPinWorldCoordinates]);

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

      if (!wiringState.isDrawingWire && pin) {
        // Start new wire from pin
        startWireFromPin(pin, currentPoint);
      } else if (wiringState.isDrawingWire) {
        if (pin && pin !== wiringState.startPin) {
          // Complete wire at end pin
          completeWireAtPin(pin);
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
          // PART 2 FIX: Reset on cancel
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
  }, [enabled, toggleWireMode, exitWireMode, wiringState.isDrawingWire, resetWiringState]);

  return {
    isWireMode,
    isDrawingWire: wiringState.isDrawingWire,
    wireState: wiringState.isDrawingWire ? 'drawing' : 'idle', // For UI compatibility
    toggleWireMode,
    exitWireMode,
    updateConnectedWires, // PART 2: Expose wire update function
  };
}
