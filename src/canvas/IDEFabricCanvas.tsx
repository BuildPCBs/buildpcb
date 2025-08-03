"use client";

import React, { useRef, useEffect, useState } from "react";
import * as fabric from "fabric";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasHotkeys } from "./hooks/useCanvasHotkeys";
import { useWiringTool } from "./hooks/useWiringTool";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { canvasCommandManager } from "./canvas-command-manager";
import { createSimpleComponent } from "./SimpleComponentFactory";
import { createSVGComponent } from "./SVGComponentFactory";
import { ContextMenu } from "./ui/ContextMenu";
import { HorizontalRuler } from "./ui/HorizontalRuler";
import { VerticalRuler } from "./ui/VerticalRuler";

interface IDEFabricCanvasProps {
  className?: string;
}

export function IDEFabricCanvas({ className = "" }: IDEFabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [areRulersVisible, setAreRulersVisible] = useState(false);

  // Context menu and clipboard state - Refactored per specification
  const [menuState, setMenuState] = useState({
    visible: false,
    x: 0,
    y: 0,
    type: "object" as "object" | "canvas",
    target: null as fabric.FabricObject | null,
  });
  const [clipboard, setClipboard] = useState<fabric.Object | null>(null);

  // Use viewport control hooks
  useCanvasZoom(fabricCanvas);
  const panState = useCanvasPan(fabricCanvas);
  const viewportState = useCanvasViewport(fabricCanvas);

  // Wire drawing tool - Professional-grade implementation
  const wiringTool = useWiringTool({
    canvas: fabricCanvas,
    enabled: !!fabricCanvas,
  });

  // Ruler dimensions and grid settings
  const rulerSize = 30;
  const gridSize = 10; // Grid spacing in pixels

  // Helper function to create background grid pattern
  const createGridPattern = (canvas: fabric.Canvas, gridSize: number) => {
    // Create a temporary canvas for the pattern
    const patternCanvas = document.createElement("canvas");
    const patternCtx = patternCanvas.getContext("2d");
    if (!patternCtx) return null;

    // Set pattern canvas size to grid size
    patternCanvas.width = gridSize;
    patternCanvas.height = gridSize;

    // Draw grid lines
    patternCtx.strokeStyle = "#E0E0E0";
    patternCtx.lineWidth = 0.5;
    patternCtx.beginPath();

    // Vertical line
    patternCtx.moveTo(gridSize, 0);
    patternCtx.lineTo(gridSize, gridSize);

    // Horizontal line
    patternCtx.moveTo(0, gridSize);
    patternCtx.lineTo(gridSize, gridSize);

    patternCtx.stroke();

    // Create Fabric.js pattern
    return new fabric.Pattern({
      source: patternCanvas,
      repeat: "repeat",
    });
  };

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Get initial container dimensions
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Account for ruler space
    const canvasWidth = rect.width - rulerSize;
    const canvasHeight = rect.height - rulerSize;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "#FFFFFF", // White background for better grid visibility
    });

    // Create and apply grid pattern
    const gridPattern = createGridPattern(canvas, gridSize);
    if (gridPattern) {
      canvas.backgroundColor = gridPattern;
      canvas.renderAll();
    }

    setFabricCanvas(canvas);
    setCanvasDimensions({ width: canvasWidth, height: canvasHeight });

    // Register canvas with command manager
    canvasCommandManager.setCanvas(canvas);

    // Setup simple component handler
    setupComponentHandler(canvas);

    // Cleanup function to prevent memory leaks
    return () => {
      canvasCommandManager.setCanvas(null);
      canvas.dispose();
    };
  }, [rulerSize]);

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
    fabricCanvas.on("selection:created", handleSelectionCreated);
    fabricCanvas.on("selection:updated", handleSelectionUpdated);
    fabricCanvas.on("selection:cleared", handleSelectionCleared);

    return () => {
      fabricCanvas.off("object:moving", handleObjectMoving);
      fabricCanvas.off("object:modified", handleObjectMoved);
      fabricCanvas.off("selection:created", handleSelectionCreated);
      fabricCanvas.off("selection:updated", handleSelectionUpdated);
      fabricCanvas.off("selection:cleared", handleSelectionCleared);
    };
  }, [fabricCanvas, wiringTool]);

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
      console.log(
        `--- ACTION SUCCESS: handleDelete (deleted ${objects.length} objects) ---`
      );
      return;
    }

    // Handle single object
    fabricCanvas.remove(activeObject);
    fabricCanvas.renderAll();
    console.log("--- ACTION SUCCESS: handleDelete (deleted 1 object) ---");
    // saveState(); // We can add this back later
  };

  const handleCopy = () => {
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

  const handlePaste = () => {
    console.log("--- ACTION START: handlePaste ---");
    if (!fabricCanvas) {
      console.log("--- ACTION FAILED: No canvas available ---");
      return;
    }

    if (!clipboard) {
      console.log("--- ACTION FAILED: Nothing to paste (clipboard empty) ---");
      return;
    }

    // Simple paste implementation - clone the object
    clipboard.clone().then((cloned: any) => {
      cloned.set({
        left: cloned.left + 20,
        top: cloned.top + 20,
      });
      fabricCanvas.add(cloned);
      fabricCanvas.setActiveObject(cloned);
      fabricCanvas.renderAll();
      console.log("--- ACTION SUCCESS: handlePaste ---");
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

    console.log(
      `--- ACTION SUCCESS: handleRotate (${currentAngle}° → ${newAngle}°) ---`
    );
    // saveState(); // We can add this back later
  };

  const handleUndo = () => {
    console.log("--- ACTION START: handleUndo ---");
    console.log(
      "--- ACTION PLACEHOLDER: Undo functionality to be implemented ---"
    );
    console.log("--- ACTION END: handleUndo ---");
  };

  const handleRedo = () => {
    console.log("--- ACTION START: handleRedo ---");
    console.log(
      "--- ACTION PLACEHOLDER: Redo functionality to be implemented ---"
    );
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
  });

  // Right-click context menu handler - Completely refactored per specification
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const containerDiv = containerRef.current;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Stop the default browser menu

      // Use canvas.findTarget() to determine if user right-clicked on an object
      const target = fabricCanvas.findTarget(e);

      if (target && (target as any).name !== "workspace") {
        // Case A: Right-Click on an Object
        // Make that object the active selection on the canvas
        fabricCanvas.setActiveObject(target);
        fabricCanvas.renderAll();

        // Show context menu with "Copy" and "Delete" options
        setMenuState({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          type: "object",
          target: target,
        });
      } else {
        // Case B: Right-Click on Empty Canvas
        // Show context menu with only "Paste" option
        setMenuState({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          type: "canvas",
          target: null,
        });
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Close context menu on any regular click
      if (e.button !== 2) {
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

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
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
        onPaste={handlePaste}
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
    </div>
  );
}

// SIMPLE COMPONENT HANDLER - Add this at the end
let isComponentHandlerSetup = false;

export function setupComponentHandler(canvas: fabric.Canvas) {
  if (isComponentHandlerSetup) return;

  console.log("� Setting up SVG component handler...");

  canvasCommandManager.on(
    "component:add",
    (payload: {
      type: string;
      svgPath: string;
      name: string;
      x?: number;
      y?: number;
    }) => {
      console.log("🎯 SVG: Component command received for", payload.name);

      // New intelligent component creation logic
      const createComponent = (componentInfo: typeof payload) => {
        if (!canvas) return;

        console.log(
          `🧠 INTELLIGENT: Creating ${componentInfo.name} with new intelligent SVG parsing`
        );

        fetch(componentInfo.svgPath)
          .then((response) => response.text())
          .then((svgString) => {
            return fabric.loadSVGFromString(svgString);
          })
          .then((result) => {
            const objects = result.objects.filter((obj) => !!obj);
            const pinsFromSVG: fabric.FabricObject[] = [];
            const symbolParts: fabric.FabricObject[] = [];

            // 1. Separate the loaded parts into PINS and SYMBOL pieces
            objects.forEach((obj: any) => {
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
            const svgSymbol = new fabric.Group(symbolParts, {
              originX: "center",
              originY: "center",
            });

            // TOP BREAD: Visible, interactive pin circles (transparent green)
            const interactivePins = pinsFromSVG.map((pin, index) => {
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

              // Add the pin metadata that the wiring tool expects
              interactivePin.set("pin", true);
              interactivePin.set("pinData", invisiblePinData[index]);
              interactivePin.set("data", {
                type: "pin",
                componentId: `component_${Date.now()}`,
                pinId: `pin${index + 1}`,
                pinNumber: index + 1,
                isConnectable: true,
              });

              return interactivePin;
            });

            // THE GOLDEN RULE: Lock all three layers together into ONE inseparable group
            // This is the COMPONENT SANDWICH - it moves as one unit forever
            const componentSandwich = new fabric.Group(
              [svgSymbol, ...interactivePins],
              {
                left: componentInfo.x || canvas.getVpCenter().x,
                top: componentInfo.y || canvas.getVpCenter().y,
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

            // Store the invisible pin data and component metadata
            componentSandwich.set("componentType", componentInfo.type);
            componentSandwich.set("invisiblePinData", invisiblePinData);
            componentSandwich.set("data", {
              type: "component",
              componentType: componentInfo.type,
              componentName: componentInfo.name,
              pins: interactivePins.map((_, index) => `pin${index + 1}`),
              isComponentSandwich: true, // Mark this as a proper sandwich
            });

            // 5. Add the COMPONENT SANDWICH to the canvas - physically impossible to separate
            canvas.add(componentSandwich);
            canvas.renderAll();

            console.log(
              `🥪 COMPONENT SANDWICH: Added ${componentInfo.name} with ${interactivePins.length} permanently attached pins!`
            );
          })
          .catch((error) => {
            console.error(
              `❌ INTELLIGENT: Failed to load ${componentInfo.svgPath}:`,
              error
            );
          });
      };

      // Use the new createComponent function
      createComponent(payload);
    }
  );

  isComponentHandlerSetup = true;
}
