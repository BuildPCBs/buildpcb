"use client";

import { useState, useCallback, useRef } from "react";
import Konva from "konva";

interface HistoryState {
  stageState: any;
  timestamp: number;
}

interface UseHistoryStackProps {
  stage: Konva.Stage | null;
  maxHistorySize?: number;
  onRestore?: (stage: Konva.Stage) => void;
}

export function useHistoryStack({
  stage,
  maxHistorySize = 50,
  onRestore,
}: UseHistoryStackProps) {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoInProgress = useRef(false);
  const hasInitialized = useRef(false);

  // Save current stage state to history
  const saveState = useCallback(() => {
    if (!stage || isUndoRedoInProgress.current) return;

    try {
      const stageState = stage.toJSON();
      const newState: HistoryState = {
        stageState,
        timestamp: Date.now(),
      };

      setHistory((prev) => {
        // Remove any history after current index (for when user made changes after undo)
        const newHistory = prev.slice(0, historyIndex + 1);
        // Add new state
        newHistory.push(newState);
        // Limit history size
        if (newHistory.length > maxHistorySize) {
          newHistory.shift();
          setHistoryIndex(Math.max(0, historyIndex - 1));
        }
        return newHistory;
      });

      setHistoryIndex((prev) => Math.min(prev + 1, maxHistorySize - 1));
    } catch (error) {
      console.error("Failed to save state to history:", error);
    }
  }, [stage, historyIndex, maxHistorySize]);

  // Undo operation
  const undo = useCallback(() => {
    if (!stage || historyIndex <= 0) return;

    isUndoRedoInProgress.current = true;

    try {
      const targetIndex = historyIndex - 1;
      const targetState = history[targetIndex];

      if (targetState) {
        // Clear current stage children (layers)
        stage.destroyChildren();

        // Create temp stage from JSON to extract layers
        // We do this to avoid replacing the actual Stage instance which React holds
        const tempStage = Konva.Node.create(targetState.stageState);

        // Move children from temp stage to actual stage
        const children = tempStage.getChildren().toArray();
        children.forEach((child: any) => {
          child.moveTo(stage);
        });

        setHistoryIndex(targetIndex);
        stage.batchDraw();

        // Notify restoration
        if (onRestore) onRestore(stage);
      }
    } catch (error) {
      console.error("Failed to undo:", error);
    } finally {
      isUndoRedoInProgress.current = false;
    }
  }, [stage, history, historyIndex]);

  // Redo operation
  const redo = useCallback(() => {
    if (!stage || historyIndex >= history.length - 1) return;

    isUndoRedoInProgress.current = true;

    try {
      const targetIndex = historyIndex + 1;
      const targetState = history[targetIndex];

      if (targetState) {
        stage.destroyChildren();

        const tempStage = Konva.Node.create(targetState.stageState);

        const children = tempStage.getChildren().toArray();
        children.forEach((child: any) => {
          child.moveTo(stage);
        });

        setHistoryIndex(targetIndex);
        stage.batchDraw();
      }
    } catch (error) {
      console.error("Failed to redo:", error);
    } finally {
      isUndoRedoInProgress.current = false;
    }
  }, [stage, history, historyIndex]);

  // Initialize history with current state
  const initializeHistory = useCallback(() => {
    if (!stage || hasInitialized.current) return;

    // Only initialize if history is empty
    if (history.length === 0) {
      hasInitialized.current = true;
      saveState();
    }
  }, [stage, history.length, saveState]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    initializeHistory,
  };
}
