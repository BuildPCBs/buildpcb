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
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoInProgress = useRef(false);
  const isInitializing = useRef(false);
  const isHistoryInitialized = useRef(false);

  // Save current canvas state to history
  const saveState = useCallback(() => {
    if (!canvas || isUndoRedoInProgress.current) return;

    // If history is not initialized, initialize it first
    if (!isHistoryInitialized.current) {
      if (isInitializing.current) {
        console.log(
          "⏳ History initialization already in progress, waiting..."
        );
        return;
      }

      console.log("🎬 Auto-initializing history before saving state");
      isInitializing.current = true;

      try {
        // Check if canvas is in a valid state
        if (canvas.disposed) {
          console.warn("⚠️ Canvas is disposed, cannot save state");
          isInitializing.current = false;
          return;
        }

        const canvasState = canvas.toObject();

        // Additional validation
        if (!canvasState) {
          console.warn("⚠️ Canvas.toObject() returned null/undefined");
          isInitializing.current = false;
          return;
        }

        const initialState: HistoryState = {
          canvasState,
          timestamp: Date.now(),
        };

        // Use functional updates to avoid race conditions
        setHistory([initialState]);
        setHistoryIndex(0);
        isHistoryInitialized.current = true;

        console.log("✅ History auto-initialized successfully");
        isInitializing.current = false;

        // Return after initialization to prevent infinite loop
        // The initialization itself is enough for the first state
        return;
      } catch (error) {
        console.error("❌ Failed to auto-initialize history:", error);
        isInitializing.current = false;
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
        const newIndex = Math.min(prev + 1, maxHistorySize - 1);
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
    if (isHistoryInitialized.current) {
      console.log("ℹ️ History already initialized, skipping");
      return;
    }

    if (isInitializing.current) {
      console.log("⏳ History initialization already in progress, skipping");
      return;
    }

    console.log("🎬 Initializing history stack");
    isInitializing.current = true;

    try {
      // Check if canvas is in a valid state
      if (canvas.disposed) {
        console.warn("⚠️ Canvas is disposed, cannot initialize history");
        isInitializing.current = false;
        return;
      }

      const canvasState = canvas.toObject();

      // Additional validation
      if (!canvasState) {
        console.warn(
          "⚠️ Canvas.toObject() returned null/undefined during initialization"
        );
        isInitializing.current = false;
        return;
      }

      const initialState: HistoryState = {
        canvasState,
        timestamp: Date.now(),
      };

      setHistory([initialState]);
      setHistoryIndex(0);
      isHistoryInitialized.current = true;
      isInitializing.current = false;
    } catch (error) {
      console.error("❌ Failed to initialize history:", error);
      isInitializing.current = false;
    }
  }, [canvas]); // Remove historyIndex to prevent re-running during initialization

  // Undo last action
  const handleUndo = useCallback(() => {
    if (!canvas || historyIndex <= 0 || history.length === 0) {
      console.log("⚠️ Cannot undo: No previous states available");
      return false;
    }

    const previousStateIndex = historyIndex - 1;
    const previousState = history[previousStateIndex];

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
        console.log("✅ Undo completed");
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
    if (!canvas || historyIndex >= history.length - 1 || history.length === 0) {
      console.log("⚠️ Cannot redo: No future states available");
      return false;
    }

    const nextStateIndex = historyIndex + 1;
    const nextState = history[nextStateIndex];

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
        console.log("✅ Redo completed");
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
