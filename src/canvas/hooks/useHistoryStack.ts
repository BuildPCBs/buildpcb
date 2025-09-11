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

  // Save current canvas state to history
  const saveState = useCallback(() => {
    if (!canvas || isUndoRedoInProgress.current) return;

    // Don't save if history is not initialized
    if (historyIndex < 0) {
      console.log("⚠️ Cannot save state: History not initialized");
      return;
    }

    console.log("💾 Saving canvas state to history");

    try {
      const canvasState = canvas.toObject();

      // Validate that we have a valid canvas state
      if (!canvasState || typeof canvasState !== "object") {
        console.warn("⚠️ Invalid canvas state, skipping save");
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
  }, [canvas, historyIndex, maxHistorySize]);

  // Initialize history with empty canvas state
  const initializeHistory = useCallback(() => {
    if (!canvas) {
      console.log("⚠️ Cannot initialize history: Canvas not available");
      return;
    }

    console.log("🎬 Initializing history stack");
    const initialState: HistoryState = {
      canvasState: canvas.toObject(),
      timestamp: Date.now(),
    };

    setHistory([initialState]);
    setHistoryIndex(0);
  }, [canvas]);

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
