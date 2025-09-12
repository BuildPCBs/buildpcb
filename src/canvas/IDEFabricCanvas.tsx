"use client";

import React, { useRef, useEffect, useState } from "react";
import * as fabric from "fabric";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasHotkeys } from "./hooks/useCanvasHotkeys";
import { useWiringTool } from "./hooks/useWiringTool";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useCanvasAutoSave } from "./hooks/useCanvasAutoSave";
import { useHistoryStack } from "./hooks/useHistoryStack";
import { canvasCommandManager } from "./canvas-command-manager";
import { createSimpleComponent } from "./SimpleComponentFactory";
import { createSVGComponent } from "./SVGComponentFactory";
import { ContextMenu } from "./ui/ContextMenu";
import { HorizontalRuler } from "./ui/HorizontalRuler";
import { VerticalRuler } from "./ui/VerticalRuler";
import { CanvasProvider } from "../contexts/CanvasContext";
import { useProject } from "@/contexts/ProjectContext";
import { supabase } from "@/lib/supabase";

interface IDEFabricCanvasProps {
  className?: string;
  onCanvasReady?: (canvas: any) => void;
}

export function IDEFabricCanvas({
  className = "",
  onCanvasReady,
}: IDEFabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [areRulersVisible, setAreRulersVisible] = useState(false);
  const [restorationInProgress, setRestorationInProgress] = useState(false);
  const [chatRestored, setChatRestored] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1); // Track current zoom level
  const lastZoomRef = useRef(1); // Use ref to avoid stale closure issues
  const [gridVisible, setGridVisible] = useState(false); // Manual grid toggle

  // Grid toggle function
  const toggleGrid = () => {
    const newGridVisible = !gridVisible;
    setGridVisible(newGridVisible);
    if (fabricCanvas) {
      const gridPattern = createGridPattern(
        fabricCanvas,
        gridSize,
        currentZoom
      );
      if (gridPattern) {
        fabricCanvas.backgroundColor = gridPattern;
        fabricCanvas.renderAll();
      }
    }
  };

  // Context menu and clipboard state - Refactored per specification
  const [menuState, setMenuState] = useState({
    visible: false,
    x: 0,
    y: 0,
    canvasX: 0, // Canvas coordinates for paste
    canvasY: 0, // Canvas coordinates for paste
    type: "canvas" as "object" | "canvas",
    target: null as fabric.Object | null,
  });
  const [clipboard, setClipboard] = useState<fabric.Object | null>(null);

  // Track last mouse position for smart paste positioning
  const lastMousePosition = useRef<{ x: number; y: number }>({
    x: 400,
    y: 300,
  });

  // Use viewport control hooks
  useCanvasZoom(fabricCanvas);
  const panState = useCanvasPan(fabricCanvas);
  const viewportState = useCanvasViewport(fabricCanvas);

  // Wire drawing tool - Professional-grade implementation
  const wiringTool = useWiringTool({
    canvas: fabricCanvas,
    enabled: !!fabricCanvas,
  });

  const { currentProject, restoreCanvasData } = useProject();

  // Auto-save functionality
  const autoSave = useCanvasAutoSave({
    canvas: fabricCanvas,
    enabled: !!currentProject, // Only enable when we have a project
  });

  // History stack for undo/redo
  const {
    saveState,
    initializeHistory,
    handleUndo: historyUndo,
    handleRedo: historyRedo,
    canUndo,
    canRedo,
  } = useHistoryStack({ canvas: fabricCanvas });

  // Initialize history when canvas becomes available
  useEffect(() => {
    if (fabricCanvas && initializeHistory) {
      initializeHistory();
    }
  }, [fabricCanvas, initializeHistory]);

  // Canvas restoration effect - only run once when both canvas and data are ready
  useEffect(() => {
    if (
      fabricCanvas &&
      currentProject?.canvas_settings &&
      !restorationInProgress
    ) {
      console.log("🔄 Canvas ready, attempting to restore canvas data...");
      console.log("📊 Canvas data to restore:", {
        timestamp: new Date().toISOString(),
        hasObjects: currentProject.canvas_settings.objects?.length || 0,
        hasViewport: !!currentProject.canvas_settings.viewportTransform,
        zoom: currentProject.canvas_settings.zoom,
        hasChatData: !!currentProject.canvas_settings.chatData,
        chatMessageCount:
          currentProject.canvas_settings.chatData?.messages?.length || 0,
      });

      // Always try to restore chat data first, regardless of canvas objects
      if (currentProject.canvas_settings.chatData && !chatRestored) {
        console.log("💬 Chat data found, dispatching restoration event");
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("chatDataRestored", {
              detail: { chatData: currentProject.canvas_settings.chatData },
            })
          );
          setChatRestored(true);
        }, 100);
      }

      // Check if canvas already has objects (might have been restored already)
      const existingObjects = fabricCanvas.getObjects();
      if (existingObjects.length > 0) {
        console.log(
          "ℹ️ Canvas already has objects, skipping canvas restoration but chat was restored"
        );
        return;
      }

      // Prevent multiple restorations
      setRestorationInProgress(true);

      restoreCanvasData(fabricCanvas)
        .then(() => {
          console.log("✅ Canvas restoration completed");

          // Reapply grid pattern after restoration
          const gridPattern = createGridPattern(
            fabricCanvas,
            gridSize,
            currentZoom
          );
          if (gridPattern) {
            console.log("Reapplying grid pattern after restoration");
            fabricCanvas.backgroundColor = gridPattern;
          } else {
            console.log("Failed to recreate grid pattern after restoration");
          }

          fabricCanvas.renderAll();
          setRestorationInProgress(false);
        })
        .catch((error) => {
          console.error("❌ Canvas restoration failed:", error);

          // Still apply grid even if restoration failed
          const gridPattern = createGridPattern(
            fabricCanvas,
            gridSize,
            currentZoom
          );
          if (gridPattern) {
            console.log("Applying grid pattern after restoration failure");
            fabricCanvas.backgroundColor = gridPattern;
            fabricCanvas.renderAll();
          }

          setRestorationInProgress(false);
        });
    }
  }, [
    fabricCanvas,
    currentProject?.canvas_settings,
    restoreCanvasData,
    chatRestored,
  ]);

  // Global debugging functions for chat restoration testing
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).testChatRestoration = () => {
        console.log("🧪 Testing chat restoration...");
        console.log(
          "Current project chat data:",
          currentProject?.canvas_settings?.chatData
        );
        console.log("Chat restored state:", chatRestored);
        console.log("Restoration in progress:", restorationInProgress);
        return {
          hasChatData: !!currentProject?.canvas_settings?.chatData,
          chatRestored,
          restorationInProgress,
          messageCount:
            currentProject?.canvas_settings?.chatData?.messages?.length || 0,
        };
      };

      (window as any).manualChatRestore = () => {
        console.log("🔧 Manual chat restoration triggered");
        if (currentProject?.canvas_settings?.chatData) {
          window.dispatchEvent(
            new CustomEvent("chatDataRestored", {
              detail: { chatData: currentProject.canvas_settings.chatData },
            })
          );
          setChatRestored(true);
          console.log("✅ Manual chat restoration event dispatched");
        } else {
          console.log("❌ No chat data available for manual restoration");
        }
      };

      (window as any).checkChatMessages = () => {
        console.log("📝 Checking current chat messages...");
        // This will be handled by the AIChatContext
        window.dispatchEvent(new CustomEvent("checkChatMessages"));
      };
    }
  }, [currentProject, chatRestored, restorationInProgress]);

  // Ruler dimensions and grid settings
  const rulerSize = 30;
  const gridSize = 10; // Grid spacing in pixels

  // Helper function to create background grid pattern
  const createGridPattern = (
    canvas: fabric.Canvas,
    gridSize: number,
    zoom: number = 1
  ) => {
    console.log("Creating grid pattern with size:", gridSize, "zoom:", zoom);
    // Create a temporary canvas for the pattern
    const patternCanvas = document.createElement("canvas");
    const patternCtx = patternCanvas.getContext("2d");
    if (!patternCtx) return null;

    // Set pattern canvas size to grid size
    patternCanvas.width = gridSize;
    patternCanvas.height = gridSize;

    // Calculate grid line opacity based on zoom level and manual toggle
    // Grid lines are invisible at normal zoom, become visible when zoomed in or manually enabled
    let lineOpacity = 0;

    if (gridVisible) {
      // Manual grid toggle always shows grid at 50% opacity
      lineOpacity = 0.5;
    } else if (zoom >= 1.5) {
      // Auto-show grid at 1.5x zoom and above
      lineOpacity = Math.min((zoom - 1.5) * 0.3, 0.8); // Max opacity 0.8
    }

    if (lineOpacity > 0) {
      // Draw grid lines
      patternCtx.strokeStyle = `rgba(204, 204, 204, ${lineOpacity})`; // Semi-transparent gray
      patternCtx.lineWidth = Math.max(0.5, 1 / zoom); // Thinner lines when zoomed out
      patternCtx.beginPath();

      // Vertical line
      patternCtx.moveTo(gridSize, 0);
      patternCtx.lineTo(gridSize, gridSize);

      // Horizontal line
      patternCtx.moveTo(0, gridSize);
      patternCtx.lineTo(gridSize, gridSize);

      patternCtx.stroke();
      console.log(
        `Grid pattern created with opacity: ${lineOpacity} (manual: ${gridVisible})`
      );
    } else {
      console.log("Grid pattern created (invisible at current zoom)");
    }

    // Create Fabric.js pattern
    const pattern = new fabric.Pattern({
      source: patternCanvas,
      repeat: "repeat",
    });

    return pattern;
  };

  // Context menu paste handler - uses right-click position
  const handleContextPaste = () => {
    console.log("🔍 DEBUG: handleContextPaste called");
    console.log("🔍 DEBUG: menuState:", menuState);
    handlePaste({ x: menuState.canvasX, y: menuState.canvasY });
  };

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Check if canvas element already has a Fabric.js instance
    const existingCanvas = (canvasRef.current as any).fabric;
    if (existingCanvas) {
      console.log("Disposing existing canvas before creating new one");
      existingCanvas.dispose();
    }

    // Get initial container dimensions
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Account for ruler space
    const canvasWidth = rect.width - rulerSize;
    const canvasHeight = rect.height - rulerSize;

    console.log(
      `Creating new canvas with dimensions: ${canvasWidth}x${canvasHeight}`
    );

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "#FFFFFF", // White background for better grid visibility
    });

    // Create and apply grid pattern immediately
    const gridPattern = createGridPattern(canvas, gridSize, 1); // Start with zoom = 1
    if (gridPattern) {
      console.log("Applying initial grid pattern to canvas");
      canvas.backgroundColor = gridPattern;
      canvas.renderAll();
      console.log("Grid pattern applied and canvas rendered");
    } else {
      console.log("Failed to create initial grid pattern");
      // Fallback: ensure white background
      canvas.backgroundColor = "#FFFFFF";
      canvas.renderAll();
    }

    setFabricCanvas(canvas);
    setCanvasDimensions({ width: canvasWidth, height: canvasHeight });

    // Notify parent that canvas is ready
    if (onCanvasReady) {
      onCanvasReady(canvas);
    }

    // Register canvas with command manager
    canvasCommandManager.setCanvas(canvas);

    // Setup component handler with the new canvas
    setupComponentHandler(canvas);

    // Final render to ensure everything is visible
    setTimeout(() => {
      canvas.renderAll();
      console.log("Final canvas render completed");
    }, 100);

    // Cleanup function to dispose canvas when component unmounts or useEffect re-runs
    return () => {
      console.log("Disposing canvas in cleanup function");

      // Clean up component event listeners
      if (componentEventUnsubscribe) {
        console.log(
          "🧹 Cleaning up component event listener during canvas disposal"
        );
        componentEventUnsubscribe();
        componentEventUnsubscribe = null;
      }

      // Reset component handler setup flag
      isComponentHandlerSetup = false;
      (canvas as any)._componentHandlersSetup = false;

      // Reset processing flag
      isProcessingComponent = false;

      canvas.dispose();
    };
  }, [rulerSize]);

  // Update grid when zoom or visibility changes
  useEffect(() => {
    if (!fabricCanvas) return;

    const updateGrid = () => {
      const gridPattern = createGridPattern(
        fabricCanvas,
        gridSize,
        currentZoom
      );
      if (gridPattern) {
        fabricCanvas.backgroundColor = gridPattern;
        fabricCanvas.renderAll();
      }
    };

    updateGrid();
  }, [fabricCanvas, currentZoom, gridSize, gridVisible]);

  // Dynamic canvas resizing with ResizeObserver
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Account for ruler space
        const canvasWidth = width - rulerSize;
        const canvasHeight = height - rulerSize;

        // Only resize if dimensions actually changed
        if (canvasWidth > 0 && canvasHeight > 0) {
          fabricCanvas.setDimensions({
            width: canvasWidth,
            height: canvasHeight,
          });
          setCanvasDimensions({ width: canvasWidth, height: canvasHeight });

          // Reapply grid pattern after resize
          const gridPattern = createGridPattern(
            fabricCanvas,
            gridSize,
            currentZoom
          );
          if (gridPattern) {
            console.log("Reapplying grid pattern after ResizeObserver resize");
            fabricCanvas.backgroundColor = gridPattern;
          }

          fabricCanvas.renderAll();

          console.log(`Canvas resized to: ${canvasWidth}x${canvasHeight}`);
        }
      }
    });

    // Start observing the container
    resizeObserver.observe(containerRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, [fabricCanvas, rulerSize]);

  // Additional window resize listener as backup
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const handleWindowResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvasWidth = rect.width - rulerSize;
        const canvasHeight = rect.height - rulerSize;

        if (canvasWidth > 0 && canvasHeight > 0) {
          fabricCanvas.setDimensions({
            width: canvasWidth,
            height: canvasHeight,
          });
          setCanvasDimensions({ width: canvasWidth, height: canvasHeight });

          // Reapply grid pattern after resize
          const gridPattern = createGridPattern(
            fabricCanvas,
            gridSize,
            currentZoom
          );
          if (gridPattern) {
            console.log("Reapplying grid pattern after window resize");
            fabricCanvas.backgroundColor = gridPattern;
          }

          fabricCanvas.renderAll();
        }
      }
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [fabricCanvas, rulerSize]);

  // PART 2: Component-Wire Follow Logic + Ruler Visibility + Snap-to-Grid + Alignment Guides
  useEffect(() => {
    if (!fabricCanvas) return;

    console.log(
      "🔗 Setting up component-wire follow logic, ruler visibility, snap-to-grid, and alignment guides"
    );

    // Helper function to snap coordinate to grid
    const snapToGrid = (value: number, gridSize: number) => {
      return Math.round(value / gridSize) * gridSize;
    };

    // Helper function to remove all alignment guides
    const removeAlignmentGuides = () => {
      const guidesToRemove = fabricCanvas
        .getObjects()
        .filter((obj) => (obj as any).isAlignmentGuide);
      guidesToRemove.forEach((guide) => fabricCanvas.remove(guide));
    };

    // Helper function to create alignment guide line
    const createAlignmentGuide = (
      x1: number,
      y1: number,
      x2: number,
      y2: number
    ) => {
      const line = new fabric.Line([x1, y1, x2, y2], {
        stroke: "#FF0000",
        strokeWidth: 1,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      (line as any).isAlignmentGuide = true;
      return line;
    };

    // Helper function to check for alignments and draw guides
    const checkAlignments = (movingObject: fabric.Object) => {
      removeAlignmentGuides(); // Clear previous guides

      const movingBounds = movingObject.getBoundingRect();
      const movingCenterX = movingBounds.left + movingBounds.width / 2;
      const movingCenterY = movingBounds.top + movingBounds.height / 2;
      const tolerance = 5; // Alignment tolerance in pixels

      // Get all other objects (excluding the moving object and existing guides)
      const otherObjects = fabricCanvas
        .getObjects()
        .filter(
          (obj) =>
            obj !== movingObject &&
            !(obj as any).isAlignmentGuide &&
            obj.visible &&
            obj.selectable
        );

      otherObjects.forEach((obj) => {
        const objBounds = obj.getBoundingRect();
        const objCenterX = objBounds.left + objBounds.width / 2;
        const objCenterY = objBounds.top + objBounds.height / 2;

        // Vertical alignment guides (X-axis alignments)
        // Left edges align
        if (Math.abs(movingBounds.left - objBounds.left) <= tolerance) {
          const guide = createAlignmentGuide(
            objBounds.left,
            Math.min(movingBounds.top, objBounds.top) - 20,
            objBounds.left,
            Math.max(
              movingBounds.top + movingBounds.height,
              objBounds.top + objBounds.height
            ) + 20
          );
          fabricCanvas.add(guide);
        }

        // Center X align
        if (Math.abs(movingCenterX - objCenterX) <= tolerance) {
          const guide = createAlignmentGuide(
            objCenterX,
            Math.min(movingBounds.top, objBounds.top) - 20,
            objCenterX,
            Math.max(
              movingBounds.top + movingBounds.height,
              objBounds.top + objBounds.height
            ) + 20
          );
          fabricCanvas.add(guide);
        }

        // Right edges align
        if (
          Math.abs(
            movingBounds.left +
              movingBounds.width -
              (objBounds.left + objBounds.width)
          ) <= tolerance
        ) {
          const guide = createAlignmentGuide(
            objBounds.left + objBounds.width,
            Math.min(movingBounds.top, objBounds.top) - 20,
            objBounds.left + objBounds.width,
            Math.max(
              movingBounds.top + movingBounds.height,
              objBounds.top + objBounds.height
            ) + 20
          );
          fabricCanvas.add(guide);
        }

        // Horizontal alignment guides (Y-axis alignments)
        // Top edges align
        if (Math.abs(movingBounds.top - objBounds.top) <= tolerance) {
          const guide = createAlignmentGuide(
            Math.min(movingBounds.left, objBounds.left) - 20,
            objBounds.top,
            Math.max(
              movingBounds.left + movingBounds.width,
              objBounds.left + objBounds.width
            ) + 20,
            objBounds.top
          );
          fabricCanvas.add(guide);
        }

        // Center Y align
        if (Math.abs(movingCenterY - objCenterY) <= tolerance) {
          const guide = createAlignmentGuide(
            Math.min(movingBounds.left, objBounds.left) - 20,
            objCenterY,
            Math.max(
              movingBounds.left + movingBounds.width,
              objBounds.left + objBounds.width
            ) + 20,
            objCenterY
          );
          fabricCanvas.add(guide);
        }

        // Bottom edges align
        if (
          Math.abs(
            movingBounds.top +
              movingBounds.height -
              (objBounds.top + objBounds.height)
          ) <= tolerance
        ) {
          const guide = createAlignmentGuide(
            Math.min(movingBounds.left, objBounds.left) - 20,
            objBounds.top + objBounds.height,
            Math.max(
              movingBounds.left + movingBounds.width,
              objBounds.left + objBounds.width
            ) + 20,
            objBounds.top + objBounds.height
          );
          fabricCanvas.add(guide);
        }
      });

      fabricCanvas.renderAll();
    };

    const handleObjectMoving = (e: any) => {
      const movingObject = e.target;

      // Show rulers when any object starts moving
      setAreRulersVisible(true);

      // PART 2: Snap-to-Grid Logic
      if (
        movingObject &&
        movingObject.left !== undefined &&
        movingObject.top !== undefined
      ) {
        const snappedLeft = snapToGrid(movingObject.left, gridSize);
        const snappedTop = snapToGrid(movingObject.top, gridSize);

        movingObject.set({
          left: snappedLeft,
          top: snappedTop,
        });
      }

      // PART 3: Smart Alignment Guides
      if (movingObject) {
        checkAlignments(movingObject);
      }

      // PART 2: Only track component movement (not wire movement) for wire following
      if (
        movingObject &&
        ((movingObject as any).componentType ||
          movingObject.type === "group") &&
        movingObject.type === "group"
      ) {
        // This is a component being moved - update connected wires
        console.log(
          "🔄 Component moving - updating connected wires in real-time"
        );
        wiringTool.updateConnectedWires(movingObject);
      }
      // PART 3: No Follow Rule - If a wire is being moved, do nothing
      // Components should NOT follow wires
    };

    const handleObjectMoved = (e: any) => {
      const movedObject = e.target;

      // Remove alignment guides when movement stops
      removeAlignmentGuides();

      // Final position update for components only
      if (
        movedObject &&
        ((movedObject as any).componentType || movedObject.type === "group") &&
        movedObject.type === "group"
      ) {
        console.log("🎯 Component movement completed - final wire update");
        wiringTool.updateConnectedWires(movedObject);
      }

      // Save state for undo/redo
      saveState();
    };

    // New ruler visibility handlers per design requirements
    const handleSelectionCreated = () => {
      console.log("👆 Object selected - showing rulers");
      setAreRulersVisible(true);
    };

    const handleSelectionUpdated = () => {
      console.log("🔄 Selection updated - showing rulers");
      setAreRulersVisible(true);
    };

    const handleSelectionCleared = () => {
      console.log("❌ Selection cleared - hiding rulers");
      setAreRulersVisible(false);
      // Also remove any lingering alignment guides
      removeAlignmentGuides();
    };

    // Attach all listeners
    fabricCanvas.on("object:moving", handleObjectMoving);
    fabricCanvas.on("object:modified", handleObjectMoved);
    fabricCanvas.on("object:added", () => {
      // Debounce saveState to prevent multiple rapid calls
      setTimeout(() => saveState(), 0);
    });
    fabricCanvas.on("object:removed", () => {
      // Debounce saveState to prevent multiple rapid calls
      setTimeout(() => saveState(), 0);
    });
    fabricCanvas.on("selection:created", handleSelectionCreated);
    fabricCanvas.on("selection:updated", handleSelectionUpdated);
    fabricCanvas.on("selection:cleared", handleSelectionCleared);

    return () => {
      fabricCanvas.off("object:moving", handleObjectMoving);
      fabricCanvas.off("object:modified", handleObjectMoved);
      fabricCanvas.off("object:added", () => {
        setTimeout(() => saveState(), 0);
      });
      fabricCanvas.off("object:removed", () => {
        setTimeout(() => saveState(), 0);
      });
      fabricCanvas.off("selection:created", handleSelectionCreated);
      fabricCanvas.off("selection:updated", handleSelectionUpdated);
      fabricCanvas.off("selection:cleared", handleSelectionCleared);
    };
  }, [fabricCanvas, wiringTool, saveState]);

  // PART 1: Master Action Functions with "LOUD" Logging - The Single Source of Truth
  const handleGroup = () => {
    console.log("--- ACTION START: handleGroup ---");
    if (!fabricCanvas) {
      console.log("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();

    // Check if we have multiple objects selected (activeSelection)
    if (activeObject && activeObject.type === "activeSelection") {
      console.log("--- Grouping existing activeSelection ---");

      // Get the objects from the ActiveSelection
      const objects = (activeObject as any)._objects || [];
      if (objects.length < 2) {
        console.log(
          "--- ACTION FAILED: ActiveSelection has less than 2 objects ---"
        );
        return;
      }

      // Store original positions before removing from canvas
      const objectsWithPositions = objects.map((obj: fabric.Object) => ({
        object: obj,
        originalLeft: obj.left,
        originalTop: obj.top,
      }));

      // Remove objects from canvas temporarily
      objects.forEach((obj: fabric.Object) => fabricCanvas.remove(obj));

      // Create a new Group with these objects, preserving their relative positions
      const group = new fabric.Group(objects);

      // Set the group position to maintain the visual location
      group.set({
        left: activeObject.left,
        top: activeObject.top,
      });

      // Add the group to canvas and select it
      fabricCanvas.add(group);
      fabricCanvas.setActiveObject(group);
      fabricCanvas.renderAll();
      console.log("--- ACTION SUCCESS: handleGroup (from activeSelection) ---");
      return;
    }

    // Get all selectable objects on canvas
    const allObjects = fabricCanvas
      .getObjects()
      .filter(
        (obj) => obj.selectable && obj.visible && !(obj as any).isAlignmentGuide
      );

    if (allObjects.length < 2) {
      console.log("--- ACTION FAILED: Need at least 2 objects to group ---");
      return;
    }

    console.log(`--- Found ${allObjects.length} objects to group ---`);

    // Calculate the bounding box of all objects
    let minLeft = Infinity,
      minTop = Infinity,
      maxRight = -Infinity,
      maxBottom = -Infinity;
    allObjects.forEach((obj) => {
      const bounds = obj.getBoundingRect();
      if (bounds.left < minLeft) minLeft = bounds.left;
      if (bounds.top < minTop) minTop = bounds.top;
      if (bounds.left + bounds.width > maxRight)
        maxRight = bounds.left + bounds.width;
      if (bounds.top + bounds.height > maxBottom)
        maxBottom = bounds.top + bounds.height;
    });

    // Remove all objects from canvas
    allObjects.forEach((obj) => fabricCanvas.remove(obj));

    // Create a Group with all objects
    const group = new fabric.Group(allObjects);

    // Set the group position to the calculated center
    group.set({
      left: minLeft + (maxRight - minLeft) / 2,
      top: minTop + (maxBottom - minTop) / 2,
    });

    // Add the group to canvas and select it
    fabricCanvas.add(group);
    fabricCanvas.setActiveObject(group);
    fabricCanvas.renderAll();

    console.log("--- ACTION SUCCESS: handleGroup (created new group) ---");
    // saveState(); // We can add this back later
  };

  const handleUngroup = async () => {
    console.log("--- ACTION START: handleUngroup ---");
    if (!fabricCanvas) {
      console.log("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.type !== "group") {
      console.log("--- ACTION FAILED: Selected object is not a group ---");
      return;
    }

    console.log("--- Ungrouping selected group ---");

    const group = activeObject as fabric.Group;

    // Get the objects from the group
    const objects = group.getObjects();

    // Get the group's current position and transforms
    const groupMatrix = group.calcTransformMatrix();

    // Remove the group from canvas
    fabricCanvas.remove(group);

    // Add each object back to canvas with correct absolute positioning
    const addedObjects: fabric.Object[] = [];

    // Process objects sequentially to avoid async issues
    for (const obj of objects) {
      try {
        // Clone the object properly
        const clonedObj = await obj.clone();

        // Calculate the absolute position of the object
        const objPoint = fabric.util.transformPoint(
          { x: obj.left || 0, y: obj.top || 0 },
          groupMatrix
        );

        // Set the object's absolute position
        clonedObj.set({
          left: objPoint.x,
          top: objPoint.y,
          // Preserve the object's own scale and rotation if any
          scaleX: (obj.scaleX || 1) * (group.scaleX || 1),
          scaleY: (obj.scaleY || 1) * (group.scaleY || 1),
          angle: (obj.angle || 0) + (group.angle || 0),
        });

        fabricCanvas.add(clonedObj);
        addedObjects.push(clonedObj);
      } catch (error) {
        console.error("Error cloning object during ungroup:", error);
      }
    }

    // Select all ungrouped objects if more than one
    if (addedObjects.length > 1) {
      const selection = new fabric.ActiveSelection(addedObjects, {
        canvas: fabricCanvas,
      });
      fabricCanvas.setActiveObject(selection);
    } else if (addedObjects.length === 1) {
      fabricCanvas.setActiveObject(addedObjects[0]);
    }

    fabricCanvas.renderAll();
    console.log(
      `--- ACTION SUCCESS: handleUngroup (ungrouped ${addedObjects.length} objects) ---`
    );

    // saveState(); // We can add this back later
  };

  const handleDelete = () => {
    console.log("--- ACTION START: handleDelete ---");
    if (!fabricCanvas) {
      console.log("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) {
      console.log("--- ACTION FAILED: No object selected to delete ---");
      return;
    }

    // Handle multiple selected objects (activeSelection)
    if (activeObject.type === "activeSelection") {
      const objects = (activeObject as any)._objects || [];
      objects.forEach((obj: fabric.Object) => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      saveState();
      console.log(
        `--- ACTION SUCCESS: handleDelete (deleted ${objects.length} objects) ---`
      );
      return;
    }

    // Handle single object
    fabricCanvas.remove(activeObject);
    fabricCanvas.renderAll();
    saveState();
    console.log("--- ACTION SUCCESS: handleDelete (deleted 1 object) ---");
  };

  const handleCopy = () => {
    console.log("🔍 DEBUG: handleCopy called");
    console.log("--- ACTION START: handleCopy ---");
    if (!fabricCanvas) {
      console.log("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) {
      console.log("--- ACTION FAILED: No object selected to copy ---");
      return;
    }

    // Simple copy implementation
    setClipboard(activeObject);
    console.log("--- ACTION SUCCESS: handleCopy ---");
  };

  const handlePaste = (position?: { x: number; y: number }) => {
    console.log("--- ACTION START: handlePaste ---");
    if (!fabricCanvas) {
      console.log("--- ACTION FAILED: No canvas available ---");
      return;
    }

    if (!clipboard) {
      console.log("--- ACTION FAILED: Nothing to paste (clipboard empty) ---");
      return;
    }

    // Smart paste implementation - place at mouse cursor position
    clipboard.clone().then((cloned: any) => {
      // Use provided position or current mouse position for paste location
      const pastePos = position || lastMousePosition.current;

      cloned.set({
        left: pastePos.x,
        top: pastePos.y,
      });

      // Check if this is a component that needs pin recreation
      const componentData = cloned.data;
      const componentType = cloned.componentType;

      if (
        componentData &&
        componentData.type === "component" &&
        componentType
      ) {
        console.log(
          `🔄 Pasted component detected: ${
            componentData.componentName || componentType
          }`
        );

        // Dynamically import the appropriate pin recreation function based on component characteristics
        const recreateComponentPins = async () => {
          try {
            // Try SVG factory first (most feature-complete)
            const { recreateComponentPins: svgRecreate } = await import(
              "./SVGComponentFactory"
            );
            let recreatedComponent = svgRecreate(cloned, fabricCanvas);

            // If that didn't work, try intelligent factory
            if (!recreatedComponent || recreatedComponent === cloned) {
              const { recreateIntelligentComponentPins } = await import(
                "./IntelligentComponentFactory"
              );
              recreatedComponent = recreateIntelligentComponentPins(
                cloned,
                fabricCanvas
              );
            }

            // If that didn't work, try simple factory
            if (!recreatedComponent || recreatedComponent === cloned) {
              const { recreateSimpleComponentPins } = await import(
                "./SimpleComponentFactory"
              );
              recreatedComponent = recreateSimpleComponentPins(
                cloned,
                fabricCanvas
              );
            }

            fabricCanvas.add(recreatedComponent);
            fabricCanvas.setActiveObject(recreatedComponent);
            fabricCanvas.renderAll();
            saveState();

            console.log(
              `--- ACTION SUCCESS: handlePaste with pin recreation at position (${pastePos.x}, ${pastePos.y}) ---`
            );
          } catch (error) {
            console.error("❌ Failed to recreate component pins:", error);
            // Fallback: add the cloned component as-is
            fabricCanvas.add(cloned);
            fabricCanvas.setActiveObject(cloned);
            fabricCanvas.renderAll();
            saveState();

            console.log(
              `--- ACTION SUCCESS: handlePaste (fallback) at position (${pastePos.x}, ${pastePos.y}) ---`
            );
          }
        };

        recreateComponentPins();
      } else {
        // Regular object - just add it
        fabricCanvas.add(cloned);
        fabricCanvas.setActiveObject(cloned);
        fabricCanvas.renderAll();
        saveState();
        console.log(
          `--- ACTION SUCCESS: handlePaste at position (${pastePos.x}, ${pastePos.y}) ---`
        );
      }
    });
    // saveState(); // We can add this back later
  };

  const handleRotate = () => {
    console.log("--- ACTION START: handleRotate ---");
    if (!fabricCanvas) {
      console.log("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) {
      console.log("--- ACTION FAILED: No component selected to rotate ---");
      return;
    }

    // Only rotate components (not wires or other objects)
    if (!(activeObject as any).componentType) {
      console.log("--- ACTION FAILED: Selected object is not a component ---");
      return;
    }

    // Rotate by 90 degrees
    const currentAngle = activeObject.angle || 0;
    const newAngle = (currentAngle + 90) % 360;

    activeObject.set("angle", newAngle);
    fabricCanvas.renderAll();
    saveState();

    console.log(
      `--- ACTION SUCCESS: handleRotate (${currentAngle}° → ${newAngle}°) ---`
    );
  };

  const handleUndo = () => {
    console.log("--- ACTION START: handleUndo ---");
    historyUndo();
    console.log("--- ACTION END: handleUndo ---");
  };

  const handleRedo = () => {
    console.log("--- ACTION START: handleRedo ---");
    historyRedo();
    console.log("--- ACTION END: handleRedo ---");
  };

  // PART 3: The Connection (The Central Hub)
  // PART 3: The Connection (The Central Hub) - TEMPORARILY DISABLED FOR DIRECT TESTING
  // useEffect(() => {
  //   if (!fabricCanvas) return;

  //   console.log('Setting up centralized command handlers...');

  //   const unsubscribeGroup = canvasCommandManager.on('action:group', () => {
  //     console.log('Handler: "action:group" command received.');
  //     handleGroup();
  //   });

  //   const unsubscribeUngroup = canvasCommandManager.on('action:ungroup', () => {
  //     console.log('Handler: "action:ungroup" command received.');
  //     handleUngroup();
  //   });

  //   const unsubscribeDelete = canvasCommandManager.on('action:delete', () => {
  //     console.log('Handler: "action:delete" command received.');
  //     handleDelete();
  //   });

  //   const unsubscribeCopy = canvasCommandManager.on('action:copy', () => {
  //     console.log('Handler: "action:copy" command received.');
  //     handleCopy();
  //   });

  //   const unsubscribePaste = canvasCommandManager.on('action:paste', () => {
  //     console.log('Handler: "action:paste" command received.');
  //     handlePaste();
  //   });

  //   const unsubscribeUndo = canvasCommandManager.on('action:undo', () => {
  //     console.log('Handler: "action:undo" command received.');
  //     handleUndo();
  //   });

  //   const unsubscribeRedo = canvasCommandManager.on('action:redo', () => {
  //     console.log('Handler: "action:redo" command received.');
  //     handleRedo();
  //   });

  //   // Cleanup function
  //   return () => {
  //     unsubscribeGroup();
  //     unsubscribeUngroup();
  //     unsubscribeDelete();
  //     unsubscribeCopy();
  //     unsubscribePaste();
  //     unsubscribeUndo();
  //     unsubscribeRedo();
  //   };
  // }, [fabricCanvas, handleGroup, handleUngroup, handleDelete, handleCopy, handlePaste, handleUndo, handleRedo]);

  // Cross-platform keyboard shortcuts - PART 2: Direct Function Connection Test
  useCanvasHotkeys({
    canvas: fabricCanvas,
    enabled: !!fabricCanvas,
    onGroup: handleGroup,
    onUngroup: handleUngroup,
    onDelete: handleDelete,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onRotate: handleRotate,
    onSave: autoSave.saveNow,
    onToggleGrid: toggleGrid, // Add grid toggle
  });

  // Right-click context menu handler - Completely refactored per specification
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const containerDiv = containerRef.current;

    const handleContextMenu = (e: MouseEvent) => {
      console.log("🔍 IDEFabricCanvas handleContextMenu triggered!");
      console.log("- Event:", e);
      console.log("- clientX:", e.clientX, "clientY:", e.clientY);

      e.preventDefault(); // Stop the default browser menu

      // Use canvas.findTarget() to determine if user right-clicked on an object
      const target = fabricCanvas.findTarget(e);
      console.log("- Fabric target found:", target);
      console.log("- Target name:", target ? (target as any).name : "none");

      if (target && (target as any).name !== "workspace") {
        console.log("✅ Showing OBJECT context menu");
        // Case A: Right-Click on an Object
        // Make that object the active selection on the canvas
        fabricCanvas.setActiveObject(target);
        fabricCanvas.renderAll();

        // Show context menu with "Copy" and "Delete" options
        const objectMenuState = {
          visible: true,
          x: e.clientX,
          y: e.clientY,
          canvasX: fabricCanvas.getPointer(e).x,
          canvasY: fabricCanvas.getPointer(e).y,
          type: "object" as const,
          target: target,
        };
        console.log("🔧 Setting OBJECT menu state:", objectMenuState);
        setMenuState(objectMenuState);
      } else {
        console.log("✅ Showing CANVAS context menu");
        // Case B: Right-Click on Empty Canvas
        // Show context menu with only "Paste" option
        const canvasMenuState = {
          visible: true,
          x: e.clientX,
          y: e.clientY,
          canvasX: fabricCanvas.getPointer(e).x,
          canvasY: fabricCanvas.getPointer(e).y,
          type: "canvas" as const,
          target: null,
        };
        console.log("🔧 Setting CANVAS menu state:", canvasMenuState);
        setMenuState(canvasMenuState);
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Close context menu on any regular click, but not on right-click
      // Right-click (button 2) should not close the menu that it just opened
      if (e.button === 0) {
        // Only close on left-click
        setMenuState((prev) => ({ ...prev, visible: false }));
      }
    };

    // Attach listeners to the canvas container div
    containerDiv.addEventListener("contextmenu", handleContextMenu);
    containerDiv.addEventListener("click", handleClick);

    return () => {
      containerDiv.removeEventListener("contextmenu", handleContextMenu);
      containerDiv.removeEventListener("click", handleClick);
    };
  }, [fabricCanvas]);

  // Track mouse position for smart paste placement
  useEffect(() => {
    if (!fabricCanvas) return;

    const handleMouseMove = (event: fabric.TEvent) => {
      const pointer = fabricCanvas.getPointer(event.e);
      lastMousePosition.current = { x: pointer.x, y: pointer.y };
    };

    fabricCanvas.on("mouse:move", handleMouseMove);

    return () => {
      fabricCanvas.off("mouse:move", handleMouseMove);
    };
  }, [fabricCanvas]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full canvas-container ${className}`}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Rulers Layout - Only visible when manipulating objects */}
      <div className="relative w-full h-full">
        {areRulersVisible && (
          <>
            {/* Top-left corner space */}
            <div
              className="absolute top-0 left-0 border-b border-r border-gray-300"
              style={{
                width: rulerSize,
                height: rulerSize,
                background: "linear-gradient(135deg, #fafafa 0%, #f0f0f0 100%)",
                zIndex: 10,
              }}
            />

            {/* Horizontal Ruler */}
            <div
              className="absolute top-0"
              style={{
                left: rulerSize,
                width: canvasDimensions.width,
                height: rulerSize,
                zIndex: 10,
              }}
            >
              <HorizontalRuler
                width={canvasDimensions.width}
                height={rulerSize}
                viewportTransform={viewportState.viewportTransform}
                zoom={viewportState.zoom}
              />
            </div>

            {/* Vertical Ruler */}
            <div
              className="absolute left-0"
              style={{
                top: rulerSize,
                width: rulerSize,
                height: canvasDimensions.height,
                zIndex: 10,
              }}
            >
              <VerticalRuler
                width={rulerSize}
                height={canvasDimensions.height}
                viewportTransform={viewportState.viewportTransform}
                zoom={viewportState.zoom}
              />
            </div>
          </>
        )}

        {/* Main Canvas */}
        <div
          className="absolute"
          style={{
            top: areRulersVisible ? rulerSize : 0,
            left: areRulersVisible ? rulerSize : 0,
            width: areRulersVisible ? canvasDimensions.width : "100%",
            height: areRulersVisible ? canvasDimensions.height : "100%",
          }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Context Menu - PART 2: Direct Function Connection Test */}
      <ContextMenu
        visible={menuState.visible}
        top={menuState.y}
        left={menuState.x}
        menuType={menuState.type}
        canPaste={clipboard !== null}
        onClose={() => setMenuState((prev) => ({ ...prev, visible: false }))}
        onGroup={handleGroup}
        onUngroup={handleUngroup}
        onDelete={handleDelete}
        onCopy={handleCopy}
        onPaste={handleContextPaste}
      />

      {/* Optional debug info */}
      {panState.isPanMode && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
          Pan Mode {panState.isDragging ? "- Dragging" : ""}
        </div>
      )}

      {/* Grid and Snap indicator */}
      <div className="absolute bottom-2 left-2 bg-green-600 bg-opacity-90 text-white px-2 py-1 rounded text-xs">
        Grid: {gridSize}px • INTELLIGENT SVG • R=rotate • W=wire
      </div>

      {/* Wire mode indicator - Professional-grade wiring tool */}
      {wiringTool.isWireMode && (
        <div className="absolute top-2 right-2 bg-blue-600 bg-opacity-90 text-white px-3 py-2 rounded text-sm font-medium">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>
              {wiringTool.wireState === "idle" &&
                "Wire Mode - Click pin to start"}
              {wiringTool.wireState === "drawing" &&
                "Drawing - Click to add waypoint"}
              {wiringTool.wireState === "finishing" &&
                "Finishing - Click pin to complete"}
            </span>
          </div>
          <div className="text-xs opacity-80 mt-1">
            Press W to toggle • ESC to cancel • Right-click to cancel
          </div>
        </div>
      )}

      {/* Auto-save status indicator */}
      {currentProject && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-90 text-white px-3 py-1 rounded text-xs">
          <div className="flex items-center gap-2">
            {autoSave.saving && (
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-spin"></div>
            )}
            {!autoSave.saving && autoSave.isDirty && (
              <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            )}
            {!autoSave.saving && !autoSave.isDirty && (
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            )}
            <span>
              {autoSave.saving && "Saving..."}
              {!autoSave.saving && autoSave.isDirty && "Unsaved changes"}
              {!autoSave.saving &&
                !autoSave.isDirty &&
                autoSave.lastSaved &&
                `Saved ${autoSave.lastSaved.toLocaleTimeString()}`}
              {(!autoSave.saving &&
                !autoSave.isDirty &&
                !autoSave.lastSaved &&
                currentProject.name) ||
                "Project"}
            </span>
          </div>
          {autoSave.error && (
            <div className="text-xs text-red-300 mt-1">
              Save failed: {autoSave.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// SIMPLE COMPONENT HANDLER - Add this at the end
let isComponentHandlerSetup = false;
let componentEventUnsubscribe: (() => void) | null = null;
let isProcessingComponent = false; // Flag to prevent duplicate component creation

export function setupComponentHandler(canvas: fabric.Canvas) {
  // Use canvas instance ID to prevent duplicate setup for the same canvas
  const canvasElement = canvas.getElement();
  const canvasId = canvasElement?.id || `canvas-${Date.now()}`;

  if (canvasElement && !canvasElement.id) {
    canvasElement.id = canvasId;
  }

  // Clean up previous event listener if it exists
  if (componentEventUnsubscribe) {
    console.log("🧹 Cleaning up previous component event listener");
    componentEventUnsubscribe();
    componentEventUnsubscribe = null;
  }

  // Check if this canvas already has component handlers set up
  if ((canvas as any)._componentHandlersSetup) {
    console.log(
      "Component handlers already set up for this canvas, skipping..."
    );
    return;
  }

  console.log("🔄 Setting up SVG component handler with fresh canvas...");

  // Mark this canvas as having handlers set up
  (canvas as any)._componentHandlersSetup = true;

  // Store the unsubscribe function for cleanup
  componentEventUnsubscribe = canvasCommandManager.on(
    "component:add",
    async (payload: {
      id: string;
      type: string;
      svgPath: string;
      name: string;
      category?: string;
      description?: string;
      manufacturer?: string;
      partNumber?: string;
      pinCount?: number;
      databaseComponent?: any;
      x?: number;
      y?: number;
    }) => {
      console.log("🎯 Component command received for", payload.name);

      // New intelligent component creation logic with database metadata
      const createComponent = async (componentInfo: typeof payload) => {
        console.log(
          `🎯 DEBUG: ===== STARTING COMPONENT CREATION FOR ${componentInfo.name} =====`
        );

        // Prevent duplicate processing
        if (isProcessingComponent) {
          console.log(
            `⚠️ Component creation already in progress, skipping ${componentInfo.name}`
          );
          return;
        }

        isProcessingComponent = true;
        const currentCanvas = canvasCommandManager.getCanvas();
        if (!currentCanvas) {
          console.error(
            `❌ ERROR: No canvas available from command manager for component ${componentInfo.name}`
          );
          return;
        }

        try {
          // Fetch full component data from database using the component ID
          console.log(
            `🔍 Fetching database component data for ID: ${componentInfo.id}`
          );
          const { data: dbComponent, error: dbError } = await supabase
            .from("components")
            .select("*")
            .eq("id", componentInfo.id)
            .single();

          if (dbError) {
            console.warn(
              `⚠️ Could not fetch database component data:`,
              dbError
            );
            console.log(`🔄 Proceeding with provided component info only`);
          } else if (dbComponent) {
            console.log(`✅ Retrieved full database component data:`, {
              name: dbComponent.name,
              manufacturer: dbComponent.manufacturer,
              partNumber: dbComponent.part_number,
              category: dbComponent.category,
              hasPins: dbComponent.pin_configuration?.pins?.length > 0,
            });

            // Merge database data with provided info
            componentInfo = {
              ...componentInfo,
              category: dbComponent.category || componentInfo.category,
              description: dbComponent.description || componentInfo.description,
              manufacturer:
                dbComponent.manufacturer || componentInfo.manufacturer,
              partNumber: dbComponent.part_number || componentInfo.partNumber,
              pinCount:
                dbComponent.pin_configuration?.pins?.length ||
                componentInfo.pinCount,
              // Use database SVG if available, otherwise keep the provided svgPath
              svgPath: dbComponent.symbol_svg
                ? `data:image/svg+xml;base64,${btoa(dbComponent.symbol_svg)}`
                : componentInfo.svgPath,
              // Store full database component for later use
              databaseComponent: dbComponent,
            };
          }

          // Check for duplicate components at the same position (more lenient)
          const existingComponents = currentCanvas
            .getObjects()
            .filter(
              (obj: any) =>
                obj.data?.componentName === componentInfo.name &&
                obj.data?.componentType === componentInfo.type &&
                Math.abs((obj.left || 0) - (componentInfo.x || 0)) < 5 &&
                Math.abs((obj.top || 0) - (componentInfo.y || 0)) < 5
            );

          if (existingComponents.length > 0) {
            console.log(
              `⚠️ Very similar component detected for ${componentInfo.name} at same position, skipping creation`
            );
            isProcessingComponent = false; // Reset flag since we're not processing
            return;
          }

          console.log(`🎯 DEBUG: Using current canvas from command manager`);
          console.log(`🎯 DEBUG: Canvas exists: ${!!currentCanvas}`);
          console.log(`🎯 DEBUG: Canvas width: ${currentCanvas.width}`);
          console.log(`🎯 DEBUG: Canvas height: ${currentCanvas.height}`);
          console.log(
            `🎯 DEBUG: Canvas objects count: ${
              currentCanvas.getObjects().length
            }`
          );
          console.log(
            `🎯 DEBUG: Canvas disposed: ${currentCanvas.disposed || false}`
          );

          // Additional canvas validation
          if (currentCanvas.disposed) {
            console.error(
              `❌ ERROR: Current canvas is disposed when creating component ${componentInfo.name}`
            );
            return;
          }

          if (!currentCanvas.getElement()) {
            console.error(
              `❌ ERROR: Current canvas element is not available when creating component ${componentInfo.name}`
            );
            return;
          }

          // Handle SVG loading - support both URLs and data URLs
          let svgPromise: Promise<string>;

          if (componentInfo.svgPath.startsWith("data:image/svg+xml;base64,")) {
            // Handle data URL - extract SVG content directly
            const base64Data = componentInfo.svgPath.split(",")[1];
            const svgString = atob(base64Data);
            svgPromise = Promise.resolve(svgString);
            console.log(
              `📄 SVG extracted from data URL (${svgString.length} chars)`
            );
          } else {
            // Handle regular URL - fetch from server
            svgPromise = fetch(componentInfo.svgPath).then((response) => {
              if (!response.ok) {
                throw new Error(
                  `HTTP ${response.status}: ${response.statusText}`
                );
              }
              return response.text();
            });
            console.log(`📄 SVG fetched from URL: ${componentInfo.svgPath}`);
          }

          svgPromise
            .then((svgString) => {
              console.log(`📄 SVG loaded (${svgString.length} chars)`);
              return fabric.loadSVGFromString(svgString);
            })
            .then((result) => {
              const objects = result.objects.filter((obj) => !!obj);
              console.log(`🔍 Parsed ${objects.length} SVG objects`);
              const pinsFromSVG: fabric.FabricObject[] = [];
              const symbolParts: fabric.FabricObject[] = [];

              // 1. Separate the loaded parts into PINS and SYMBOL pieces
              objects.forEach((obj: any, index: number) => {
                console.log(`🎯 DEBUG: Processing object ${index}:`, {
                  type: obj?.type,
                  id: obj?.id,
                  left: obj?.left,
                  top: obj?.top,
                  visible: obj?.visible,
                  opacity: obj?.opacity,
                  hasEl: !!obj?.el,
                });

                if (obj && obj.id === "pin") {
                  // This is a connection point. Save it.
                  console.log(`📍 Found PIN at x=${obj.left}, y=${obj.top}`);
                  pinsFromSVG.push(obj);
                } else if (obj) {
                  // This is part of the visual symbol.
                  symbolParts.push(obj);
                }
              });

              console.log(
                `🔌 Found ${pinsFromSVG.length} pins and ${symbolParts.length} symbol parts`
              );

              // PART 1: THE COMPONENT "SANDWICH" 🥪
              // Creating a permanent, inseparable group with three layers

              // BOTTOM BREAD: Original, invisible pin data (stores true location)
              const invisiblePinData = pinsFromSVG.map((pin, index) => ({
                originalX: pin.left! + (pin.width || 0) / 2,
                originalY: pin.top! + (pin.height || 0) / 2,
                pinId: `pin${index + 1}`,
                pinNumber: index + 1,
              }));

              // THE FILLING: Main component symbol (the SVG shape)
              console.log(
                `🎯 DEBUG: Creating SVG symbol with ${symbolParts.length} parts`
              );
              console.log(
                `🎯 DEBUG: Symbol parts:`,
                symbolParts.map((part, i) => ({
                  index: i,
                  type: part?.type,
                  id: (part as any)?.id,
                  hasEl: !!(part as any)?.el,
                }))
              );

              const svgSymbol = new fabric.Group(symbolParts, {
                originX: "center",
                originY: "center",
              });

              console.log(
                `🎯 DEBUG: SVG Symbol created with ${symbolParts.length} parts`
              );
              console.log(
                `🎯 DEBUG: SVG Symbol bounds:`,
                svgSymbol.getBoundingRect()
              );
              console.log(`🎯 DEBUG: Symbol parts:`, symbolParts);

              // DEBUG: Ensure all symbol parts are visible
              symbolParts.forEach((part, index) => {
                if (part.opacity === 0 || part.opacity === undefined) {
                  part.set("opacity", 1);
                  console.log(
                    `🎯 DEBUG: Set opacity to 1 for symbol part ${index}`
                  );
                }
                if (part.visible === false) {
                  part.set("visible", true);
                  console.log(
                    `🎯 DEBUG: Set visible to true for symbol part ${index}`
                  );
                }
              });
              svgSymbol.set("opacity", 1);
              svgSymbol.set("visible", true);

              console.log(
                `🎯 DEBUG: SVG Symbol created with ${symbolParts.length} parts`
              );
              console.log(
                `🎯 DEBUG: SVG Symbol bounds:`,
                svgSymbol.getBoundingRect()
              );
              console.log(
                `🎯 DEBUG: Symbol parts:`,
                symbolParts.map((part) => ({
                  type: part.type,
                  visible: part.visible,
                  opacity: part.opacity,
                }))
              );

              // TOP BREAD: Visible, interactive pin circles (transparent green)
              console.log(
                `🎯 DEBUG: Creating ${pinsFromSVG.length} interactive pins`
              );

              // Generate a single component ID for all pins in this component
              const componentId = `component_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}`;

              const interactivePins = pinsFromSVG.map((pin, index) => {
                console.log(
                  `🎯 DEBUG: Creating pin ${index + 1} at (${pin.left}, ${
                    pin.top
                  })`
                );

                const interactivePin = new fabric.Circle({
                  radius: 4,
                  fill: "rgba(0, 255, 0, 0.8)", // Bright green for visibility
                  stroke: "#059669",
                  strokeWidth: 1,
                  left: pin.left! + (pin.width || 0) / 2,
                  top: pin.top! + (pin.height || 0) / 2,
                  originX: "center",
                  originY: "center",
                  // PART 3: PIN VISIBILITY RULE - Start hidden
                  opacity: 0,
                  visible: false,
                });

                console.log(`🎯 DEBUG: Pin ${index + 1} created successfully`);

                // Add the pin metadata that the wiring tool expects
                interactivePin.set("pin", true);
                interactivePin.set("pinData", invisiblePinData[index]);
                interactivePin.set("data", {
                  type: "pin",
                  componentId: componentId,
                  pinId: `pin${index + 1}`,
                  pinNumber: index + 1,
                  isConnectable: true,
                });

                return interactivePin;
              });

              // THE GOLDEN RULE: Lock all three layers together into ONE inseparable group
              // This is the COMPONENT SANDWICH - it moves as one unit forever

              // Calculate position - try to use screen center if no specific coordinates provided
              let componentX = componentInfo.x;
              let componentY = componentInfo.y;

              if (!componentX || !componentY) {
                // Get the center of the visible canvas area in screen coordinates
                try {
                  const canvasElement = currentCanvas.getElement();
                  if (canvasElement) {
                    const canvasRect = canvasElement.getBoundingClientRect();
                    const centerX = canvasRect.width / 2;
                    const centerY = canvasRect.height / 2;

                    // Convert screen coordinates to canvas coordinates using viewport transform
                    const vpt = currentCanvas.viewportTransform;
                    const zoom = currentCanvas.getZoom();
                    componentX = (centerX - vpt[4]) / zoom;
                    componentY = (centerY - vpt[5]) / zoom;

                    console.log(
                      `📍 Component positioned at center: (${componentX.toFixed(
                        0
                      )}, ${componentY.toFixed(0)})`
                    );
                  } else {
                    // Fallback: use canvas viewport center
                    console.log(
                      `📍 Using viewport center (canvas element unavailable)`
                    );
                    const vpCenter = currentCanvas.getVpCenter();
                    componentX = vpCenter.x;
                    componentY = vpCenter.y;
                  }
                } catch (error) {
                  console.error(
                    `❌ ERROR: Failed to get canvas position:`,
                    error
                  );
                  // Ultimate fallback: use canvas viewport center
                  const vpCenter = currentCanvas.getVpCenter();
                  componentX = vpCenter.x;
                  componentY = vpCenter.y;
                }
              }

              const componentSandwich = new fabric.Group(
                [svgSymbol, ...interactivePins],
                {
                  left: componentX,
                  top: componentY,
                  originX: "center",
                  originY: "center",
                  selectable: true,
                  evented: true,
                  lockScalingX: true,
                  lockScalingY: true,
                  hasControls: true,
                  hasBorders: true,
                  centeredRotation: true,
                }
              );

              // DEBUG: Log component positioning
              const vpCenter = canvas.getVpCenter();
              console.log(
                `📍 Canvas center: (${vpCenter.x.toFixed(
                  0
                )}, ${vpCenter.y.toFixed(0)})`
              );
              console.log(
                `📍 Component position: (${componentSandwich.left?.toFixed(
                  0
                )}, ${componentSandwich.top?.toFixed(0)})`
              );

              // Check if component is within visible bounds
              const bounds = componentSandwich.getBoundingRect();
              const canvasWidth = canvas.getWidth();
              const canvasHeight = canvas.getHeight();
              console.log(
                `📐 Component bounds: (${bounds.left.toFixed(
                  0
                )}, ${bounds.top.toFixed(0)}) ${bounds.width.toFixed(
                  0
                )}x${bounds.height.toFixed(0)}`
              );

              // Store the invisible pin data and component metadata
              componentSandwich.set("componentType", componentInfo.type);
              componentSandwich.set("invisiblePinData", invisiblePinData);
              componentSandwich.set("data", {
                type: "component",
                componentId: componentId,
                componentType: componentInfo.type,
                componentName: componentInfo.name,
                pins: interactivePins.map((_, index) => `pin${index + 1}`),
                isComponentSandwich: true, // Mark this as a proper sandwich
              });

              // Attach full database component metadata for proper serialization
              if (componentInfo.databaseComponent) {
                componentSandwich.set(
                  "databaseComponent",
                  componentInfo.databaseComponent
                );
                componentSandwich.set("componentMetadata", {
                  id: componentInfo.databaseComponent.id,
                  name: componentInfo.databaseComponent.name,
                  type: componentInfo.databaseComponent.type,
                  category: componentInfo.databaseComponent.category,
                  description: componentInfo.databaseComponent.description,
                  manufacturer: componentInfo.databaseComponent.manufacturer,
                  partNumber: componentInfo.databaseComponent.part_number,
                  specifications:
                    componentInfo.databaseComponent.specifications,
                  pinConfiguration:
                    componentInfo.databaseComponent.pin_configuration,
                  kicadSymRaw: componentInfo.databaseComponent.kicad_sym_raw,
                  kicadLibrarySource:
                    componentInfo.databaseComponent.kicad_library_source,
                  datasheetUrl: componentInfo.databaseComponent.datasheet_url,
                  keywords: componentInfo.databaseComponent.keywords,
                });
                console.log(
                  `💾 Attached database metadata to component: ${componentInfo.name}`
                );
              }

              // 5. Add the COMPONENT SANDWICH to the canvas - physically impossible to separate
              console.log(
                `🎯 Adding ${componentInfo.name} to canvas (${
                  currentCanvas.getObjects().length
                } objects currently)`
              );

              currentCanvas.add(componentSandwich);
              currentCanvas.renderAll();

              console.log(
                `✅ ${componentInfo.name} added to canvas (${
                  currentCanvas.getObjects().length
                } total objects)`
              );

              // Check component properties
              console.log(
                `📐 Component bounds: (${bounds.left.toFixed(
                  0
                )}, ${bounds.top.toFixed(0)}) ${bounds.width.toFixed(
                  0
                )}x${bounds.height.toFixed(0)}`
              );

              // Check if component is within canvas viewport
              const viewportBounds = {
                left:
                  -currentCanvas.viewportTransform[4] / currentCanvas.getZoom(),
                top:
                  -currentCanvas.viewportTransform[5] / currentCanvas.getZoom(),
                right:
                  (-currentCanvas.viewportTransform[4] +
                    currentCanvas.getWidth()) /
                  currentCanvas.getZoom(),
                bottom:
                  (-currentCanvas.viewportTransform[5] +
                    currentCanvas.getHeight()) /
                  currentCanvas.getZoom(),
              };
              const componentBounds = componentSandwich.getBoundingRect();
              const isVisible =
                componentBounds.left < viewportBounds.right &&
                componentBounds.left + componentBounds.width >
                  viewportBounds.left &&
                componentBounds.top < viewportBounds.bottom &&
                componentBounds.top + componentBounds.height >
                  viewportBounds.top;
              console.log(`🎯 DEBUG: Viewport bounds:`, viewportBounds);
              console.log(
                `🎯 DEBUG: Is component within viewport: ${isVisible}`
              );

              // Check if component is still there after a short delay
              setTimeout(() => {
                console.log(
                  `🎯 DEBUG: Component still in canvas after delay: ${currentCanvas
                    .getObjects()
                    .includes(componentSandwich)}`
                );
                console.log(
                  `🎯 DEBUG: Total objects after delay: ${
                    currentCanvas.getObjects().length
                  }`
                );
                if (currentCanvas.getObjects().includes(componentSandwich)) {
                  console.log(
                    `🎯 DEBUG: Component bounds after delay:`,
                    componentSandwich.getBoundingRect()
                  );
                  console.log(
                    `🎯 DEBUG: Component position after delay: left=${componentSandwich.left}, top=${componentSandwich.top}`
                  );
                  console.log(
                    `🎯 DEBUG: Component visible after delay: ${componentSandwich.visible}`
                  );
                  console.log(
                    `🎯 DEBUG: Component opacity after delay: ${componentSandwich.opacity}`
                  );
                }
              }, 100);

              console.log(
                `🥪 COMPONENT SANDWICH: Added ${componentInfo.name} with ${interactivePins.length} permanently attached pins!`
              );

              console.log(
                `🎯 DEBUG: ===== COMPONENT CREATION COMPLETED FOR ${componentInfo.name} =====`
              );

              // Reset processing flag
              isProcessingComponent = false;
            })
            .catch((error) => {
              console.error(
                `❌ INTELLIGENT: Failed to load ${componentInfo.svgPath}:`,
                error
              );

              // Reset processing flag on error
              isProcessingComponent = false;

              // Fallback: Try to create a simple component instead
              console.log(
                `🔄 FALLBACK: Attempting to create simple component for ${componentInfo.name}`
              );
              try {
                const simpleComponent = new fabric.Rect({
                  left: 200,
                  top: 200,
                  width: 60,
                  height: 30,
                  fill: "#E8E8E8",
                  stroke: "#333333",
                  strokeWidth: 2,
                });

                simpleComponent.set("componentType", componentInfo.type);
                simpleComponent.set("data", {
                  type: "component",
                  componentType: componentInfo.type,
                  componentName: componentInfo.name,
                });

                currentCanvas.add(simpleComponent);
                currentCanvas.renderAll();

                console.log(
                  `✅ FALLBACK: Simple component created for ${componentInfo.name}`
                );
              } catch (fallbackError) {
                console.error(
                  `❌ FALLBACK: Failed to create simple component:`,
                  fallbackError
                );

                // Reset processing flag on fallback error
                isProcessingComponent = false;
              }
            });
        } catch (error) {
          console.error(
            `❌ COMPONENT CREATION: Failed to create component ${componentInfo.name}:`,
            error
          );
          isProcessingComponent = false;
        }
      };

      // Use the new createComponent function
      createComponent(payload);
    }
  );

  isComponentHandlerSetup = true;
}
