"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as fabric from "fabric";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasHotkeys } from "./hooks/useCanvasHotkeys";
import { useSimpleWiringTool } from "./hooks/useSimpleWiringTool";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useCanvasAutoSave } from "./hooks/useCanvasAutoSave";
import { useHistoryStack } from "./hooks/useHistoryStack";
import { memoryMonitor } from "@/lib/memory-monitor";
import { logger } from "@/lib/logger";
import { canvasCommandManager } from "./canvas-command-manager";
import { setupComponentHandler } from "./componentHandlerSetup";
import { createSimpleComponent } from "./SimpleComponentFactory";
import { ContextMenu } from "./ui/ContextMenu";
import { HorizontalRuler } from "./ui/HorizontalRuler";
import { VerticalRuler } from "./ui/VerticalRuler";
import { ComponentPickerOverlay } from "./ui/ComponentPickerOverlay";
import { CanvasProvider } from "../contexts/CanvasContext";
import { useProject } from "@/contexts/ProjectContext";
import { supabase } from "@/lib/supabase";

interface IDEFabricCanvasProps {
  className?: string;
  onCanvasReady?: (canvas: any) => void;
  onNetlistReady?: (getNetlist: () => any) => void;
}

export function IDEFabricCanvas({
  className = "",
  onCanvasReady,
  onNetlistReady,
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
  const [isComponentPickerVisible, setIsComponentPickerVisible] =
    useState(false);

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

  const [netlist, setNetlist] = useState<any[]>([]);

  // Simple Wiring Tool - Works with Database Pin Data
  const wiringTool = useSimpleWiringTool({
    canvas: fabricCanvas,
    enabled: !!fabricCanvas,
    onNetlistChange: setNetlist,
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
  }, [fabricCanvas]); // Remove initializeHistory from deps to prevent re-running

  // Canvas restoration effect - only run once when both canvas and data are ready
  useEffect(() => {
    if (
      fabricCanvas &&
      currentProject?.canvas_settings &&
      !restorationInProgress
    ) {
      logger.canvas("Canvas ready, attempting to restore canvas data");
      logger.canvas("Canvas data to restore", {
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
        logger.canvas("Chat data found, dispatching restoration event");
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
        logger.canvas(
          "Canvas already has objects, skipping canvas restoration but chat was restored"
        );
        return;
      }

      // Prevent multiple restorations
      setRestorationInProgress(true);

      restoreCanvasData(fabricCanvas)
        .then(() => {
          logger.canvas("Canvas restoration completed");

          // Reapply grid pattern after restoration
          const gridPattern = createGridPattern(
            fabricCanvas,
            gridSize,
            currentZoom
          );
          if (gridPattern) {
            logger.canvas("Reapplying grid pattern after restoration");
            fabricCanvas.backgroundColor = gridPattern;
          } else {
            logger.canvas("Failed to recreate grid pattern after restoration");
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
            logger.canvas("Applying grid pattern after restoration failure");
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
        logger.canvas("Testing chat restoration...");
        logger.canvas(
          "Current project chat data:",
          currentProject?.canvas_settings?.chatData
        );
        logger.canvas("Chat restored state:", chatRestored);
        logger.canvas("Restoration in progress:", restorationInProgress);
        return {
          hasChatData: !!currentProject?.canvas_settings?.chatData,
          chatRestored,
          restorationInProgress,
          messageCount:
            currentProject?.canvas_settings?.chatData?.messages?.length || 0,
        };
      };

      (window as any).manualChatRestore = () => {
        logger.canvas("Manual chat restoration triggered");
        if (currentProject?.canvas_settings?.chatData) {
          window.dispatchEvent(
            new CustomEvent("chatDataRestored", {
              detail: { chatData: currentProject.canvas_settings.chatData },
            })
          );
          setChatRestored(true);
          logger.canvas("Manual chat restoration event dispatched");
        } else {
          logger.canvas("No chat data available for manual restoration");
        }
      };

      (window as any).checkChatMessages = () => {
        logger.canvas("Checking current chat messages...");
        // This will be handled by the AIChatContext
        window.dispatchEvent(new CustomEvent("checkChatMessages"));
      };
    }
  }, [currentProject, chatRestored, restorationInProgress]);

  const wiringToolRef = useRef(wiringTool);

  // Update ref when wiringTool changes
  useEffect(() => {
    wiringToolRef.current = wiringTool;
  }, [wiringTool]);

  // Stable callback for toggle wire mode
  const toggleWireMode = useCallback(() => {
    wiringToolRef.current?.toggleWireMode();
  }, []);

  // Netlist restoration listener
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleNetlistRestored = (event: CustomEvent) => {
        const { netlist } = event.detail;
        logger.wire("Netlist restored from project data:", {
          netCount: netlist?.nets?.length || 0,
          totalConnections:
            netlist?.nets?.reduce(
              (sum: number, net: any) => sum + (net.connections?.length || 0),
              0
            ) || 0,
        });
        setNetlist(netlist || []);
        // Also update the wiring tool's netlist
        if (wiringToolRef.current.setNetlist) {
          wiringToolRef.current.setNetlist(netlist?.nets || []);
        }
      };

      window.addEventListener(
        "netlistRestored",
        handleNetlistRestored as EventListener
      );

      return () => {
        window.removeEventListener(
          "netlistRestored",
          handleNetlistRestored as EventListener
        );
      };
    }
  }, []);

  // Ruler dimensions and grid settings
  const rulerSize = 30;
  const gridSize = 10; // Grid spacing in pixels

  // Helper function to create background grid pattern
  const createGridPattern = (
    canvas: fabric.Canvas,
    gridSize: number,
    zoom: number = 1
  ) => {
    logger.canvas("Creating grid pattern with size:", gridSize, "zoom:", zoom);
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
      logger.canvas(
        `Grid pattern created with opacity: ${lineOpacity} (manual: ${gridVisible})`
      );
    } else {
      logger.canvas("Grid pattern created (invisible at current zoom)");
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
    logger.canvas("handleContextPaste called");
    logger.canvas("menuState:", menuState);
    handlePaste({ x: menuState.canvasX, y: menuState.canvasY });
  };

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Check if canvas element already has a Fabric.js instance
    const existingCanvas = (canvasRef.current as any).fabric;
    if (existingCanvas) {
      logger.canvas("Disposing existing canvas before creating new one");
      existingCanvas.dispose();
    }

    // Get initial container dimensions
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Account for ruler space
    const canvasWidth = rect.width - rulerSize;
    const canvasHeight = rect.height - rulerSize;

    logger.canvas(
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
      logger.canvas("Applying initial grid pattern to canvas");
      canvas.backgroundColor = gridPattern;
      canvas.renderAll();
      logger.canvas("Grid pattern applied and canvas rendered");
    } else {
      logger.canvas("Failed to create initial grid pattern");
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

    // Provide netlist access to parent
    if (onNetlistReady) {
      onNetlistReady(() => netlist);
    }

    // Register canvas with command manager
    canvasCommandManager.setCanvas(canvas);

    // Start memory monitoring
    memoryMonitor.startMonitoring();

    // Setup component handler with the new canvas
    const cleanupComponentHandler = setupComponentHandler(canvas);

    // Final render to ensure everything is visible
    setTimeout(() => {
      canvas.renderAll();
      logger.canvas("Final canvas render completed");
    }, 100);

    // Cleanup function to dispose canvas when component unmounts or useEffect re-runs
    return () => {
      logger.canvas("Disposing canvas in cleanup function");

      // Stop memory monitoring
      memoryMonitor.stopMonitoring();

      // Clean up component event listeners
      if (cleanupComponentHandler) {
        cleanupComponentHandler();
      }

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
            logger.canvas(
              "Reapplying grid pattern after ResizeObserver resize"
            );
            fabricCanvas.backgroundColor = gridPattern;
          }

          fabricCanvas.renderAll();

          logger.canvas(`Canvas resized to: ${canvasWidth}x${canvasHeight}`);
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
            logger.canvas("Reapplying grid pattern after window resize");
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

    logger.canvas(
      "Setting up component-wire follow logic, ruler visibility, snap-to-grid, and alignment guides"
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
        logger.canvas(
          "Component moving - updating connected wires in real-time"
        );
        // Note: Simple wiring tool doesn't need wire updates on component move
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
        logger.canvas("Component movement completed - final wire update");
        // Note: Simple wiring tool doesn't need wire updates on component move
      }

      // Save state for undo/redo
      saveState();
    };

    // New ruler visibility handlers per design requirements
    const handleSelectionCreated = () => {
      logger.canvas("Object selected - showing rulers");
      setAreRulersVisible(true);
    };

    const handleSelectionUpdated = () => {
      logger.canvas("Selection updated - showing rulers");
      setAreRulersVisible(true);
    };

    const handleSelectionCleared = () => {
      logger.canvas("Selection cleared - hiding rulers");
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
  }, [fabricCanvas, saveState]);

  // Canvas memory optimization
  const optimizeCanvasMemory = useCallback(() => {
    if (!fabricCanvas) return;

    logger.canvas("Optimizing canvas memory...");

    const objects = fabricCanvas.getObjects();
    let removedCount = 0;

    // Remove objects that are off-screen and not visible
    objects.forEach((obj) => {
      const bounds = obj.getBoundingRect();
      const canvasWidth = fabricCanvas.width || 0;
      const canvasHeight = fabricCanvas.height || 0;

      // Remove objects that are completely off-screen
      if (
        bounds.left > canvasWidth + 100 ||
        bounds.top > canvasHeight + 100 ||
        bounds.left + bounds.width < -100 ||
        bounds.top + bounds.height < -100
      ) {
        // Don't remove components or important objects
        if (!(obj as any).componentType && !(obj as any).isAlignmentGuide) {
          fabricCanvas.remove(obj);
          removedCount++;
        }
      }
    });

    if (removedCount > 0) {
      logger.canvas(`Removed ${removedCount} off-screen objects`);
      fabricCanvas.renderAll();
    }

    // Force garbage collection hint (if available)
    if (window.gc) {
      window.gc();
    }
  }, [fabricCanvas]);

  // Auto-optimize memory periodically
  useEffect(() => {
    if (!fabricCanvas) return;

    const memoryCheckInterval = setInterval(() => {
      // Check memory usage and optimize if needed
      if ("memory" in performance) {
        const memoryInfo = (performance as any).memory;
        const memoryUsageRatio =
          memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize;

        if (memoryUsageRatio > 0.7) {
          // If using more than 70% of heap
          logger.canvas("High memory usage detected, optimizing canvas...");
          optimizeCanvasMemory();
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(memoryCheckInterval);
  }, [fabricCanvas, optimizeCanvasMemory]);
  const handleGroup = () => {
    logger.canvas("--- ACTION START: handleGroup ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();

    // Check if we have multiple objects selected (activeSelection)
    if (activeObject && activeObject.type === "activeSelection") {
      logger.canvas("--- Grouping existing activeSelection ---");

      // Get the objects from the ActiveSelection
      const objects = (activeObject as any)._objects || [];
      if (objects.length < 2) {
        logger.canvas(
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
      logger.canvas(
        "--- ACTION SUCCESS: handleGroup (from activeSelection) ---"
      );
      return;
    }

    // Get all selectable objects on canvas
    const allObjects = fabricCanvas
      .getObjects()
      .filter(
        (obj) => obj.selectable && obj.visible && !(obj as any).isAlignmentGuide
      );

    if (allObjects.length < 2) {
      logger.canvas("--- ACTION FAILED: Need at least 2 objects to group ---");
      return;
    }

    logger.canvas(`--- Found ${allObjects.length} objects to group ---`);

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

    logger.canvas("--- ACTION SUCCESS: handleGroup (created new group) ---");
    // saveState(); // We can add this back later
  };

  const handleUngroup = async () => {
    logger.canvas("--- ACTION START: handleUngroup ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject || activeObject.type !== "group") {
      logger.canvas("--- ACTION FAILED: Selected object is not a group ---");
      return;
    }

    logger.canvas("--- Ungrouping selected group ---");

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
    logger.canvas(
      `--- ACTION SUCCESS: handleUngroup (ungrouped ${addedObjects.length} objects) ---`
    );

    // saveState(); // We can add this back later
  };

  const handleDelete = () => {
    logger.canvas("--- ACTION START: handleDelete ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) {
      logger.canvas("--- ACTION FAILED: No object selected to delete ---");
      return;
    }

    // Handle multiple selected objects (activeSelection)
    if (activeObject.type === "activeSelection") {
      const objects = (activeObject as any)._objects || [];
      objects.forEach((obj: fabric.Object) => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
      saveState();
      logger.canvas(
        `--- ACTION SUCCESS: handleDelete (deleted ${objects.length} objects) ---`
      );
      return;
    }

    // Handle single object
    fabricCanvas.remove(activeObject);
    fabricCanvas.renderAll();
    saveState();
    logger.canvas("--- ACTION SUCCESS: handleDelete (deleted 1 object) ---");
  };

  const handleCopy = () => {
    logger.canvas("DEBUG: handleCopy called");
    logger.canvas("--- ACTION START: handleCopy ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) {
      logger.canvas("--- ACTION FAILED: No object selected to copy ---");
      return;
    }

    // Simple copy implementation
    setClipboard(activeObject);
    logger.canvas("--- ACTION SUCCESS: handleCopy ---");
  };

  const handlePaste = (position?: { x: number; y: number }) => {
    logger.canvas("--- ACTION START: handlePaste ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    if (!clipboard) {
      logger.canvas(
        "--- ACTION FAILED: Nothing to paste (clipboard empty) ---"
      );
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
        logger.canvas(
          `Pasted component detected: ${
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

            logger.canvas(
              `--- ACTION SUCCESS: handlePaste with pin recreation at position (${pastePos.x}, ${pastePos.y}) ---`
            );
          } catch (error) {
            logger.canvas("Failed to recreate component pins:", error);
            // Fallback: add the cloned component as-is
            fabricCanvas.add(cloned);
            fabricCanvas.setActiveObject(cloned);
            fabricCanvas.renderAll();
            saveState();

            logger.canvas(
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
        logger.canvas(
          `--- ACTION SUCCESS: handlePaste at position (${pastePos.x}, ${pastePos.y}) ---`
        );
      }
    });
    // saveState(); // We can add this back later
  };

  const handleRotate = () => {
    logger.canvas("--- ACTION START: handleRotate ---");
    if (!fabricCanvas) {
      logger.canvas("--- ACTION FAILED: No canvas available ---");
      return;
    }

    const activeObject = fabricCanvas.getActiveObject();
    if (!activeObject) {
      logger.canvas("--- ACTION FAILED: No component selected to rotate ---");
      return;
    }

    // Only rotate components (not wires or other objects)
    if (!(activeObject as any).componentType) {
      logger.canvas(
        "--- ACTION FAILED: Selected object is not a component ---"
      );
      return;
    }

    // Rotate by 90 degrees
    const currentAngle = activeObject.angle || 0;
    const newAngle = (currentAngle + 90) % 360;

    activeObject.set("angle", newAngle);
    fabricCanvas.renderAll();
    saveState();

    logger.canvas(
      `--- ACTION SUCCESS: handleRotate (${currentAngle}° → ${newAngle}°) ---`
    );
  };

  const handleUndo = () => {
    logger.canvas("--- ACTION START: handleUndo ---");
    historyUndo();
    logger.canvas("--- ACTION END: handleUndo ---");
  };

  const handleRedo = () => {
    logger.canvas("--- ACTION START: handleRedo ---");
    historyRedo();
    logger.canvas("--- ACTION END: handleRedo ---");
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
    onComponentPicker: () => setIsComponentPickerVisible(true), // Add component picker
    onToggleWireMode: toggleWireMode, // Add wire mode toggle
  });

  // Right-click context menu handler - Completely refactored per specification
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const containerDiv = containerRef.current;

    const handleContextMenu = (e: MouseEvent) => {
      logger.canvas("IDEFabricCanvas handleContextMenu triggered!");
      logger.canvas("- Event:", e);
      logger.canvas("- clientX:", e.clientX, "clientY:", e.clientY);

      e.preventDefault(); // Stop the default browser menu

      // Use canvas.findTarget() to determine if user right-clicked on an object
      const target = fabricCanvas.findTarget(e);
      logger.canvas("- Fabric target found:", target);
      logger.canvas("- Target name:", target ? (target as any).name : "none");

      if (target && (target as any).name !== "workspace") {
        logger.canvas("Showing OBJECT context menu");
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
        logger.canvas("Setting OBJECT menu state:", objectMenuState);
        setMenuState(objectMenuState);
      } else {
        logger.canvas("Showing CANVAS context menu");
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
        logger.canvas("Setting CANVAS menu state:", canvasMenuState);
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
        Grid: {gridSize}px • C=components • R=rotate • W=wire ✓
      </div>

      {/* Memory usage indicator */}
      <div className="absolute bottom-2 right-2 bg-blue-600 bg-opacity-90 text-white px-2 py-1 rounded text-xs">
        <button
          onClick={() => {
            memoryMonitor.logMemoryUsage("Manual Check");
            optimizeCanvasMemory();
          }}
          className="hover:bg-blue-700 px-1 rounded text-xs"
          title="Click to check memory and optimize"
        >
          RAM: {memoryMonitor.getMemoryInfo()?.formattedUsage || "N/A"}
        </button>
      </div>

      {/* Netlist debug indicator */}
      {netlist.length > 0 && (
        <div className="absolute top-16 right-2 bg-purple-600 bg-opacity-90 text-white px-3 py-2 rounded text-sm font-medium max-w-xs">
          <div className="text-xs opacity-80 mb-1">Electrical Nets:</div>
          {netlist.slice(0, 3).map((net: any, index: number) => (
            <div key={net.netId} className="text-xs">
              {net.netId}: {net.connections.length} pins
            </div>
          ))}
          {netlist.length > 3 && (
            <div className="text-xs opacity-60">
              ...and {netlist.length - 3} more
            </div>
          )}
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

      {/* Component Picker Overlay */}
      <ComponentPickerOverlay
        isVisible={isComponentPickerVisible}
        onClose={() => setIsComponentPickerVisible(false)}
      />
    </div>
  );
}
