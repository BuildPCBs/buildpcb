"use client";

import { useState, useEffect, useCallback } from "react";
import Konva from "konva";

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
  canvas: Konva.Stage | null;
  enableLiveUpdates?: boolean;
}

export function useCanvasState({
  canvas,
  enableLiveUpdates = true,
}: UseCanvasStateProps) {
  const [canvasState, setCanvasState] = useState<CanvasState | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Extract components from Konva stage
  const extractComponents = useCallback(
    (stage: Konva.Stage): ComponentData[] => {
      if (!stage) return [];

      const components: ComponentData[] = [];
      const layer = stage.getLayers()[0];

      if (!layer) return [];

      // Iterate through direct children of layer (Groups usually)
      layer.getChildren().forEach((node) => {
        // Look for groups with componentId in data
        const data = (node as any).data;
        if (data && data.componentId) {
          const group = node as Konva.Group;

          components.push({
            id: data.componentId,
            type: data.componentType || "unknown",
            position: {
              x: group.x(),
              y: group.y(),
            },
            rotation: group.rotation(),
            properties: {
              width: group.width(),
              height: group.height(),
              scaleX: group.scaleX(),
              scaleY: group.scaleY(),
              visible: group.visible(),
              ...data,
            },
            connections: data.connections || [],
          });
        }
      });

      return components;
    },
    []
  );

  // Extract connections/wires from Konva stage
  const extractConnections = useCallback(
    (stage: Konva.Stage): ConnectionData[] => {
      if (!stage) return [];

      // TODO: Implement wire extractions based on how wires are rendered in Konva
      // Currently assuming wires might be Lines stored in a specific way or data structure
      // For now, returning empty array as placeholder until wire structure is confirmed
      return [];
    },
    []
  );

  // Extract canvas metadata
  const extractMetadata = useCallback((stage: Konva.Stage): CanvasMetadata => {
    if (!stage) {
      return {
        zoom: 1,
        viewportTransform: [1, 0, 0, 1, 0, 0],
        selectedObjects: [],
        canvasSize: { width: 0, height: 0 },
        timestamp: Date.now(),
      };
    }

    return {
      zoom: stage.scaleX(),
      viewportTransform: [
        stage.scaleX(),
        0,
        0,
        stage.scaleY(),
        stage.x(),
        stage.y(),
      ],
      selectedObjects: [], // TODO: Get from CanvasContext or internal logic
      canvasSize: {
        width: stage.width(),
        height: stage.height(),
      },
      timestamp: Date.now(),
    };
  }, []);

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

    // Set up event listeners
    canvas.on("dragend transformend", handleCanvasChange);
    // You might need more events depending on what changes state (e.g. node additions)
    // Konva doesn't have a generic "object modified" event for everything, usually

    return () => {
      canvas.off("dragend transformend", handleCanvasChange);
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
    // Raw Konva stage
    fabricCanvas: canvas as any, // keeping the property name for compatibility but typing as any/Konva
  };
}

// Convenience hook for when you just need the state
export function useCanvasStateSnapshot(
  canvas: Konva.Stage | null
): CanvasState | null {
  const { canvasState } = useCanvasState({ canvas, enableLiveUpdates: false });
  return canvasState;
}
