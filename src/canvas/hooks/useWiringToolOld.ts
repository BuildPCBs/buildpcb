/**
 * Professional-Grade Wiring Tool
 * Implements a state machine approach with orthogonal wire routing
 * Mimics behavior of modern PCB design software
 */

import { useEffect, useState, useCallback, useRef } from "react";
import * as fabric from "fabric";

// Wire tool state machine
type WireState = "idle" | "drawing" | "finishing";

// Simple Line Test Mode - separate from wire tool
interface TestModeState {
  isActive: boolean;
  firstClick: { x: number; y: number } | null;
}

interface WirePoint {
  x: number;
  y: number;
}

interface WireDraftState {
  startPin: fabric.Object | null;
  waypoints: WirePoint[];
  ghostWire: fabric.Polyline | null;
}

interface UseWiringToolProps {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
}

interface UseWiringToolReturn {
  wireState: WireState;
  isWireMode: boolean;
  toggleWireMode: () => void;
  exitWireMode: () => void;
  // Test mode properties
  isTestMode: boolean;
  testModeState: TestModeState;
}

export function useWiringTool({
  canvas,
  enabled = true,
}: UseWiringToolProps): UseWiringToolReturn {
  const [isWireMode, setIsWireMode] = useState(false);
  const [wireState, setWireState] = useState<WireState>("idle");
  const [wireDraft, setWireDraft] = useState<WireDraftState>({
    startPin: null,
    waypoints: [],
    ghostWire: null,
  });

  // Keep track of highlighted pin for visual feedback
  const [highlightedPin, setHighlightedPin] = useState<fabric.Object | null>(
    null
  );
  const originalPinState = useRef<Map<fabric.Object, any>>(new Map());

  // Simple Line Test Mode state - completely separate from wire tool
  const [testModeState, setTestModeState] = useState<TestModeState>({
    isActive: false,
    firstClick: null,
  });
  const [isTestMode, setIsTestMode] = useState(false);

  // Toggle wire drawing mode
  const toggleWireMode = useCallback(() => {
    if (isWireMode) {
      exitWireMode();
    } else {
      setIsWireMode(true);
      setWireState("idle");
    }
  }, [isWireMode]); // Removed exitWireMode from deps to avoid circular dependency

  // Exit wire mode and clean up
  const exitWireMode = useCallback(() => {
    // Cancel any active wire drawing
    if (wireDraft.ghostWire && canvas) {
      canvas.remove(wireDraft.ghostWire);
      canvas.renderAll();
    }

    // Clear highlighted pins
    if (highlightedPin && canvas) {
      clearPinHighlight(highlightedPin);
    }

    // Reset all state
    setIsWireMode(false);
    setWireState("idle");
    setWireDraft({
      startPin: null,
      waypoints: [],
      ghostWire: null,
    });
    setHighlightedPin(null);
  }, [canvas, wireDraft.ghostWire, highlightedPin]);

  // Find pin at specific coordinates
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
              // Convert group-relative coordinates to canvas coordinates
              const pinPoint = fabric.util.transformPoint(
                new fabric.Point(groupObj.left || 0, groupObj.top || 0),
                group.calcTransformMatrix()
              );

              const distance = point.distanceFrom(pinPoint);
              if (distance <= 8) {
                // 8px tolerance for pin detection
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

  // Get world coordinates of a pin
  const getPinWorldCoordinates = useCallback(
    (pin: fabric.Object): WirePoint => {
      const identityMatrix = [1, 0, 0, 1, 0, 0] as fabric.TMat2D;
      const pinPoint = fabric.util.transformPoint(
        new fabric.Point(pin.left || 0, pin.top || 0),
        pin.group?.calcTransformMatrix() || identityMatrix
      );
      return { x: pinPoint.x, y: pinPoint.y };
    },
    []
  );

  // Highlight pin when hovering
  const highlightPin = useCallback(
    (pin: fabric.Object) => {
      if (highlightedPin === pin) return;

      // Clear previous highlight
      if (highlightedPin) {
        const originalState = originalPinState.current.get(highlightedPin);
        if (originalState) {
          highlightedPin.set({
            strokeWidth: originalState.strokeWidth,
            fill: originalState.fill,
            radius: originalState.radius,
          });
          originalPinState.current.delete(highlightedPin);
        }
      }

      // Store original state
      if (!originalPinState.current.has(pin)) {
        originalPinState.current.set(pin, {
          strokeWidth: pin.strokeWidth,
          fill: pin.fill,
          radius: (pin as any).radius,
        });
      }

      // Apply highlight
      pin.set({
        strokeWidth: 3,
        fill: "rgba(0, 56, 223, 0.5)",
        radius: (originalPinState.current.get(pin)?.radius || 4) * 1.2,
      });

      setHighlightedPin(pin);

      if (canvas) {
        canvas.renderAll();
      }
    },
    [highlightedPin, canvas]
  );

  // Clear pin highlight
  const clearPinHighlight = useCallback(
    (pin: fabric.Object) => {
      const originalState = originalPinState.current.get(pin);
      if (originalState) {
        pin.set({
          strokeWidth: originalState.strokeWidth,
          fill: originalState.fill,
          radius: originalState.radius,
        });
        originalPinState.current.delete(pin);
      }

      if (canvas) {
        canvas.renderAll();
      }
    },
    [canvas]
  );

  // Calculate orthogonal next point based on cursor position
  const calculateOrthogonalPoint = useCallback(
    (lastPoint: WirePoint, currentPoint: WirePoint): WirePoint => {
      const deltaX = Math.abs(currentPoint.x - lastPoint.x);
      const deltaY = Math.abs(currentPoint.y - lastPoint.y);

      // Decide direction based on which delta is larger
      if (deltaX > deltaY) {
        // Horizontal line - fix Y coordinate
        return { x: currentPoint.x, y: lastPoint.y };
      } else {
        // Vertical line - fix X coordinate
        return { x: lastPoint.x, y: currentPoint.y };
      }
    },
    []
  );

  // Create or update ghost wire
  const updateGhostWire = useCallback(
    (points: WirePoint[]) => {
      if (!canvas) return;

      console.log("updateGhostWire called with points:", points);

      // Remove existing ghost wire
      if (wireDraft.ghostWire) {
        console.log("Removing existing ghost wire");
        canvas.remove(wireDraft.ghostWire);
      }

      // Create new ghost wire if we have at least 2 points
      if (points.length >= 2) {
        console.log("Creating new ghost wire with", points.length, "points");
        const fabricPoints = points.map((p) => new fabric.Point(p.x, p.y));

        const ghostWire = new fabric.Polyline(fabricPoints, {
          fill: "transparent",
          stroke: "#FF0000", // Bright red for debugging - will change to blue later
          strokeWidth: 3, // Thicker for debugging
          strokeDashArray: [8, 4], // More visible dashed line
          selectable: false,
          evented: false,
          opacity: 0.8, // More visible
          excludeFromExport: true, // Don't include in exports
        });

        console.log("Ghost wire created:", ghostWire);
        canvas.add(ghostWire);
        console.log("Ghost wire added to canvas");
        canvas.renderAll(); // Force canvas redraw
        console.log("Canvas renderAll() called - ghost wire should be visible");

        setWireDraft((prev) => ({ ...prev, ghostWire }));
      } else {
        console.log("Not enough points to create ghost wire, need at least 2, got:", points.length);
      }
    },
    [canvas, wireDraft.ghostWire]
  );

  // Complete the wire by creating final polyline
  const completeWire = useCallback(
    (endPin: fabric.Object) => {
      if (!canvas || !wireDraft.startPin) return;

      const endPoint = getPinWorldCoordinates(endPin);
      const allPoints = [
        getPinWorldCoordinates(wireDraft.startPin),
        ...wireDraft.waypoints,
        endPoint,
      ];

      // Remove ghost wire
      if (wireDraft.ghostWire) {
        canvas.remove(wireDraft.ghostWire);
      }

      // Generate unique wire ID
      const wireId = `wire_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create final wire as solid polyline with connection memory
      const fabricPoints = allPoints.map((p) => new fabric.Point(p.x, p.y));
      const finalWire = new fabric.Polyline(fabricPoints, {
        fill: "transparent",
        stroke: "#0038DF",
        strokeWidth: 2,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        selectable: true,
        evented: true,
        wireType: "connection",
        wireId: wireId,
        // Store pin connections for component movement tracking
        startPin: wireDraft.startPin,
        endPin: endPin,
        startComponent: wireDraft.startPin.group,
        endComponent: endPin.group,
        // Store original pin types for reconnection
        startPinType: (wireDraft.startPin as any).pinType,
        endPinType: (endPin as any).pinType,
        // Store waypoints for reconstruction
        originalWaypoints: [...wireDraft.waypoints],
      } as any);

      canvas.add(finalWire);
      
      // Register wire with components for tracking
      if (wireDraft.startPin.group) {
        const startGroup = wireDraft.startPin.group as any;
        if (!startGroup.connectedWires) startGroup.connectedWires = [];
        startGroup.connectedWires.push(wireId);
      }
      
      if (endPin.group) {
        const endGroup = endPin.group as any;
        if (!endGroup.connectedWires) endGroup.connectedWires = [];
        endGroup.connectedWires.push(wireId);
      }

      canvas.renderAll();

      // Clear highlighted pin
      if (highlightedPin) {
        const originalState = originalPinState.current.get(highlightedPin);
        if (originalState) {
          highlightedPin.set({
            strokeWidth: originalState.strokeWidth,
            fill: originalState.fill,
            radius: originalState.radius,
          });
          originalPinState.current.delete(highlightedPin);
        }
      }

      // Reset to idle state
      setWireState("idle");
      setWireDraft({
        startPin: null,
        waypoints: [],
        ghostWire: null,
      });
      setHighlightedPin(null);

      console.log("Wire completed successfully with ID:", wireId);
      console.log("Wire connected between components:", wireDraft.startPin.group, "and", endPin.group);
    },
    [
      canvas,
      wireDraft.startPin,
      wireDraft.waypoints,
      wireDraft.ghostWire,
      getPinWorldCoordinates,
      highlightedPin,
    ]
  );

  // Show/hide pins when entering/exiting wire mode
  useEffect(() => {
    if (!canvas) return;

    const objects = canvas.getObjects();

    objects.forEach((obj) => {
      if ((obj as any).componentType && obj.type === "group") {
        const group = obj as fabric.Group;
        const groupObjects = group.getObjects();

        groupObjects.forEach((groupObj) => {
          if ((groupObj as any).pin) {
            // Show pins in wire mode, hide otherwise
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

  // Component movement tracking - Update connected wires when components move
  useEffect(() => {
    if (!canvas) return;

    const updateConnectedWires = (movingComponent: fabric.Group) => {
      // Find all wires connected to this component
      const connectedWireIds = (movingComponent as any).connectedWires || [];
      
      if (connectedWireIds.length === 0) return;

      console.log("Updating", connectedWireIds.length, "wires connected to moving component");

      // Update each connected wire
      connectedWireIds.forEach((wireId: string) => {
        // Find the wire object on canvas
        const wire = canvas.getObjects().find(obj => (obj as any).wireId === wireId) as fabric.Polyline;
        
        if (!wire) {
          console.warn("Could not find wire with ID:", wireId);
          return;
        }

        const wireData = wire as any;
        
        // Get current pin positions
        const startPinCoords = wireData.startComponent === movingComponent 
          ? getPinWorldCoordinates(wireData.startPin)
          : wireData.startComponent 
            ? getPinWorldCoordinates(wireData.startPin)
            : { x: wire.points[0].x, y: wire.points[0].y };

        const endPinCoords = wireData.endComponent === movingComponent
          ? getPinWorldCoordinates(wireData.endPin)
          : wireData.endComponent
            ? getPinWorldCoordinates(wireData.endPin)
            : { x: wire.points[wire.points.length - 1].x, y: wire.points[wire.points.length - 1].y };

        // Reconstruct wire path with current pin positions and original waypoints
        const newPoints = [
          startPinCoords,
          ...(wireData.originalWaypoints || []),
          endPinCoords
        ];

        // Update wire geometry
        const fabricPoints = newPoints.map(p => new fabric.Point(p.x, p.y));
        wire.set({ points: fabricPoints });
        
        console.log("Updated wire", wireId, "with new points:", newPoints);
      });

      canvas.renderAll();
    };

    const handleObjectMoving = (e: any) => {
      const movingObject = e.target;
      
      // Only handle component groups
      if (movingObject && (movingObject as any).componentType && movingObject.type === "group") {
        updateConnectedWires(movingObject);
      }
    };

    const handleObjectMoved = (e: any) => {
      const movedObject = e.target;
      
      // Only handle component groups
      if (movedObject && (movedObject as any).componentType && movedObject.type === "group") {
        console.log("Component movement completed, final wire update");
        updateConnectedWires(movedObject);
      }
    };

    // Attach movement listeners
    canvas.on('object:moving', handleObjectMoving);
    canvas.on('object:modified', handleObjectMoved);

    return () => {
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('object:modified', handleObjectMoved);
    };
  }, [canvas, getPinWorldCoordinates]);

  // Main mouse event handlers for wire mode
  useEffect(() => {
    if (!canvas || !enabled || !isWireMode) return;

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
      if (pin && pin !== wireDraft.startPin) {
        highlightPin(pin);
        setWireState("finishing");
      } else {
        if (highlightedPin) {
          clearPinHighlight(highlightedPin);
          setHighlightedPin(null);
        }
        if (wireState === "finishing" && wireDraft.startPin) {
          setWireState("drawing");
        }
      }

      // Update ghost wire during drawing
      if (wireState === "drawing" && wireDraft.startPin) {
        const startPoint = getPinWorldCoordinates(wireDraft.startPin);
        const lastPoint =
          wireDraft.waypoints.length > 0
            ? wireDraft.waypoints[wireDraft.waypoints.length - 1]
            : startPoint;

        const orthogonalPoint = calculateOrthogonalPoint(lastPoint, {
          x: pointer.x,
          y: pointer.y,
        });

        const allPoints = [startPoint, ...wireDraft.waypoints, orthogonalPoint];

        updateGhostWire(allPoints);
      }
    };

    const handleMouseDown = (options: any) => {
      const pointer = canvas.getPointer(options.e);
      const currentPoint = new fabric.Point(pointer.x, pointer.y);
      const pin = findPinAtPoint(currentPoint);

      if (wireState === "idle" && pin) {
        // Start new wire
        console.log("Attempting to start a wire...");
        console.log("Pin found:", pin);
        console.log("Pin coordinates:", getPinWorldCoordinates(pin));
        setWireState("drawing");
        setWireDraft((prev) => ({
          ...prev,
          startPin: pin,
          waypoints: [],
          ghostWire: null,
        }));
        console.log("Started new wire from pin - state changed to drawing");
        console.log("Next mouse move will create ghost wire preview");
      } else if (wireState === "drawing") {
        if (pin && pin !== wireDraft.startPin) {
          // Complete wire at end pin
          completeWire(pin);
        } else {
          // Add waypoint
          const startPoint = getPinWorldCoordinates(wireDraft.startPin!);
          const lastPoint =
            wireDraft.waypoints.length > 0
              ? wireDraft.waypoints[wireDraft.waypoints.length - 1]
              : startPoint;

          const orthogonalPoint = calculateOrthogonalPoint(lastPoint, {
            x: pointer.x,
            y: pointer.y,
          });

          setWireDraft((prev) => ({
            ...prev,
            waypoints: [...prev.waypoints, orthogonalPoint],
          }));

          console.log("Added waypoint at", orthogonalPoint);
        }
      } else if (wireState === "finishing" && pin) {
        // Complete wire
        completeWire(pin);
      }
    };

    // Attach event listeners
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:down", handleMouseDown);

    return () => {
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
    wireState,
    wireDraft,
    highlightedPin,
    findPinAtPoint,
    highlightPin,
    clearPinHighlight,
    getPinWorldCoordinates,
    calculateOrthogonalPoint,
    updateGhostWire,
    completeWire,
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

      if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey) {
        // T key - Toggle Test Mode
        e.preventDefault();
        if (!isTestMode) {
          console.log("Entered Line Test Mode.");
          setIsTestMode(true);
          setTestModeState({
            isActive: true,
            firstClick: null,
          });
          // Exit wire mode if active
          if (isWireMode) {
            exitWireMode();
          }
        } else {
          console.log("Exited Line Test Mode.");
          setIsTestMode(false);
          setTestModeState({
            isActive: false,
            firstClick: null,
          });
        }
      } else if (e.key.toLowerCase() === "w" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Exit test mode if active
        if (isTestMode) {
          setIsTestMode(false);
          setTestModeState({
            isActive: false,
            firstClick: null,
          });
        }
        toggleWireMode();
      } else if (e.key === "Escape") {
        e.preventDefault();
        // Exit test mode
        if (isTestMode) {
          console.log("Exited Line Test Mode.");
          setIsTestMode(false);
          setTestModeState({
            isActive: false,
            firstClick: null,
          });
        } else if (wireState === "drawing") {
          // Cancel current wire
          if (wireDraft.ghostWire && canvas) {
            canvas.remove(wireDraft.ghostWire);
            canvas.renderAll();
          }
          setWireState("idle");
          setWireDraft({
            startPin: null,
            waypoints: [],
            ghostWire: null,
          });
        } else {
          exitWireMode();
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (isWireMode && wireState === "drawing") {
        e.preventDefault();
        // Cancel wire on right-click
        if (wireDraft.ghostWire && canvas) {
          canvas.remove(wireDraft.ghostWire);
          canvas.renderAll();
        }
        setWireState("idle");
        setWireDraft({
          startPin: null,
          waypoints: [],
          ghostWire: null,
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [
    enabled,
    toggleWireMode,
    exitWireMode,
    wireState,
    wireDraft,
    canvas,
    isWireMode,
    isTestMode,
  ]);

  // Simple Line Test Mode mouse handler - completely separate from wire tool
  useEffect(() => {
    if (!canvas || !enabled || !isTestMode) return;

    const handleTestModeClick = (options: any) => {
      const pointer = canvas.getPointer(options.e);
      
      if (!testModeState.firstClick) {
        // First click - just save coordinates
        console.log("First click at:", pointer.x, pointer.y);
        setTestModeState({
          isActive: true,
          firstClick: { x: pointer.x, y: pointer.y },
        });
      } else {
        // Second click - draw line and exit test mode
        console.log("Second click at:", pointer.x, pointer.y);
        
        // Create simple red line
        const line = new fabric.Line([
          testModeState.firstClick.x,
          testModeState.firstClick.y,
          pointer.x,
          pointer.y
        ], {
          stroke: 'red',
          strokeWidth: 5,
          selectable: true,
          evented: true,
        });
        
        // Add to canvas and force render
        canvas.add(line);
        canvas.renderAll();
        
        console.log("Red line drawn! Test mode complete.");
        
        // Exit test mode
        setIsTestMode(false);
        setTestModeState({
          isActive: false,
          firstClick: null,
        });
      }
    };

    // Only attach test mode click handler
    canvas.on("mouse:down", handleTestModeClick);

    return () => {
      canvas.off("mouse:down", handleTestModeClick);
    };
  }, [canvas, enabled, isTestMode, testModeState]);

  return {
    wireState,
    isWireMode,
    toggleWireMode,
    exitWireMode,
    // Test mode properties
    isTestMode,
    testModeState,
  };
}
