"use client";

import { useState, useEffect, useCallback } from "react";
import * as fabric from "fabric";

export interface ComponentData {
  id: string;
  type: string;
  position: { x: number; y: number };
  rotation: number;
  properties: Record<string, any>;
  connections?: string[];
}

export interface ConnectionData {
  id: string;
  type: "wire";
  from: { componentId: string; pin: string };
  to: { componentId: string; pin: string };
  path: { x: number; y: number }[];
}

export interface CanvasMetadata {
  zoom: number;
  viewportTransform: number[];
  selectedObjects: string[];
  canvasSize: { width: number; height: number };
  timestamp: number;
}

export interface CanvasState {
  components: ComponentData[];
  connections: ConnectionData[];
  metadata: CanvasMetadata;
}

interface UseCanvasStateProps {
  canvas: fabric.Canvas | null;
  enableLiveUpdates?: boolean;
}

export function useCanvasState({
  canvas,
  enableLiveUpdates = true,
}: UseCanvasStateProps) {
  const [canvasState, setCanvasState] = useState<CanvasState | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Extract components from fabric objects
  const extractComponents = useCallback(
    (fabricCanvas: fabric.Canvas): ComponentData[] => {
      if (!fabricCanvas) return [];

      return fabricCanvas
        .getObjects()
        .filter((obj) => obj.type === "component" || obj.get("isComponent"))
        .map((obj) => ({
          id:
            obj.get("id") ||
            obj.get("objectId") ||
            `obj_${Date.now()}_${Math.random()}`,
          type: obj.get("componentType") || obj.get("objectType") || "unknown",
          position: {
            x: obj.left || 0,
            y: obj.top || 0,
          },
          rotation: obj.angle || 0,
          properties: {
            width: obj.width,
            height: obj.height,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            visible: obj.visible,
            ...obj.get("componentProperties"),
            ...obj.get("customProperties"),
          },
          connections: obj.get("connections") || [],
        }));
    },
    []
  );

  // Extract connections/wires from fabric objects
  const extractConnections = useCallback(
    (fabricCanvas: fabric.Canvas): ConnectionData[] => {
      if (!fabricCanvas) return [];

      return fabricCanvas
        .getObjects()
        .filter(
          (obj) =>
            obj.type === "wire" ||
            obj.get("isWire") ||
            obj.get("objectType") === "wire"
        )
        .map((obj) => ({
          id:
            obj.get("id") ||
            obj.get("objectId") ||
            `wire_${Date.now()}_${Math.random()}`,
          type: "wire",
          from: obj.get("fromConnection") || { componentId: "", pin: "" },
          to: obj.get("toConnection") || { componentId: "", pin: "" },
          path: obj.get("path") || [],
        }));
    },
    []
  );

  // Extract canvas metadata
  const extractMetadata = useCallback(
    (fabricCanvas: fabric.Canvas): CanvasMetadata => {
      if (!fabricCanvas) {
        return {
          zoom: 1,
          viewportTransform: [1, 0, 0, 1, 0, 0],
          selectedObjects: [],
          canvasSize: { width: 0, height: 0 },
          timestamp: Date.now(),
        };
      }

      const activeObjects = fabricCanvas.getActiveObjects();

      return {
        zoom: fabricCanvas.getZoom(),
        viewportTransform: fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0],
        selectedObjects: activeObjects.map(
          (obj) => obj.get("id") || obj.get("objectId") || ""
        ),
        canvasSize: {
          width: fabricCanvas.width || 0,
          height: fabricCanvas.height || 0,
        },
        timestamp: Date.now(),
      };
    },
    []
  );

  // Get current canvas state
  const getCurrentState = useCallback((): CanvasState | null => {
    if (!canvas) return null;

    try {
      const components = extractComponents(canvas);
      const connections = extractConnections(canvas);
      const metadata = extractMetadata(canvas);

      return {
        components,
        connections,
        metadata,
      };
    } catch (error) {
      console.error("Error extracting canvas state:", error);
      return null;
    }
  }, [canvas, extractComponents, extractConnections, extractMetadata]);

  // Update canvas state
  const updateCanvasState = useCallback(() => {
    const newState = getCurrentState();
    setCanvasState(newState);
    setLastUpdateTime(Date.now());
  }, [getCurrentState]);

  // Set up live updates
  useEffect(() => {
    if (!canvas || !enableLiveUpdates) return;

    // Initial state capture
    updateCanvasState();

    // Listen to canvas events that should trigger state updates
    const handleCanvasChange = () => {
      // Debounce rapid changes
      setTimeout(updateCanvasState, 100);
    };

    // Set up event listeners with proper typing
    canvas.on("object:added", handleCanvasChange);
    canvas.on("object:removed", handleCanvasChange);
    canvas.on("object:modified", handleCanvasChange);
    canvas.on("object:moving", handleCanvasChange);
    canvas.on("object:scaling", handleCanvasChange);
    canvas.on("object:rotating", handleCanvasChange);
    canvas.on("selection:created", handleCanvasChange);
    canvas.on("selection:updated", handleCanvasChange);
    canvas.on("selection:cleared", handleCanvasChange);

    return () => {
      canvas.off("object:added", handleCanvasChange);
      canvas.off("object:removed", handleCanvasChange);
      canvas.off("object:modified", handleCanvasChange);
      canvas.off("object:moving", handleCanvasChange);
      canvas.off("object:scaling", handleCanvasChange);
      canvas.off("object:rotating", handleCanvasChange);
      canvas.off("selection:created", handleCanvasChange);
      canvas.off("selection:updated", handleCanvasChange);
      canvas.off("selection:cleared", handleCanvasChange);
    };
  }, [canvas, enableLiveUpdates, updateCanvasState]);

  // Return state and utility functions
  return {
    canvasState,
    lastUpdateTime,
    updateCanvasState,
    getCurrentState,
    // Utility functions for external use
    extractComponents: () => (canvas ? extractComponents(canvas) : []),
    extractConnections: () => (canvas ? extractConnections(canvas) : []),
    extractMetadata: () => (canvas ? extractMetadata(canvas) : null),
    // Raw fabric canvas for advanced use cases
    fabricCanvas: canvas,
  };
}

// Convenience hook for when you just need the state
export function useCanvasStateSnapshot(
  canvas: fabric.Canvas | null
): CanvasState | null {
  const { canvasState } = useCanvasState({ canvas, enableLiveUpdates: false });
  return canvasState;
}
