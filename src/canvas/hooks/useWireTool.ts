/**
 * Wire Drawing Tool Hook
 * Handles wire mode activation, pin detection, and line drawing between component pins
 */

import { useEffect, useState, useCallback } from "react";
import * as fabric from "fabric";

interface WireToolState {
  isWireMode: boolean;
  isDrawing: boolean;
  currentWire: fabric.Line | null;
  startPin: fabric.Object | null;
}

interface UseWireToolProps {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
}

interface UseWireToolReturn {
  isWireMode: boolean;
  isDrawing: boolean;
  toggleWireMode: () => void;
  exitWireMode: () => void;
}

export function useWireTool({
  canvas,
  enabled = true,
}: UseWireToolProps): UseWireToolReturn {
  const [wireState, setWireState] = useState<WireToolState>({
    isWireMode: false,
    isDrawing: false,
    currentWire: null,
    startPin: null,
  });

  // Toggle wire drawing mode
  const toggleWireMode = useCallback(() => {
    setWireState((prev) => ({
      ...prev,
      isWireMode: !prev.isWireMode,
      isDrawing: false,
      currentWire: null,
      startPin: null,
    }));
  }, []);

  // Exit wire mode
  const exitWireMode = useCallback(() => {
    if (wireState.currentWire && canvas) {
      canvas.remove(wireState.currentWire);
      canvas.renderAll();
    }

    setWireState({
      isWireMode: false,
      isDrawing: false,
      currentWire: null,
      startPin: null,
    });
  }, [canvas, wireState.currentWire]);

  // Find pin at coordinates
  const findPinAtPoint = useCallback(
    (pointer: fabric.Point): fabric.Object | null => {
      if (!canvas) return null;

      const objects = canvas.getObjects();

      for (const obj of objects) {
        if ((obj as any).componentType && obj.type === "group") {
          // Check if this is a component group
          const group = obj as fabric.Group;
          const groupObjects = group.getObjects();

          for (const groupObj of groupObjects) {
            if ((groupObj as any).pin) {
              // Convert group-relative coordinates to canvas coordinates
              const pinPoint = fabric.util.transformPoint(
                new fabric.Point(groupObj.left || 0, groupObj.top || 0),
                group.calcTransformMatrix()
              );

              const distance = pointer.distanceFrom(pinPoint);
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
              strokeWidth: wireState.isWireMode ? 2 : 0,
              fill: wireState.isWireMode
                ? "rgba(0, 56, 223, 0.3)"
                : "transparent",
            });
          }
        });
      }
    });

    canvas.renderAll();
  }, [canvas, wireState.isWireMode]);

  // Handle mouse events for wire drawing
  useEffect(() => {
    if (!canvas || !enabled || !wireState.isWireMode) return;

    // Disable object selection in wire mode
    canvas.selection = false;
    canvas.defaultCursor = "crosshair";

    // Make all non-pin objects non-selectable in wire mode
    canvas.forEachObject((obj) => {
      if (!(obj as any).pin && (obj as any).name !== "workspace") {
        obj.selectable = false;
        obj.evented = false;
      }
    });

    const handleMouseDown = (options: any) => {
      const pointer = canvas.getPointer(options.e);
      const pin = findPinAtPoint(new fabric.Point(pointer.x, pointer.y));

      if (!wireState.isDrawing && pin) {
        // Start drawing a wire from this pin
        const identityMatrix = [1, 0, 0, 1, 0, 0] as fabric.TMat2D;
        const pinWorldPos = fabric.util.transformPoint(
          new fabric.Point(pin.left || 0, pin.top || 0),
          pin.group?.calcTransformMatrix() || identityMatrix
        );

        const newWire = new fabric.Line(
          [pinWorldPos.x, pinWorldPos.y, pinWorldPos.x, pinWorldPos.y],
          {
            stroke: "#0038DF",
            strokeWidth: 2,
            selectable: false,
            evented: false,
            strokeLineCap: "round",
            wireType: "connection", // Identify as wire
          } as any
        );

        canvas.add(newWire);
        canvas.renderAll();

        setWireState((prev) => ({
          ...prev,
          isDrawing: true,
          currentWire: newWire,
          startPin: pin,
        }));
      } else if (wireState.isDrawing && pin && pin !== wireState.startPin) {
        // End the wire at this pin
        if (wireState.currentWire) {
          const identityMatrix = [1, 0, 0, 1, 0, 0] as fabric.TMat2D;
          const pinWorldPos = fabric.util.transformPoint(
            new fabric.Point(pin.left || 0, pin.top || 0),
            pin.group?.calcTransformMatrix() || identityMatrix
          );

          wireState.currentWire.set({
            x2: pinWorldPos.x,
            y2: pinWorldPos.y,
          });

          canvas.renderAll();

          // Reset drawing state
          setWireState((prev) => ({
            ...prev,
            isDrawing: false,
            currentWire: null,
            startPin: null,
          }));
        }
      }
    };

    const handleMouseMove = (options: any) => {
      if (wireState.isDrawing && wireState.currentWire) {
        const pointer = canvas.getPointer(options.e);

        wireState.currentWire.set({
          x2: pointer.x,
          y2: pointer.y,
        });

        canvas.renderAll();
      }
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);

    return () => {
      // Restore canvas state when exiting wire mode
      canvas.selection = true;
      canvas.defaultCursor = "default";

      // Restore object selectability
      canvas.forEachObject((obj) => {
        if ((obj as any).componentType) {
          obj.selectable = true;
          obj.evented = true;
        }
      });

      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
    };
  }, [canvas, enabled, wireState, findPinAtPoint]);

  // Handle keyboard shortcuts
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
        exitWireMode();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, toggleWireMode, exitWireMode]);

  return {
    isWireMode: wireState.isWireMode,
    isDrawing: wireState.isDrawing,
    toggleWireMode,
    exitWireMode,
  };
}
