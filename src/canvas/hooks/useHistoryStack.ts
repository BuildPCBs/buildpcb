"use client";

import { useState, useCallback, useRef } from "react";
import * as fabric from "fabric";

interface HistoryState {
  canvasState: any;

  timestamp: number;
}

interface UseHistoryStackProps {
  canvas: fabric.Canvas | null;
  maxHistorySize?: number;
}

export function useHistoryStack({
  canvas,
  maxHistorySize = 50,
}: UseHistoryStackProps) {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoInProgress = useRef(false);
  const hasInitialized = useRef(false);

  // Save current canvas state to history
  const saveState = useCallback(() => {
    console.log("🔍 DEBUG: saveState called", {
      hasCanvas: !!canvas,
      isUndoRedoInProgress: isUndoRedoInProgress.current,
      hasInitialized: hasInitialized.current,
      currentHistoryLength: history.length,
      currentHistoryIndex: historyIndex,
    });

    if (!canvas || isUndoRedoInProgress.current) {
      console.log("🔍 DEBUG: saveState early return", {
        reason: !canvas ? "no canvas" : "undo/redo in progress",
      });
      return;
    }

    // If history is not initialized, initialize it first
    if (!hasInitialized.current) {
      console.log("🎬 Auto-initializing history before saving state");

      try {
        // Check if canvas is in a valid state
        if (canvas.disposed) {
          console.warn("⚠️ Canvas is disposed, cannot save state");
          return;
        }

        const canvasState = canvas.toObject();

        // Additional validation
        if (!canvasState) {
          console.warn("⚠️ Canvas.toObject() returned null/undefined");
          return;
        }

        const initialState: HistoryState = {
          canvasState,
          timestamp: Date.now(),
        };

        // Use functional updates to avoid race conditions
        setHistory([initialState]);
        setHistoryIndex(0);
        hasInitialized.current = true;

        console.log("✅ History auto-initialized successfully", {
          historyLength: 1,
          historyIndex: 0,
        });

        // Return after initialization to prevent infinite loop
        // The initialization itself is enough for the first state
        return;
      } catch (error) {
        console.error("❌ Failed to auto-initialize history:", error);
        return;
      }
    }

    // console.log("💾 Saving canvas state to history");

    try {
      // Check if canvas is in a valid state
      if (canvas.disposed) {
        console.warn("⚠️ Canvas is disposed, cannot save state");
        return;
      }

      const canvasState = canvas.toObject();

      // Validate that we have a valid canvas state
      if (!canvasState || typeof canvasState !== "object") {
        console.warn("⚠️ Invalid canvas state, skipping save");
        return;
      }

      // Check if canvas has basic required properties
      if (!canvasState.objects || !Array.isArray(canvasState.objects)) {
        console.warn("⚠️ Canvas state missing objects array, skipping save");
        return;
      }

      const newState: HistoryState = {
        canvasState,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        // Remove any states after current index (when user makes new action after undo)
        const newHistory = prev.slice(0, historyIndex + 1);

        // Add new state
        newHistory.push(newState);

        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
          return newHistory;
        }

        return newHistory;
      });

      setHistoryIndex((prev) => {
        // Simply increment to point to the newly added state
        const newIndex = prev + 1;
        console.log("🔍 DEBUG: State saved to history", {
          previousIndex: prev,
          newIndex: newIndex,
          historyLength: "will be " + (prev + 2), // prev + 1 for the new item + 1 for display
        });
        return newIndex;
      });
    } catch (error) {
      console.error("Error saving canvas state:", error);
    }
  }, [canvas, maxHistorySize]); // Remove historyIndex to prevent recreation during initialization

  // Initialize history with empty canvas state
  const initializeHistory = useCallback(() => {
    if (!canvas) {
      console.log("⚠️ Cannot initialize history: Canvas not available");
      return;
    }

    // Don't reinitialize if already initialized
    if (hasInitialized.current) {
      console.log("ℹ️ History already initialized, skipping");
      return;
    }

    console.log("🎬 Initializing history stack");

    try {
      // Check if canvas is in a valid state
      if (canvas.disposed) {
        console.warn("⚠️ Canvas is disposed, cannot initialize history");
        return;
      }

      const canvasState = canvas.toObject();

      // Additional validation
      if (!canvasState) {
        console.warn(
          "⚠️ Canvas.toObject() returned null/undefined during initialization"
        );
        return;
      }

      const initialState: HistoryState = {
        canvasState,
        timestamp: Date.now(),
      };

      setHistory([initialState]);
      setHistoryIndex(0);
      hasInitialized.current = true;
    } catch (error) {
      console.error("❌ Failed to initialize history:", error);
    }
  }, [canvas]); // Remove historyIndex to prevent re-running during initialization

  // Undo last action
  const handleUndo = useCallback(() => {
    console.log("🔍 DEBUG: handleUndo called", {
      hasCanvas: !!canvas,
      historyIndex: historyIndex,
      historyLength: history.length,
      canUndo: historyIndex > 0 && history.length > 0,
    });

    if (!canvas || historyIndex <= 0 || history.length === 0) {
      console.log("⚠️ Cannot undo: No previous states available", {
        hasCanvas: !!canvas,
        historyIndex: historyIndex,
        historyLength: history.length,
      });
      return false;
    }

    const previousStateIndex = historyIndex - 1;
    const previousState = history[previousStateIndex];

    console.log("🔍 DEBUG: Undo details", {
      currentIndex: historyIndex,
      previousIndex: previousStateIndex,
      hasPreviousState: !!previousState,
      hasCanvasState: !!previousState?.canvasState,
    });

    if (!previousState || !previousState.canvasState) {
      console.log("⚠️ Cannot undo: Invalid previous state");
      return false;
    }

    console.log("↶ Performing undo operation");
    isUndoRedoInProgress.current = true;

    try {
      canvas.loadFromJSON(previousState.canvasState, () => {
        canvas.renderAll();
        setHistoryIndex(previousStateIndex);
        isUndoRedoInProgress.current = false;
        console.log("✅ Undo completed", {
          newIndex: previousStateIndex,
          totalHistory: history.length,
        });
      });
    } catch (error) {
      console.error("Error during undo operation:", error);
      isUndoRedoInProgress.current = false;
      return false;
    }

    return true;
  }, [canvas, history, historyIndex]);

  // Redo last undone action
  const handleRedo = useCallback(() => {
    console.log("🔍 DEBUG: handleRedo called", {
      hasCanvas: !!canvas,
      historyIndex: historyIndex,
      historyLength: history.length,
      canRedo: historyIndex < history.length - 1,
    });

    if (!canvas || historyIndex >= history.length - 1 || history.length === 0) {
      console.log("⚠️ Cannot redo: No future states available", {
        hasCanvas: !!canvas,
        historyIndex: historyIndex,
        historyLength: history.length,
        condition: historyIndex >= history.length - 1 ? "at end" : "no history",
      });
      return false;
    }

    const nextStateIndex = historyIndex + 1;
    const nextState = history[nextStateIndex];

    console.log("🔍 DEBUG: Redo details", {
      currentIndex: historyIndex,
      nextIndex: nextStateIndex,
      hasNextState: !!nextState,
      hasCanvasState: !!nextState?.canvasState,
    });

    if (!nextState || !nextState.canvasState) {
      console.log("⚠️ Cannot redo: Invalid next state");
      return false;
    }

    console.log("↷ Performing redo operation");
    isUndoRedoInProgress.current = true;

    try {
      canvas.loadFromJSON(nextState.canvasState, () => {
        canvas.renderAll();
        setHistoryIndex(nextStateIndex);
        isUndoRedoInProgress.current = false;
        console.log("✅ Redo completed", {
          newIndex: nextStateIndex,
          totalHistory: history.length,
        });
      });
    } catch (error) {
      console.error("Error during redo operation:", error);
      isUndoRedoInProgress.current = false;
      return false;
    }

    return true;
  }, [canvas, history, historyIndex]);

  // Check if undo/redo operations are possible
  const canUndo =
    history.length > 0 &&
    historyIndex > 0 &&
    history[historyIndex - 1]?.canvasState;
  const canRedo =
    history.length > 0 &&
    historyIndex < history.length - 1 &&
    history[historyIndex + 1]?.canvasState;

  return {
    saveState,
    initializeHistory,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    historySize: history.length,
    currentIndex: historyIndex,
  };
}
