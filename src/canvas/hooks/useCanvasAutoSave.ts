"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import * as fabric from "fabric";
import { useProjectStore } from "@/store/projectStore";
import { useAutoSave } from "@/hooks/useDatabase";
import {
  serializeCanvasToCircuit,
  serializeCanvasData,
} from "@/canvas/utils/canvasSerializer";

interface UseCanvasAutoSaveOptions {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
  interval?: number; // milliseconds
}

/**
 * Hook for automatically saving canvas changes to the database
 * Integrates with project store and database auto-save
 */
export function useCanvasAutoSave({
  canvas,
  enabled = true,
  interval = 30000, // 30 seconds
}: UseCanvasAutoSaveOptions) {
  const {
    projectId,
    versionId,
    autoSaveEnabled,
    autoSaveInterval,
    isDirty,
    markDirty,
    markClean,
  } = useProjectStore();

  const lastCanvasState = useRef<string>("");
  const changeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Create circuit and canvas data from current canvas state
  const getCurrentCanvasData = useCallback(async () => {
    if (!canvas) return { circuit: null, canvasData: {} };

    // Use the same canvas data extraction as manual save
    const { serializeCanvasData } = await import(
      "@/canvas/utils/canvasSerializer"
    );
    const canvasData = serializeCanvasData(canvas);
    const circuit = serializeCanvasToCircuit(canvas);

    return { circuit, canvasData };
  }, [canvas]);

  // Use the database auto-save hook with longer interval
  const [currentData, setCurrentData] = useState<{
    circuit: any;
    canvasData: any;
  }>({
    circuit: null,
    canvasData: {},
  });

  // Update current data when canvas changes
  useEffect(() => {
    if (canvas) {
      getCurrentCanvasData().then(setCurrentData);
    }
  }, [canvas, getCurrentCanvasData]);

  const autoSave = useAutoSave(
    projectId,
    currentData.circuit,
    currentData.canvasData,
    autoSaveEnabled ? Math.max(autoSaveInterval, 60000) : undefined // Minimum 60 seconds
  );

  // Track canvas changes and mark project as dirty
  const handleCanvasChange = useCallback(() => {
    if (!canvas || !projectId) return;

    // Debounce change detection to avoid excessive updates
    if (changeTimeout.current) {
      clearTimeout(changeTimeout.current);
    }

    changeTimeout.current = setTimeout(() => {
      try {
        const currentState = JSON.stringify(canvas.toJSON());

        if (currentState !== lastCanvasState.current) {
          console.log("🎨 Canvas changed, marking project as dirty");
          lastCanvasState.current = currentState;
          markDirty();
        }
      } catch (error) {
        console.error(
          "Failed to serialize canvas for change detection:",
          error
        );
      }
    }, 500); // 500ms debounce
  }, [canvas, projectId, markDirty]);

  // Set up canvas event listeners for change detection
  useEffect(() => {
    if (!canvas || !enabled || !autoSaveEnabled) return;

    console.log("🔄 Setting up canvas auto-save listeners");

    // Canvas modification events with proper typing
    canvas.on("object:added", handleCanvasChange);
    canvas.on("object:removed", handleCanvasChange);
    canvas.on("object:modified", handleCanvasChange);
    canvas.on("object:moving", handleCanvasChange);
    canvas.on("object:scaling", handleCanvasChange);
    canvas.on("object:rotating", handleCanvasChange);
    canvas.on("path:created", handleCanvasChange);

    // Initialize last state
    try {
      lastCanvasState.current = JSON.stringify(canvas.toJSON());
    } catch (error) {
      console.error("Failed to initialize canvas state:", error);
    }

    return () => {
      canvas.off("object:added", handleCanvasChange);
      canvas.off("object:removed", handleCanvasChange);
      canvas.off("object:modified", handleCanvasChange);
      canvas.off("object:moving", handleCanvasChange);
      canvas.off("object:scaling", handleCanvasChange);
      canvas.off("object:rotating", handleCanvasChange);
      canvas.off("path:created", handleCanvasChange);

      if (changeTimeout.current) {
        clearTimeout(changeTimeout.current);
      }
    };
  }, [canvas, enabled, autoSaveEnabled, handleCanvasChange]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (!projectId || !canvas) {
      console.warn("Cannot save: missing project or canvas");
      return;
    }

    try {
      console.log("💾 Manual save triggered");
      await autoSave.saveNow();
      markClean();
      console.log("✅ Manual save completed");
    } catch (error) {
      console.error("❌ Manual save failed:", error);
    }
  }, [projectId, canvas, autoSave, markClean]);

  // Listen for auto-save completion to mark clean
  useEffect(() => {
    if (autoSave.lastSaved && isDirty) {
      console.log("✅ Auto-save completed, marking clean");
      markClean();
    }
  }, [autoSave.lastSaved, isDirty, markClean]);

  return {
    // Auto-save status
    lastSaved: autoSave.lastSaved,
    saving: autoSave.saving,
    error: autoSave.error,
    isDirty,

    // Manual controls
    saveNow,

    // Current data (for debugging)
    getCurrentCanvasData,
  };
}
