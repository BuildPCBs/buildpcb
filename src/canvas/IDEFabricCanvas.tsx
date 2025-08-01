"use client";

import React, { useRef, useEffect, useState } from "react";
import * as fabric from "fabric";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasHotkeys } from "./hooks/useCanvasHotkeys";
import { canvasCommandManager } from "./canvas-command-manager";
import { ContextMenu } from "./ui/ContextMenu";

interface IDEFabricCanvasProps {
  className?: string;
}

export function IDEFabricCanvas({ className = "" }: IDEFabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  // Context menu and clipboard state - Updated per specification
  const [contextMenuState, setContextMenuState] = useState({
    visible: false,
    top: 0,
    left: 0,
    target: null as fabric.FabricObject | null,
  });
  const [clipboard, setClipboard] = useState<fabric.Object | null>(null);

  // Use viewport control hooks
  useCanvasZoom(fabricCanvas);
  const panState = useCanvasPan(fabricCanvas);

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

  // Copy/Paste handler functions - Updated for modern Fabric.js API
  const handleCopy = () => {
    if (!fabricCanvas) return;

    // Get active object from context menu target or canvas active object
    const activeObject =
      contextMenuState.target || fabricCanvas.getActiveObject();
    if (activeObject) {
      // Use modern Promise-based clone method for Fabric.js 6.x
      activeObject.clone().then((cloned: fabric.Object) => {
        setClipboard(cloned);
        console.log("Object copied to clipboard");
      });
    }
  };

  const handlePaste = () => {
    if (!fabricCanvas || !clipboard) return;

    // Clone the clipboard object again for multiple pastes
    clipboard.clone().then((cloned: fabric.Object) => {
      // Position the new object with slight offset
      cloned.set({
        left: (cloned.left || 0) + 10,
        top: (cloned.top || 0) + 10,
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

  // Cross-platform keyboard shortcuts - Added after handler functions
  useCanvasHotkeys({
    onCopy: handleCopy,
    onPaste: handlePaste,
    onDelete: handleDelete,
    enabled: !!fabricCanvas,
  });

  // Right-click context menu handler - Updated per specification
  useEffect(() => {
    if (!fabricCanvas || !containerRef.current) return;

    const containerDiv = containerRef.current;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Stop the default browser menu

      // Use canvas.findTarget() to determine if user right-clicked on an object
      const target = fabricCanvas.findTarget(e);

      if (target && (target as any).name !== "workspace") {
        // Update contextMenuState to show menu at cursor position and store target
        setContextMenuState({
          visible: true,
          top: e.clientY,
          left: e.clientX,
          target: target,
        });
      } else {
        // Hide context menu if clicking outside objects
        setContextMenuState((prev) => ({ ...prev, visible: false }));
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Close context menu on any regular click
      if (e.button !== 2) {
        setContextMenuState((prev) => ({ ...prev, visible: false }));
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
        visible={contextMenuState.visible}
        top={contextMenuState.top}
        left={contextMenuState.left}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDelete}
        canPaste={clipboard !== null}
        onClose={() =>
          setContextMenuState((prev) => ({ ...prev, visible: false }))
        }
      />

      {/* Optional debug info */}
      {panState.isPanMode && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
          Pan Mode {panState.isDragging ? "- Dragging" : ""}
        </div>
      )}
    </div>
  );
}
