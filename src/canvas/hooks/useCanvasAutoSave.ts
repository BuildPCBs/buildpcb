"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import * as fabric from "fabric";
import { useProjectStore } from "@/store/projectStore";
import { useAutoSave } from "@/hooks/useDatabase";
import { DatabaseService } from "@/lib/database";
import {
  serializeCanvasToLogicalCircuit,
  loadCanvasFromLogicalCircuit,
} from "@/canvas/utils/logicalSerializer";
import { serializeCanvasToCircuit } from "@/canvas/utils/canvasSerializer";
import { useAIChat } from "@/contexts/AIChatContext";
import { useProject } from "@/contexts/ProjectContext";
import { logger } from "@/lib/logger";
import { refDesService } from "@/lib/refdes-service";
import { updateProjectThumbnail } from "@/lib/thumbnail-generator";

interface UseCanvasAutoSaveOptions {
  canvas: fabric.Canvas | null;
  netlist?: any[] | (() => any[]);
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

  // Also get project context as fallback
  const { currentProject } = useProject();

  // Get chat messages for auto-save
  const { messages } = useAIChat();

  const lastCanvasState = useRef<string>("");
  const changeTimeout = useRef<NodeJS.Timeout | null>(null);
  const dataUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get current netlist
  const getCurrentNetlist = useCallback(() => {
    const currentNetlist = typeof netlist === "function" ? netlist() : netlist;
    logger.canvas("getCurrentNetlist called", {
      isFunction: typeof netlist === "function",
      netCount: currentNetlist.length,
      totalConnections: currentNetlist.reduce(
        (sum: number, net: any) => sum + (net.connections?.length || 0),
        0
      ),
    });
    return currentNetlist;
  }, [netlist]);

  // Create circuit and canvas data from current canvas state
  const getCurrentCanvasData = useCallback(async () => {
    if (!canvas) return { circuit: null, canvasData: {} };

    // Use the same canvas data extraction as manual save
    const { serializeCanvasData, serializeCanvasToCircuit } = await import(
      "@/canvas/utils/canvasSerializer"
    );
    const canvasData = serializeCanvasData(canvas, getCurrentNetlist());
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

          // Include RefDes assignments for persistence
          const refDesAssignments = refDesService.getAll();

          // IMPORTANT: Preserve netlist from serializeCanvasData
          const extendedCanvasData = {
            ...data.canvasData, // This already contains netlist from serializeCanvasData
            chatData: chatData,
            refDesAssignments:
              refDesAssignments.length > 0 ? refDesAssignments : null,
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

  // Disabled useAutoSave hook to prevent race conditions with manual saves
  // const autoSave = useAutoSave(
  //   projectId,
  //   currentData.circuit,
  //   currentData.canvasData,
  //   autoSaveEnabled ? Math.max(autoSaveInterval, 60000) : undefined // Minimum 60 seconds
  // );

  // Create a dummy autoSave object for compatibility
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoSave = {
    lastSaved,
    saving,
    error,
    saveNow: async () => {
      console.log("💾 Auto-save disabled - using manual save mechanism only");
    },
  };

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
          objectTypes: objects.map((obj) => obj.type),
          positions: objects.map((obj) => ({ left: obj.left, top: obj.top })),
          lastModified: Date.now(),
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
        objectTypes: objects.map((obj) => obj.type),
        positions: objects.map((obj) => ({ left: obj.left, top: obj.top })),
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
  const saveNow = useCallback(
    async (overrideMessages?: any[]) => {
      // Prevent concurrent saves
      if (saving) {
        console.log("⏸️ Save already in progress, skipping duplicate request");
        return;
      }

      // Get the latest project store state to ensure we have current projectId
      const currentStore = useProjectStore.getState();
      const currentProjectId =
        projectId || currentStore.projectId || currentProject?.id;

      // Use override messages if provided, otherwise use messages from context
      const messagesToSave = overrideMessages || messages;

      console.log("💾 Manual save triggered - checking conditions:", {
        hasProjectId: !!currentProjectId,
        projectId: currentProjectId,
        hasCanvas: !!canvas,
        canvasObjectCount: canvas?.getObjects().length,
        autoSaveEnabled,
        enabled,
        storeProjectId: currentStore.projectId,
        hookProjectId: projectId,
        contextProjectId: currentProject?.id,
        messageCount: messagesToSave.length,
        hasOverrideMessages: !!overrideMessages,
      });

      if (!currentProjectId) {
        const errorMessage =
          "Cannot save: missing projectId - check if project is properly loaded";
        console.warn("❌", errorMessage);
        console.warn(
          "💡 Make sure you have opened/created a project before trying to save"
        );
        throw new Error(errorMessage);
      }

      if (!canvas) {
        const errorMessage =
          "Cannot save: missing canvas - check if canvas is properly initialized";
        console.warn("❌", errorMessage);
        throw new Error(errorMessage);
      }

      try {
        setSaving(true);
        setError(null);
        console.log(
          "💾 Manual save proceeding with projectId:",
          currentProjectId
        );

        // Get fresh canvas data immediately for manual save
        const data = await getCurrentCanvasData();

        console.log("💬 Preparing chat data for save:", {
          messageCount: messagesToSave.length,
          messagesArray: messagesToSave,
          firstMessage: messagesToSave[0]
            ? {
                id: messagesToSave[0].id,
                type: messagesToSave[0].type,
                contentLength: messagesToSave[0].content?.length || 0,
                hasTimestamp: !!messagesToSave[0].timestamp,
              }
            : null,
        });

        const chatData =
          messagesToSave.length > 0
            ? {
                messages: messagesToSave.map((msg) => ({
                  ...msg,
                  timestamp:
                    msg.timestamp instanceof Date
                      ? msg.timestamp.toISOString()
                      : msg.timestamp,
                })),
              }
            : null;

        // Include RefDes assignments for persistence
        const refDesAssignments = refDesService.getAll();

        const extendedCanvasData = {
          ...data.canvasData,
          chatData: chatData,
          refDesAssignments:
            refDesAssignments.length > 0 ? refDesAssignments : null,
        };

        // Update the current data state for consistency
        setCurrentData({
          circuit: data.circuit,
          canvasData: extendedCanvasData,
          chatData: chatData,
        });

        // Ensure we have valid circuit data with all required fields
        const circuitData = {
          mode: (data.circuit?.mode || "full") as "full" | "edit",
          components: data.circuit?.components || [],
          connections: data.circuit?.connections || [],
          description: data.circuit?.description || "",
        };

        console.log("💾 Calling DatabaseService directly with fresh data", {
          projectId: currentProjectId,
          componentCount: circuitData.components.length,
          connectionCount: circuitData.connections.length,
          netlistNets: getCurrentNetlist().length,
          netlistConnections: getCurrentNetlist().reduce(
            (sum: number, net: any) => sum + (net.connections?.length || 0),
            0
          ),
          hasChatData: !!chatData,
          chatMessageCount: chatData?.messages?.length || 0,
          extendedCanvasDataHasChatData: !!extendedCanvasData.chatData,
          extendedCanvasDataKeys: Object.keys(extendedCanvasData),
        });

        const saveStartTime = Date.now();
        
        console.log("💾 Manual save START - Call stack:", {
          timestamp: new Date().toISOString(),
          projectId: currentProjectId,
          stack: new Error().stack?.split('\n').slice(1, 5).join('\n'),
        });
        
        await DatabaseService.createVersion(
          currentProjectId,
          circuitData,
          extendedCanvasData,
          `Manual save ${new Date().toLocaleTimeString()}`,
          "Manual save via Ctrl+S or Export button",
          getCurrentNetlist() // NEW: Pass current netlist data
        );
        const saveDuration = Date.now() - saveStartTime;

        markClean();
        setLastSaved(new Date());
        console.log("✅ Manual save completed successfully with fresh data", {
          duration: `${saveDuration}ms`,
          canvasDataSize: JSON.stringify(extendedCanvasData).length,
        });

        // Generate and upload thumbnail after successful save (non-blocking)
        if (canvas) {
          updateProjectThumbnail(currentProjectId, canvas).catch((error) => {
            console.warn("Failed to update thumbnail (non-critical):", error);
          });
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Manual save failed";
        setError(errorMessage);
        console.error("❌ Manual save failed:", error);
      } finally {
        setSaving(false);
      }
    },
    [
      projectId,
      canvas,
      markClean,
      getCurrentCanvasData,
      messages,
      setCurrentData,
      currentProject,
      setSaving,
      setError,
      setLastSaved,
    ]
  );

  // Implement auto-save interval using the same saveNow function
  useEffect(() => {
    if (!autoSaveEnabled || !projectId || !canvas || !isDirty) {
      return;
    }

    const interval = Math.max(autoSaveInterval, 60000); // Minimum 60 seconds
    console.log(`🕐 Setting up auto-save interval: ${interval / 1000}s`);

    const intervalId = setInterval(async () => {
      if (isDirty && projectId && canvas) {
        console.log("⏰ Auto-save interval triggered");
        try {
          await saveNow();
        } catch (error) {
          console.error("❌ Auto-save interval failed:", error);
        }
      }
    }, interval);

    return () => {
      console.log("🕐 Clearing auto-save interval");
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveEnabled, projectId, canvas, isDirty, autoSaveInterval]);
  // Note: saveNow is intentionally excluded to prevent infinite recreation

  // Listen for auto-save completion to mark clean (simplified since we're not using useAutoSave)
  // useEffect(() => {
  //   if (autoSave.lastSaved && isDirty) {
  //     console.log("✅ Auto-save completed, marking clean");
  //     markClean();
  //   }
  // }, [autoSave.lastSaved, isDirty, markClean]);

  return {
    // Auto-save status
    lastSaved,
    saving,
    error,
    isDirty,

    // Manual controls
    saveNow,

    // Current data (for debugging)
    getCurrentCanvasData,
  };
}
