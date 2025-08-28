"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as fabric from "fabric";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useView } from "@/contexts/ViewContext";
import { addFootprintToCanvas, removeFootprintFromCanvas, updateFootprintPosition } from "./FootprintRenderer";
import { OptimizedRatsnestRenderer } from "./OptimizedRatsnestRenderer";
import { useCrossProbing } from "@/hooks/useCrossProbing";
import { RatsnestDemo } from "@/components/ui/RatsnestDemo";
import { CanvasErrorBoundary } from "@/components/ui/CanvasErrorBoundary";

interface PCBCanvasProps {
  className?: string;
}

export function PCBCanvas({ className = "" }: PCBCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasInstanceRef = useRef<fabric.Canvas | null>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const { sharedComponents, connections, getStats, updateSharedComponent } = useView();
  
  // Track rendered footprints to avoid duplicates
  const [renderedFootprints, setRenderedFootprints] = useState<Set<string>>(new Set());
  
  // Performance monitoring
  const [performanceStats, setPerformanceStats] = useState({ fps: 0, renderTime: 0 });
  
  // Enhanced ratsnest renderer
  const ratsnestRenderer = useRef<OptimizedRatsnestRenderer | null>(null);
  
  // Cross-probing with visual feedback
  const crossProbing = useCrossProbing(
    canvasInstanceRef.current,
    sharedComponents,
    {
      enabled: true,
      highlightColor: 'rgba(74, 144, 226, 0.3)',
      highlightDuration: 1500,
      zoomFactor: 1.3,
      animationDuration: 250,
    },
    {
      onComponentHover: (componentId) => {
        if (componentId) {
          console.log(`🎯 Hovering over component: ${componentId}`);
        }
      },
      onComponentClick: (componentId) => {
        console.log(`🎯 Clicked component: ${componentId}`);
      },
    }
  );

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    console.log("🔧 Initializing PCB Canvas...");

    // Create Fabric.js canvas instance
    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: "#0f172a", // Dark slate background for PCB view
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: true,
      enableRetinaScaling: true,
      imageSmoothingEnabled: true,
    });

    canvasInstanceRef.current = fabricCanvas;

    // Initialize optimized ratsnest renderer
    ratsnestRenderer.current = new OptimizedRatsnestRenderer(fabricCanvas);

    // Create PCB board outline
    const createPCBBoard = () => {
      const boardWidth = 400;
      const boardHeight = 300;
      const centerX = fabricCanvas.getWidth() / 2;
      const centerY = fabricCanvas.getHeight() / 2;

      // PCB substrate (green)
      const pcbBoard = new fabric.Rect({
        left: centerX - boardWidth / 2,
        top: centerY - boardHeight / 2,
        width: boardWidth,
        height: boardHeight,
        fill: "#1e5e20", // Darker PCB green
        stroke: "#22c55e",
        strokeWidth: 3,
        rx: 8,
        ry: 8,
        selectable: false,
        evented: false,
        name: "pcb-board",
        shadow: new fabric.Shadow({
          color: "#000000",
          blur: 20,
          offsetX: 0,
          offsetY: 4,
        }),
      });

      // PCB holes for mounting (common in PCBs)
      const holeRadius = 4;
      const holeMargin = 20;

      const holes = [
        // Top-left
        new fabric.Circle({
          left: centerX - boardWidth / 2 + holeMargin,
          top: centerY - boardHeight / 2 + holeMargin,
          radius: holeRadius,
          fill: "#000",
          selectable: false,
          evented: false,
          originX: "center",
          originY: "center",
        }),
        // Top-right
        new fabric.Circle({
          left: centerX + boardWidth / 2 - holeMargin,
          top: centerY - boardHeight / 2 + holeMargin,
          radius: holeRadius,
          fill: "#000",
          selectable: false,
          evented: false,
          originX: "center",
          originY: "center",
        }),
        // Bottom-left
        new fabric.Circle({
          left: centerX - boardWidth / 2 + holeMargin,
          top: centerY + boardHeight / 2 - holeMargin,
          radius: holeRadius,
          fill: "#000",
          selectable: false,
          evented: false,
          originX: "center",
          originY: "center",
        }),
        // Bottom-right
        new fabric.Circle({
          left: centerX + boardWidth / 2 - holeMargin,
          top: centerY + boardHeight / 2 - holeMargin,
          radius: holeRadius,
          fill: "#000",
          selectable: false,
          evented: false,
          originX: "center",
          originY: "center",
        }),
      ];

      // Add board and holes to canvas
      fabricCanvas.add(pcbBoard);
      holes.forEach(hole => fabricCanvas.add(hole));

      // Add grid pattern for alignment
      const createGrid = () => {
        const gridSpacing = 10; // mm equivalent
        const gridColor = "#22c55e";
        const gridOpacity = 0.1;

        for (let x = 0; x <= fabricCanvas.getWidth(); x += gridSpacing) {
          const line = new fabric.Line([x, 0, x, fabricCanvas.getHeight()], {
            stroke: gridColor,
            strokeWidth: 0.5,
            opacity: gridOpacity,
            selectable: false,
            evented: false,
          });
          fabricCanvas.add(line);
        }

        for (let y = 0; y <= fabricCanvas.getHeight(); y += gridSpacing) {
          const line = new fabric.Line([0, y, fabricCanvas.getWidth(), y], {
            stroke: gridColor,
            strokeWidth: 0.5,
            opacity: gridOpacity,
            selectable: false,
            evented: false,
          });
          fabricCanvas.add(line);
        }
      };

      createGrid();
      fabricCanvas.renderAll();
    };

    createPCBBoard();
    
    // Add snap-to-grid functionality for PCB components
    const gridSize = 10; // PCB grid size in pixels (matches visual grid)
    
    // Helper function to snap coordinate to grid
    const snapToGrid = (value: number, gridSize: number) => {
      return Math.round(value / gridSize) * gridSize;
    };
    
    // Handle object movement with snap-to-grid
    const handleObjectMoving = (e: any) => {
      const movingObject = e.target;
      
      // Only snap footprint components to grid
      if (movingObject && (movingObject as any).componentId) {
        if (
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
      }
    };
    
    // Handle object movement completion
    const handleObjectMoved = (e: any) => {
      const movedObject = e.target;
      
      // Update shared component PCB position when footprint is moved
      if (movedObject && (movedObject as any).componentId && updateSharedComponent) {
        const componentId = (movedObject as any).componentId;
        const newX = movedObject.left || 0;
        const newY = movedObject.top || 0;
        
        console.log(`🔄 PCB: Updating component ${componentId} position to (${newX}, ${newY})`);
        
        // Update the shared component's PCB position
        updateSharedComponent(componentId, {
          pcbPosition: { x: newX, y: newY }
        });
      }
    };
    
    // Set up event listeners
    fabricCanvas.on("object:moving", handleObjectMoving);
    fabricCanvas.on("object:modified", handleObjectMoved);
    
    setIsCanvasReady(true);

    // Handle canvas resize
    const handleResize = () => {
      fabricCanvas.setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      fabricCanvas.renderAll();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      // Clean up event listeners
      if (fabricCanvas) {
        fabricCanvas.off("object:moving", handleObjectMoving);
        fabricCanvas.off("object:modified", handleObjectMoved);
      }
      
      window.removeEventListener("resize", handleResize);
      fabricCanvas.dispose();
    };
  }, []);

  // Canvas interaction hooks
  useCanvasZoom(canvasInstanceRef.current);
  const pan = useCanvasPan(canvasInstanceRef.current);
  useCanvasViewport(canvasInstanceRef.current);

  // Sync shared components with PCB footprints
  useEffect(() => {
    if (!canvasInstanceRef.current || !isCanvasReady) return;

    console.log(`🔄 PCB Canvas: Syncing ${sharedComponents.length} shared components`);

    const canvas = canvasInstanceRef.current;
    const currentFootprintIds = new Set(renderedFootprints);
    const newFootprintIds = new Set<string>();

    // Add/update footprints for all shared components
    sharedComponents.forEach(component => {
      if (component.footprintKey && component.pcbPosition) {
        newFootprintIds.add(component.id);

        // If footprint doesn't exist, create it
        if (!currentFootprintIds.has(component.id)) {
          console.log(`➕ Adding footprint for ${component.name} (${component.id})`);
          
          const footprint = addFootprintToCanvas(
            canvas,
            component.id,
            component.footprintKey,
            component.pcbPosition.x,
            component.pcbPosition.y
          );

          if (footprint) {
            setRenderedFootprints(prev => new Set(prev).add(component.id));
          }
        } else {
          // Update existing footprint position if needed
          updateFootprintPosition(canvas, component.id, component.pcbPosition.x, component.pcbPosition.y);
        }
      }
    });

    // Remove footprints for components that no longer exist
    currentFootprintIds.forEach(footprintId => {
      if (!newFootprintIds.has(footprintId)) {
        console.log(`➖ Removing footprint for component ${footprintId}`);
        removeFootprintFromCanvas(canvas, footprintId);
        setRenderedFootprints(prev => {
          const newSet = new Set(prev);
          newSet.delete(footprintId);
          return newSet;
        });
      }
    });

  }, [sharedComponents, isCanvasReady, renderedFootprints]);

  // Enhanced ratsnest rendering with performance optimization
  useEffect(() => {
    if (!canvasInstanceRef.current || !isCanvasReady || !ratsnestRenderer.current) return;

    console.log(`🕸️ PCB Canvas: Updating ratsnest with ${connections.length} connections`);

    // Use optimized ratsnest renderer
    ratsnestRenderer.current.updateRatsnest(connections, sharedComponents);

  }, [connections, sharedComponents, isCanvasReady]);

  // Performance-optimized ratsnest updates during component movement
  useEffect(() => {
    if (!canvasInstanceRef.current || !isCanvasReady || !ratsnestRenderer.current) return;

    const canvas = canvasInstanceRef.current;
    const renderer = ratsnestRenderer.current;

    const handleObjectMoving = () => {
      // Throttled updates during movement for smooth performance
      renderer.scheduleUpdate(connections, sharedComponents);
    };

    const handleObjectMoved = () => {
      // Final update when movement is complete
      renderer.updateRatsnest(connections, sharedComponents);
    };

    canvas.on('object:moving', handleObjectMoving);
    canvas.on('object:modified', handleObjectMoved);

    return () => {
      canvas.off('object:moving', handleObjectMoving);
      canvas.off('object:modified', handleObjectMoved);
    };
  }, [connections, sharedComponents, isCanvasReady]);

  // Performance monitoring
  useEffect(() => {
    if (!isCanvasReady) return;

    let frameCount = 0;
    let lastTime = performance.now();
    
    const updateStats = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      if (deltaTime >= 1000) { // Update every second
        const fps = Math.round((frameCount * 1000) / deltaTime);
        const stats = getStats();
        const ratsnestStats = ratsnestRenderer.current?.getStats() || { lineCount: 0, updateQueueSize: 0 };
        
        setPerformanceStats({
          fps,
          renderTime: deltaTime / frameCount,
        });
        
        console.log('📊 Performance Stats:', {
          fps,
          avgRenderTime: `${(deltaTime / frameCount).toFixed(2)}ms`,
          components: stats.componentCount,
          connections: stats.connectionCount,
          ratsnestLines: ratsnestStats.lineCount,
        });
        
        frameCount = 0;
        lastTime = currentTime;
      }
      
      frameCount++;
      requestAnimationFrame(updateStats);
    };

    if (process.env.NODE_ENV === 'development') {
      requestAnimationFrame(updateStats);
    }
  }, [isCanvasReady, getStats]);

  // Manual zoom functions for UI controls
  const handleZoomIn = () => {
    if (!canvasInstanceRef.current) return;
    const zoom = canvasInstanceRef.current.getZoom() * 1.1;
    canvasInstanceRef.current.setZoom(zoom);
    canvasInstanceRef.current.renderAll();
  };

  const handleZoomOut = () => {
    if (!canvasInstanceRef.current) return;
    const zoom = canvasInstanceRef.current.getZoom() * 0.9;
    canvasInstanceRef.current.setZoom(zoom);
    canvasInstanceRef.current.renderAll();
  };

  const handleResetZoom = () => {
    if (!canvasInstanceRef.current) return;
    canvasInstanceRef.current.setZoom(1);
    canvasInstanceRef.current.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvasInstanceRef.current.renderAll();
  };

  return (
    <CanvasErrorBoundary onError={(error) => console.error('PCB Canvas Error:', error)}>
      <div className={`relative w-full h-full ${className}`}>
        {/* Canvas Element */}
        <canvas
          ref={canvasRef}
          className="block border-none outline-none"
          style={{
            cursor: pan.isDragging ? "grabbing" : "grab",
          }}
        />

        {/* PCB View Indicator with Enhanced Stats */}
        <div className="absolute top-4 left-4 bg-green-700 bg-opacity-95 text-white px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm border border-green-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="font-semibold text-sm">PCB Layout View</span>
          </div>
          <div className="text-xs opacity-90 mt-1 max-w-xs">
            Design your physical circuit board • Place components and route traces
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs mt-2 bg-black bg-opacity-30 rounded px-2 py-1">
              {getStats().componentCount} components • {getStats().connectionCount} connections
              {ratsnestRenderer.current && (
                <span> • {ratsnestRenderer.current.getStats().lineCount} ratsnest lines</span>
              )}
            </div>
          )}
        </div>

        {/* Cross-probing Status */}
        {crossProbing.isEnabled && (
          <div className="absolute top-4 right-20 bg-blue-600 bg-opacity-90 text-white px-3 py-2 rounded-lg shadow-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-300 rounded-full"></div>
              <span className="text-sm">Cross-probing Active</span>
            </div>
          </div>
        )}

        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="bg-white border border-gray-300 hover:bg-gray-50 p-2 rounded shadow transition-colors"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="bg-white border border-gray-300 hover:bg-gray-50 p-2 rounded shadow transition-colors"
            title="Zoom Out"
          >
            -
          </button>
          <button
            onClick={handleResetZoom}
            className="bg-white border border-gray-300 hover:bg-gray-50 p-2 rounded shadow text-xs transition-colors"
            title="Reset Zoom"
          >
            Reset
          </button>
        </div>

        {/* Enhanced Ratsnest Demo Controls */}
        <RatsnestDemo />
      </div>
    </CanvasErrorBoundary>
  );
}
