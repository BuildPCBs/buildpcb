"use client";

import React, { useRef, useEffect, useState } from "react";
import * as fabric from "fabric";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasHotkeys } from "./hooks/useCanvasHotkeys";
import { useWiringTool } from "./hooks/useWiringTool";
import { canvasCommandManager } from "./canvas-command-manager";
import { ContextMenu } from "./ui/ContextMenu";

interface IDEFabricCanvasProps {
  className?: string;
}

export function IDEFabricCanvas({ className = "" }: IDEFabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

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

  // Wire drawing tool - Professional-grade implementation
  const wiringTool = useWiringTool({
    canvas: fabricCanvas,
    enabled: !!fabricCanvas,
  });

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    // Get initial container dimensions
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: rect.width,
      height: rect.height,
      // Remove backgroundColor - canvas should be transparent initially
    });

    setFabricCanvas(canvas);

    // Register canvas with command manager
    canvasCommandManager.setCanvas(canvas);

    // Cleanup function to prevent memory leaks
    return () => {
      canvasCommandManager.setCanvas(null);
      canvas.dispose();
    };
  }, []);

  // Dynamic canvas resizing with ResizeObserver
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Only resize if dimensions actually changed
        if (width > 0 && height > 0) {
          fabricCanvas.setDimensions({ width, height });
          fabricCanvas.renderAll();

          console.log(`Canvas resized to: ${width}x${height}`);
        }
      }
    });

    // Start observing the container
    resizeObserver.observe(containerRef.current);

    // Cleanup function
    return () => {
      resizeObserver.disconnect();
    };
  }, [fabricCanvas]);

  // Additional window resize listener as backup
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const handleWindowResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          fabricCanvas.setDimensions({
            width: rect.width,
            height: rect.height,
          });
          fabricCanvas.renderAll();
        }
      }
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [fabricCanvas]);

  // Copy/Paste handler functions - Completely refactored per specification
  const handleCopy = () => {
    if (!fabricCanvas) return;

    // Get active object from menu target or canvas active object
    const activeObject = menuState.target || fabricCanvas.getActiveObject();
    if (activeObject) {
      // Correct asynchronous copy - Use Promise-based clone for Fabric.js 6.x
      activeObject.clone().then((cloned: fabric.Object) => {
        setClipboard(cloned);
        console.log("Object copied to clipboard");
      });
    }
  };

  const handlePaste = (pasteX?: number, pasteY?: number) => {
    if (!fabricCanvas || !clipboard) return;

    // Correct asynchronous paste - Use Promise-based clone
    clipboard.clone().then((cloned: fabric.Object) => {
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
        // Paste in center of current viewport or offset from last paste (keyboard shortcut)
        const center = fabricCanvas.getCenter();
        targetX = center.left + Math.random() * 20 - 10; // Small random offset
        targetY = center.top + Math.random() * 20 - 10;
      }

      cloned.set({
        left: targetX,
        top: targetY,
      });

      fabricCanvas.add(cloned);
      fabricCanvas.setActiveObject(cloned);
      fabricCanvas.renderAll();
      console.log("Object pasted from clipboard");
    });
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
      <canvas ref={canvasRef} />

      {/* Context Menu */}
      <ContextMenu
        visible={menuState.visible}
        top={menuState.y}
        left={menuState.x}
        menuType={menuState.type}
        onCopy={handleCopy}
        onPaste={() => handlePaste(menuState.x, menuState.y)}
        onDelete={handleDelete}
        canPaste={clipboard !== null}
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
