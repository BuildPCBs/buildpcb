"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import * as fabric from "fabric";
import { useProjectStore } from "@/store/projectStore";
import { useAutoSave } from "@/hooks/useDatabase";
import {
  serializeCanvasToLogicalCircuit,
  loadCanvasFromLogicalCircuit,
} from "@/canvas/utils/logicalSerializer";
import { serializeCanvasToCircuit } from "@/canvas/utils/canvasSerializer";
import { useAIChat } from "@/contexts/AIChatContext";

interface UseCanvasAutoSaveOptions {
  canvas: fabric.Canvas | null;
  netlist?: any[];
  enabled?: boolean;
  interval?: number; // milliseconds
}

/**
 * Hook for automatically saving canvas changes to the database
 * Integrates with project store and database auto-save
 */
export function useCanvasAutoSave({
  canvas,
  netlist = [],
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

  // Get chat messages for auto-save
  const { messages } = useAIChat();

  const lastCanvasState = useRef<string>("");
  const changeTimeout = useRef<NodeJS.Timeout | null>(null);
  const dataUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create circuit and canvas data from current canvas state
  const getCurrentCanvasData = useCallback(async () => {
    if (!canvas) return { circuit: null, canvasData: {} };

    // Use the same canvas data extraction as manual save
    const { serializeCanvasData, serializeCanvasToCircuit } = await import(
      "@/canvas/utils/canvasSerializer"
    );
    const canvasData = serializeCanvasData(canvas, netlist);
    const circuit = serializeCanvasToCircuit(canvas);

    return { circuit, canvasData };
  }, [canvas, netlist]);

  // Use the database auto-save hook with longer interval
  const [currentData, setCurrentData] = useState<{
    circuit: any;
    canvasData: any;
    chatData: any;
  }>({
    circuit: null,
    canvasData: {},
    chatData: null,
  });

  // Update current data when canvas or chat changes (with throttling)
  useEffect(() => {
    if (canvas) {
      // Throttle data updates to avoid excessive serialization
      if (dataUpdateTimeoutRef.current) {
        clearTimeout(dataUpdateTimeoutRef.current);
      }
      
      dataUpdateTimeoutRef.current = setTimeout(() => {
        getCurrentCanvasData().then((data) => {
          // Include chat data in the canvas data for auto-save
          const chatData =
            messages.length > 0
              ? {
                  messages: messages.map((msg) => ({
                    ...msg,
                    timestamp:
                      msg.timestamp instanceof Date
                        ? msg.timestamp.toISOString()
                        : msg.timestamp,
                  })),
                }
              : null;
          const extendedCanvasData = {
            ...data.canvasData,
            chatData: chatData,
          };

          setCurrentData({
            circuit: data.circuit,
            canvasData: extendedCanvasData,
            chatData: chatData,
          });
        });
      }, 2000); // Throttle data updates to every 2 seconds
    }

    return () => {
      if (dataUpdateTimeoutRef.current) {
        clearTimeout(dataUpdateTimeoutRef.current);
      }
    };
  }, [canvas, getCurrentCanvasData, messages]);

  const autoSave = useAutoSave(
    projectId,
    currentData.circuit,
    currentData.canvasData,
    autoSaveEnabled ? Math.max(autoSaveInterval, 60000) : undefined // Minimum 60 seconds
  );

  // Track canvas changes and mark project as dirty
  const handleCanvasChange = useCallback(() => {
    if (!canvas || !projectId) return;

    // Debounce change detection to avoid excessive updates during continuous operations
    if (changeTimeout.current) {
      clearTimeout(changeTimeout.current);
    }

    changeTimeout.current = setTimeout(() => {
      try {
        // Use a lighter fingerprint instead of full serialization for change detection
        const objects = canvas.getObjects();
        const fingerprint = JSON.stringify({
          objectCount: objects.length,
          objectTypes: objects.map(obj => obj.type),
          positions: objects.map(obj => ({ left: obj.left, top: obj.top })),
          lastModified: Date.now()
        });

        if (fingerprint !== lastCanvasState.current) {
          console.log("🎨 Canvas changed, marking project as dirty");
          lastCanvasState.current = fingerprint;
          markDirty();
        }
      } catch (error) {
        console.error(
          "Failed to create canvas fingerprint for change detection:",
          error
        );
      }
    }, 1000); // Increased debounce to 1 second for better performance
  }, [canvas, projectId, markDirty]);

  // Track chat message changes and mark project as dirty (with throttling)
  const lastMessageCountRef = useRef(0);
  useEffect(() => {
    // Only mark dirty if we actually have new messages (not just state updates)
    if (messages.length > lastMessageCountRef.current && projectId) {
      console.log("💬 New chat messages added, marking project as dirty", {
        messageCount: messages.length,
        previousCount: lastMessageCountRef.current,
        projectId,
      });
      lastMessageCountRef.current = messages.length;
      markDirty();
    }
  }, [messages.length, projectId, markDirty]);

  // Set up canvas event listeners for change detection
  useEffect(() => {
    if (!canvas || !enabled || !autoSaveEnabled) return;

    console.log("🔄 Setting up canvas auto-save listeners");

    // Only listen to significant events that actually change the circuit
    canvas.on("object:added", handleCanvasChange);
    canvas.on("object:removed", handleCanvasChange);
    canvas.on("object:modified", handleCanvasChange);
    // Remove object:moving to avoid excessive triggers during drag
    canvas.on("object:scaling", handleCanvasChange);
    canvas.on("object:rotating", handleCanvasChange);
    canvas.on("path:created", handleCanvasChange);

    // Initialize last state with lightweight fingerprint
    try {
      const objects = canvas.getObjects();
      lastCanvasState.current = JSON.stringify({
        objectCount: objects.length,
        objectTypes: objects.map(obj => obj.type),
        positions: objects.map(obj => ({ left: obj.left, top: obj.top }))
      });
    } catch (error) {
      console.error("Failed to initialize canvas state:", error);
    }

    return () => {
      canvas.off("object:added", handleCanvasChange);
      canvas.off("object:removed", handleCanvasChange);
      canvas.off("object:modified", handleCanvasChange);
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
      // Get fresh canvas data with current chat data
      const data = await getCurrentCanvasData();
      const chatData =
        messages.length > 0
          ? {
              messages: messages.map((msg) => ({
                ...msg,
                timestamp:
                  msg.timestamp instanceof Date
                    ? msg.timestamp.toISOString()
                    : msg.timestamp,
              })),
            }
          : null;
      const extendedCanvasData = {
        ...data.canvasData,
        chatData: chatData,
      };

      // Update the current data state for auto-save consistency
      setCurrentData({
        circuit: data.circuit,
        canvasData: extendedCanvasData,
        chatData: chatData,
      });

      await autoSave.saveNow();
      markClean();
      console.log("✅ Manual save completed");
    } catch (error) {
      console.error("❌ Manual save failed:", error);
    }
  }, [projectId, canvas, autoSave, markClean, getCurrentCanvasData, messages]);

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
