"use client";

import React, { useRef, useEffect, useState } from "react";
import * as fabric from "fabric";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasHotkeys } from "./hooks/useCanvasHotkeys";
import { useWiringTool } from "./hooks/useWiringTool";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { canvasCommandManager } from "./canvas-command-manager";
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
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
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
    const patternCanvas = document.createElement('canvas');
    const patternCtx = patternCanvas.getContext('2d');
    if (!patternCtx) return null;

    // Set pattern canvas size to grid size
    patternCanvas.width = gridSize;
    patternCanvas.height = gridSize;

    // Draw grid lines
    patternCtx.strokeStyle = '#E0E0E0';
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
      repeat: 'repeat'
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
      backgroundColor: '#FFFFFF', // White background for better grid visibility
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
          fabricCanvas.setDimensions({ width: canvasWidth, height: canvasHeight });
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

    console.log("🔗 Setting up component-wire follow logic, ruler visibility, snap-to-grid, and alignment guides");

    // Helper function to snap coordinate to grid
    const snapToGrid = (value: number, gridSize: number) => {
      return Math.round(value / gridSize) * gridSize;
    };

    // Helper function to remove all alignment guides
    const removeAlignmentGuides = () => {
      const guidesToRemove = fabricCanvas.getObjects().filter(obj => (obj as any).isAlignmentGuide);
      guidesToRemove.forEach(guide => fabricCanvas.remove(guide));
    };

    // Helper function to create alignment guide line
    const createAlignmentGuide = (x1: number, y1: number, x2: number, y2: number) => {
      const line = new fabric.Line([x1, y1, x2, y2], {
        stroke: '#FF0000',
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
      const otherObjects = fabricCanvas.getObjects().filter(obj => 
        obj !== movingObject && 
        !(obj as any).isAlignmentGuide &&
        obj.visible &&
        obj.selectable
      );

      otherObjects.forEach(obj => {
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
            Math.max(movingBounds.top + movingBounds.height, objBounds.top + objBounds.height) + 20
          );
          fabricCanvas.add(guide);
        }

        // Center X align
        if (Math.abs(movingCenterX - objCenterX) <= tolerance) {
          const guide = createAlignmentGuide(
            objCenterX, 
            Math.min(movingBounds.top, objBounds.top) - 20,
            objCenterX, 
            Math.max(movingBounds.top + movingBounds.height, objBounds.top + objBounds.height) + 20
          );
          fabricCanvas.add(guide);
        }

        // Right edges align
        if (Math.abs((movingBounds.left + movingBounds.width) - (objBounds.left + objBounds.width)) <= tolerance) {
          const guide = createAlignmentGuide(
            objBounds.left + objBounds.width, 
            Math.min(movingBounds.top, objBounds.top) - 20,
            objBounds.left + objBounds.width, 
            Math.max(movingBounds.top + movingBounds.height, objBounds.top + objBounds.height) + 20
          );
          fabricCanvas.add(guide);
        }

        // Horizontal alignment guides (Y-axis alignments)
        // Top edges align
        if (Math.abs(movingBounds.top - objBounds.top) <= tolerance) {
          const guide = createAlignmentGuide(
            Math.min(movingBounds.left, objBounds.left) - 20,
            objBounds.top,
            Math.max(movingBounds.left + movingBounds.width, objBounds.left + objBounds.width) + 20,
            objBounds.top
          );
          fabricCanvas.add(guide);
        }

        // Center Y align
        if (Math.abs(movingCenterY - objCenterY) <= tolerance) {
          const guide = createAlignmentGuide(
            Math.min(movingBounds.left, objBounds.left) - 20,
            objCenterY,
            Math.max(movingBounds.left + movingBounds.width, objBounds.left + objBounds.width) + 20,
            objCenterY
          );
          fabricCanvas.add(guide);
        }

        // Bottom edges align
        if (Math.abs((movingBounds.top + movingBounds.height) - (objBounds.top + objBounds.height)) <= tolerance) {
          const guide = createAlignmentGuide(
            Math.min(movingBounds.left, objBounds.left) - 20,
            objBounds.top + objBounds.height,
            Math.max(movingBounds.left + movingBounds.width, objBounds.left + objBounds.width) + 20,
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
      if (movingObject && movingObject.left !== undefined && movingObject.top !== undefined) {
        const snappedLeft = snapToGrid(movingObject.left, gridSize);
        const snappedTop = snapToGrid(movingObject.top, gridSize);
        
        movingObject.set({
          left: snappedLeft,
          top: snappedTop
        });
      }

      // PART 3: Smart Alignment Guides
      if (movingObject) {
        checkAlignments(movingObject);
      }
      
      // PART 2: Only track component movement (not wire movement) for wire following
      if (movingObject && (movingObject as any).componentType && movingObject.type === "group") {
        // This is a component being moved - update connected wires
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
      if (movedObject && (movedObject as any).componentType && movedObject.type === "group") {
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
    fabricCanvas.on('object:moving', handleObjectMoving);
    fabricCanvas.on('object:modified', handleObjectMoved);
    fabricCanvas.on('selection:created', handleSelectionCreated);
    fabricCanvas.on('selection:updated', handleSelectionUpdated);
    fabricCanvas.on('selection:cleared', handleSelectionCleared);

    return () => {
      fabricCanvas.off('object:moving', handleObjectMoving);
      fabricCanvas.off('object:modified', handleObjectMoved);
      fabricCanvas.off('selection:created', handleSelectionCreated);
      fabricCanvas.off('selection:updated', handleSelectionUpdated);
      fabricCanvas.off('selection:cleared', handleSelectionCleared);
    };
  }, [fabricCanvas, wiringTool]);

  // PART 1: The New handleCopy() - Save the Blueprint
  const handleCopy = () => {
    if (!fabricCanvas) return;

    // Get active object from menu target or canvas active object
    const activeObject = menuState.target || fabricCanvas.getActiveObject();
    
    // Only create blueprints for component groups
    if (activeObject && (activeObject as any).componentType && activeObject.type === 'group') {
      console.log("📋 Creating component blueprint for copy");
      
      // Create a simple JavaScript blueprint object
      const blueprint = {
        type: 'component',
        componentType: (activeObject as any).componentType, // e.g., 'resistor'
        position: {
          left: activeObject.left || 0,
          top: activeObject.top || 0,
        },
        angle: activeObject.angle || 0,
        properties: {
          // Extract any important properties from the Properties Panel
          componentId: (activeObject as any).componentId,
          metadata: (activeObject as any).metadata || {},
          // Add any other custom properties here
        },
        // Store creation timestamp for unique IDs
        timestamp: Date.now(),
      };

      // Save the blueprint to clipboard (NOT the Fabric.js object)
      setClipboard(blueprint as any);
      console.log("✅ Component blueprint saved to clipboard:", blueprint);
    } else {
      console.log("⚠️ Cannot copy: Selected object is not a component");
    }
  };

  // PART 2: The New handlePaste() - Build from the Blueprint
  const handlePaste = (pasteX?: number, pasteY?: number) => {
    if (!fabricCanvas || !clipboard) return;

    // Check if clipboard contains a component blueprint
    const blueprint = clipboard as any;
    if (blueprint.type === 'component' && blueprint.componentType) {
      console.log("🏗️ Building component from blueprint:", blueprint);

      // Calculate paste position
      let targetX: number;
      let targetY: number;

      if (pasteX !== undefined && pasteY !== undefined) {
        // Paste at specific coordinates (from context menu right-click position)
        // Convert screen coordinates to canvas coordinates
        const rect = fabricCanvas.getElement().getBoundingClientRect();
        const pointer = new fabric.Point(pasteX - rect.left, pasteY - rect.top);
        const canvasPointer = fabric.util.transformPoint(pointer, fabric.util.invertTransform(fabricCanvas.viewportTransform));
        targetX = canvasPointer.x;
        targetY = canvasPointer.y;
      } else {
        // Paste with slight offset for keyboard paste
        targetX = blueprint.position.left + 20;
        targetY = blueprint.position.top + 20;
      }

      // Deselect anything currently selected
      fabricCanvas.discardActiveObject();

      // Component Creation Factory - Use the original creation functions
      const createComponentFromBlueprint = (componentType: string, x: number, y: number) => {
        switch (componentType) {
          case 'resistor':
            canvasCommandManager.executeCommand("add_resistor", { x, y });
            break;
          // Future component types can be added here:
          // case 'capacitor':
          //   canvasCommandManager.executeCommand("add_capacitor", { x, y });
          //   break;
          // case 'led':
          //   canvasCommandManager.executeCommand("add_led", { x, y });
          //   break;
          default:
            console.log("⚠️ Component type not supported yet:", componentType);
            return false;
        }
        return true;
      };

      // Create the component from blueprint
      if (createComponentFromBlueprint(blueprint.componentType, targetX, targetY)) {
        // Apply the original angle and properties after creation
        setTimeout(() => {
          const newComponent = fabricCanvas.getActiveObject();
          if (newComponent) {
            // Apply original rotation
            if (blueprint.angle) {
              newComponent.set({ angle: blueprint.angle });
            }
            
            // Apply any custom properties from the blueprint
            if (blueprint.properties) {
              Object.keys(blueprint.properties).forEach(key => {
                if (key !== 'componentId') { // Don't copy the original ID
                  (newComponent as any)[key] = blueprint.properties[key];
                }
              });
            }
            
            fabricCanvas.renderAll();
          }
        }, 10); // Small delay to ensure component is fully created

        console.log("✅ Component rebuilt from blueprint and pasted successfully!");
      }
    } else {
      console.log("⚠️ Clipboard does not contain a valid component blueprint");
    }
  };

  const handleDelete = () => {
    if (!fabricCanvas) return;

    const activeObject = fabricCanvas.getActiveObject();
    if (activeObject) {
      fabricCanvas.remove(activeObject);
      fabricCanvas.renderAll();
      console.log("Object deleted");
    }
  };

  // Cross-platform keyboard shortcuts - Updated to handle new paste signature
  useCanvasHotkeys({
    canvas: fabricCanvas,
    onCopy: handleCopy,
    onPaste: () => handlePaste(), // No coordinates for keyboard paste
    onDelete: handleDelete,
    enabled: !!fabricCanvas,
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
          type: 'object',
          target: target,
        });
      } else {
        // Case B: Right-Click on Empty Canvas
        // Show context menu with only "Paste" option
        setMenuState({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          type: 'canvas',
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
            width: areRulersVisible ? canvasDimensions.width : '100%',
            height: areRulersVisible ? canvasDimensions.height : '100%',
          }}
        >
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        visible={menuState.visible}
        top={menuState.y}
        left={menuState.x}
        menuType={menuState.type}
        onCopy={handleCopy}
        onPaste={() => handlePaste(menuState.x, menuState.y)}
        onDelete={handleDelete}
        canPaste={clipboard !== null && (clipboard as any).type === 'component'}
        onClose={() =>
          setMenuState((prev) => ({ ...prev, visible: false }))
        }
      />

      {/* Optional debug info */}
      {panState.isPanMode && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
          Pan Mode {panState.isDragging ? "- Dragging" : ""}
        </div>
      )}

      {/* Grid and Snap indicator */}
      <div className="absolute bottom-2 left-2 bg-green-600 bg-opacity-90 text-white px-2 py-1 rounded text-xs">
        Grid: {gridSize}px • Snap-to-Grid Active
      </div>
      
      {/* Wire mode indicator - Professional-grade wiring tool */}
      {wiringTool.isWireMode && (
        <div className="absolute top-2 right-2 bg-blue-600 bg-opacity-90 text-white px-3 py-2 rounded text-sm font-medium">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>
              {wiringTool.wireState === 'idle' && 'Wire Mode - Click pin to start'}
              {wiringTool.wireState === 'drawing' && 'Drawing - Click to add waypoint'}
              {wiringTool.wireState === 'finishing' && 'Finishing - Click pin to complete'}
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
