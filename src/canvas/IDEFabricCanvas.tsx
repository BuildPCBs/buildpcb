"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import Konva from "konva";

import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

import { useCanvasPan } from "./hooks/useCanvasPan";
import { useCanvasZoom } from "./hooks/useCanvasZoom";
import { useCanvasViewport } from "./hooks/useCanvasViewport";
import { useHistoryStack } from "./hooks/useHistoryStack";
import { useCanvasHotkeys } from "./hooks/useCanvasHotkeys";
import { useProjectStore } from "@/store/projectStore";
import { SimpleComponent } from "./SimpleComponentFactory";
import { useKonvaWiringTool } from "./hooks/useKonvaWiringTool";
import { ContextMenu } from "./ui/ContextMenu";
import { ComponentPickerOverlay } from "./ui/ComponentPickerOverlay";

interface IDEFabricCanvasProps {
  className?: string;
  onCanvasReady?: (stage: Konva.Stage) => void;
  onNetlistReady?: (getNetlist: () => any) => void;
  onSave?: (overrideMessages?: any[]) => Promise<void>;
}

export function IDEFabricCanvas({
  className = "",
  onCanvasReady,
  onNetlistReady,
  onSave,
}: IDEFabricCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const layerRef = useRef<Konva.Layer>(null);

  const { circuit } = useProjectStore();

  // Canvas hooks - now using Konva Stage
  const { isPanMode, isDragging } = useCanvasPan(stageRef.current);
  useCanvasZoom(stageRef.current);
  const viewport = useCanvasViewport(stageRef.current);
  const { undo, redo, canUndo, canRedo, saveState } = useHistoryStack({
    stage: stageRef.current,
  });

  // Konva wiring tool
  const {
    isWireMode,
    isDrawing,
    toggleWireMode,
    exitWireMode,
    connections,
    clearAllWires,
    startWireFromPin,
    completeWireToPin,
    addBendPoint,
    cancelWire,
    updateWiresForComponent,
    removeConnectionsForComponent,
  } = useKonvaWiringTool({
    stage: stageRef.current,
    enabled: true,
    onNetlistChange: (nets) => logger.wire("Netlist updated", nets),
  });

  // Hotkeys - need to provide the required functions
  useCanvasHotkeys({
    canvas: stageRef.current,
    onDelete: () => logger.canvas("Delete action triggered"),
    onCopy: () => logger.canvas("Copy action triggered"),
    onPaste: () => logger.canvas("Paste action triggered"),
    onComponentPicker: () => setIsComponentPickerVisible(true),
    onUndo: undo,
    onRedo: redo,
    onSave: () => onSave?.(),
    onToggleWireMode: toggleWireMode,
  });

  // Component state
  const [components, setComponents] = useState<any[]>([]);
  const [wires, setWires] = useState<any[]>([]);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null
  );

  // Context menu and clipboard state
  const [menuState, setMenuState] = useState({
    visible: false,
    x: 0,
    y: 0,
    canvasX: 0, // Canvas coordinates for paste
    canvasY: 0, // Canvas coordinates for paste
    type: "canvas" as "object" | "canvas",
    target: null as any,
  });
  const [clipboard, setClipboard] = useState<any>(null);
  const [isComponentPickerVisible, setIsComponentPickerVisible] =
    useState(false);

  // Initialize canvas
  useEffect(() => {
    if (stageRef.current && onCanvasReady) {
      onCanvasReady(stageRef.current);
      logger.canvas("Canvas initialized with Konva Stage");
    }
  }, [onCanvasReady]);

  // Load project data
  useEffect(() => {
    if (circuit?.components) {
      setComponents(circuit.components);
      // Convert connections to wires format if needed
      setWires(circuit.connections || []);
      logger.canvas("Loaded circuit data", {
        componentCount: circuit.components.length,
      });
    }
  }, [circuit?.components, circuit?.connections]);

  // Handle component placement
  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (isPanMode || isDragging) return;

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Convert to canvas coordinates
      const transform = stage.getAbsoluteTransform().copy();
      transform.invert();
      const pos = transform.point(pointer);

      // Handle wire bend points when in wire mode
      if (isWireMode && isDrawing) {
        addBendPoint(pos.x, pos.y);
        return;
      }

      // For now, just log the click position
      logger.canvas("Stage clicked", { x: pos.x, y: pos.y });
    },
    [isPanMode, isDragging, isWireMode, isDrawing, addBendPoint]
  );

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.evt.preventDefault(); // Stop the default browser menu

      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Convert to canvas coordinates
      const transform = stage.getAbsoluteTransform().copy();
      transform.invert();
      const canvasPos = transform.point(pointer);

      // Check if clicking on a component (simplified - in future check intersections)
      const clickedComponent = components.find((comp) => {
        // Simple bounding box check - can be improved
        const compX = comp.x || 0;
        const compY = comp.y || 0;
        return (
          canvasPos.x >= compX - 50 &&
          canvasPos.x <= compX + 50 &&
          canvasPos.y >= compY - 50 &&
          canvasPos.y <= compY + 50
        );
      });

      if (clickedComponent) {
        logger.canvas("Showing OBJECT context menu");
        // Right-click on component - show copy/delete menu
        setMenuState({
          visible: true,
          x: e.evt.clientX,
          y: e.evt.clientY,
          canvasX: canvasPos.x,
          canvasY: canvasPos.y,
          type: "object",
          target: clickedComponent,
        });
      } else {
        logger.canvas("Showing CANVAS context menu");
        // Right-click on empty canvas - show paste menu
        setMenuState({
          visible: true,
          x: e.evt.clientX,
          y: e.evt.clientY,
          canvasX: canvasPos.x,
          canvasY: canvasPos.y,
          type: "canvas",
          target: null,
        });
      }
    },
    [components]
  );

  // Handle regular click to close context menu
  const handleStageClickWithMenu = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Close context menu on left click
      if (e.evt.button === 0) {
        setMenuState((prev) => ({ ...prev, visible: false }));
      }

      // Handle normal stage click
      handleStageClick(e);
    },
    [handleStageClick]
  );

  // Handle component drag end
  const handleComponentDragEnd = useCallback(
    (componentId: string, newPos: { x: number; y: number }) => {
      setComponents((prev) =>
        prev.map((comp) =>
          comp.id === componentId ? { ...comp, x: newPos.x, y: newPos.y } : comp
        )
      );
      // Update wires when component moves
      updateWiresForComponent(componentId);
      saveState();
      logger.canvas("Component moved", { componentId, newPos });
    },
    [saveState, updateWiresForComponent]
  );

  // Handle component click for selection
  const handleComponentClick = useCallback((componentId: string) => {
    setSelectedComponentId((prev) =>
      prev === componentId ? null : componentId
    );
    logger.canvas("Component selected", { componentId });
  }, []);

  // Context menu handlers
  const handleDelete = useCallback(() => {
    if (!menuState.target) return;

    const componentToDelete = menuState.target as any; // Type assertion for now
    logger.canvas("Deleting component", { componentId: componentToDelete.id });

    // Remove all wires connected to this component
    removeConnectionsForComponent(componentToDelete.id);

    // Remove component from state
    setComponents((prev) =>
      prev.filter((comp) => comp.id !== componentToDelete.id)
    );

    // Clear selection if the deleted component was selected
    if (selectedComponentId === componentToDelete.id) {
      setSelectedComponentId(null);
    }

    // Update circuit in store
    const updatedCircuit = circuit
      ? {
          ...circuit,
          components: circuit.components.filter(
            (comp) => comp.id !== componentToDelete.id
          ),
        }
      : null;

    if (updatedCircuit) {
      useProjectStore.getState().setCircuit(updatedCircuit);
    }

    // Close menu
    setMenuState((prev) => ({ ...prev, visible: false }));

    // Save state for undo/redo
    saveState();
  }, [
    menuState.target,
    circuit,
    saveState,
    removeConnectionsForComponent,
    selectedComponentId,
  ]);

  const handleCopy = useCallback(() => {
    if (!menuState.target) return;

    const componentToCopy = menuState.target as any; // Type assertion for now
    logger.canvas("Copying component", { componentId: componentToCopy.id });

    // Store component data in clipboard (deep copy to avoid reference issues)
    const clipboardData = {
      ...componentToCopy,
      // Generate new ID when pasted
      originalId: componentToCopy.id,
    };

    setClipboard(clipboardData);

    // Close menu
    setMenuState((prev) => ({ ...prev, visible: false }));
  }, [menuState.target]);

  const handlePaste = useCallback(
    (position?: { x: number; y: number }) => {
      if (!clipboard) {
        logger.canvas("No clipboard data to paste");
        return;
      }

      const pastePosition = position || { x: 0, y: 0 };
      logger.canvas("Pasting component", { position: pastePosition });

      // Create new component with new ID and position
      const newComponent = {
        ...clipboard,
        id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
        x: pastePosition.x,
        y: pastePosition.y,
        // Remove originalId as it's no longer needed
        originalId: undefined,
      };

      // Add to components
      setComponents((prev) => [...prev, newComponent]);

      // Update circuit in store
      const updatedCircuit = circuit
        ? {
            ...circuit,
            components: [...circuit.components, newComponent],
          }
        : {
            id: `circuit_${Date.now()}`,
            name: "Untitled Circuit",
            projectId: "temp",
            components: [newComponent],
            connections: [],
            layout: {
              layers: [],
              dimensions: { width: 1000, height: 1000 },
              grid: { size: 10, visible: true },
              zoom: 1,
              viewBox: { x: 0, y: 0, width: 1000, height: 1000 },
            },
            simulations: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

      useProjectStore.getState().setCircuit(updatedCircuit);

      // Close menu
      setMenuState((prev) => ({ ...prev, visible: false }));

      // Save state for undo/redo
      saveState();
    },
    [clipboard, circuit, saveState]
  );

  const handleContextPaste = useCallback(() => {
    handlePaste({ x: menuState.canvasX, y: menuState.canvasY });
  }, [handlePaste, menuState.canvasX, menuState.canvasY]);

  // Component addition handler
  const handleAddComponent = useCallback(
    async (componentData: any) => {
      logger.canvas("Adding component to canvas", componentData);

      try {
        // Fetch the full component data from the database
        const { data: fullComponentData, error } = await supabase
          .from("components")
          .select("*")
          .eq("id", componentData.id)
          .single();

        if (error) {
          logger.canvas("Error fetching component data", error);
          throw error;
        }

        if (!fullComponentData) {
          logger.canvas("Component not found in database");
          throw new Error("Component not found");
        }

        // Position component in the center of the current viewport
        const stage = stageRef.current;
        let componentX = 100;
        let componentY = 100;

        if (stage) {
          // Get the center of the viewport in screen coordinates
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;

          // Transform screen coordinates to canvas coordinates
          const transform = stage.getAbsoluteTransform().copy();
          transform.invert();
          const canvasPos = transform.point({ x: centerX, y: centerY });

          componentX = canvasPos.x;
          componentY = canvasPos.y;

          // Add some random offset to avoid exact overlap
          componentX += (Math.random() - 0.5) * 100; // ±50px offset
          componentY += (Math.random() - 0.5) * 100;
        }

        // Create new component with unique ID and position
        const newComponent = {
          ...fullComponentData,
          id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          x: componentX,
          y: componentY,
        };

        // Add to components
        setComponents((prev) => [...prev, newComponent]);

        // Update circuit in store
        const updatedCircuit = circuit
          ? {
              ...circuit,
              components: [...circuit.components, newComponent],
            }
          : {
              id: `circuit_${Date.now()}`,
              name: "Untitled Circuit",
              projectId: "temp",
              components: [newComponent],
              connections: [],
              layout: {
                layers: [],
                dimensions: { width: 1000, height: 1000 },
                grid: { size: 10, visible: true },
                zoom: 1,
                viewBox: { x: 0, y: 0, width: 1000, height: 1000 },
              },
              simulations: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

        useProjectStore.getState().setCircuit(updatedCircuit);

        // Save state for undo/redo
        saveState();

        logger.canvas("Component added successfully", newComponent.id);
      } catch (error) {
        logger.canvas("Error adding component", error);
      }
    },
    [circuit, saveState]
  );

  // Render components
  const renderComponents = () => {
    return components.map((component) => (
      <SimpleComponent
        key={component.id}
        component={component}
        x={component.x || 0}
        y={component.y || 0}
        scale={10} // Scale factor to make components visible (PCB units to pixels)
        showPins={isWireMode} // Show pins only when in wire mode
        isWireMode={isWireMode} // Pass wire mode for cursor changes
        isSelected={selectedComponentId === component.id} // Pass selection state
        onDragEnd={!isWireMode ? handleComponentDragEnd : undefined} // Disable dragging in wire mode
        onClick={() => handleComponentClick(component.id)} // Handle selection
        onPinClick={(pinNumber, pinX, pinY) => {
          if (isWireMode) {
            if (isDrawing) {
              // Complete the wire
              completeWireToPin(
                component.id,
                pinNumber,
                pinX + (component.x || 0),
                pinY + (component.y || 0)
              );
            } else {
              // Start a new wire
              startWireFromPin(
                component.id,
                pinNumber,
                pinX + (component.x || 0),
                pinY + (component.y || 0)
              );
            }
          } else {
            logger.canvas("Pin clicked", {
              componentId: component.id,
              pinNumber,
            });
          }
        }}
      />
    ));
  };

  // Render wires
  const renderWires = () => {
    return connections.map((connection) => (
      <Line
        key={connection.id}
        points={connection.points}
        stroke="#0066CC"
        strokeWidth={2}
      />
    ));
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Viewport Info */}
      <div className="absolute top-4 right-4 z-10 text-sm text-gray-600 bg-white px-2 py-1 rounded">
        Zoom: {(viewport.scaleX * 100).toFixed(0)}% | X: {viewport.x.toFixed(0)}{" "}
        | Y: {viewport.y.toFixed(0)}
      </div>

      {/* Wire Mode Indicator */}
      {isWireMode && (
        <div className="absolute top-4 left-4 z-10 text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
          Wire Mode {isDrawing ? "(Drawing)" : "(Click pin to start)"}
        </div>
      )}

      {/* Konva Stage */}
      <Stage
        ref={stageRef}
        width={window.innerWidth}
        height={window.innerHeight}
        onClick={handleStageClickWithMenu}
        onContextMenu={handleContextMenu}
        tabIndex={0}
        className="focus:outline-none"
      >
        <Layer ref={layerRef}>
          {/* Grid background */}
          <Rect
            x={-10000}
            y={-10000}
            width={20000}
            height={20000}
            fill="#fff"
          />

          {/* Render components */}
          {renderComponents()}

          {/* Render wires */}
          {renderWires()}
        </Layer>
      </Stage>

      {/* Context Menu */}
      <ContextMenu
        visible={menuState.visible}
        top={menuState.y}
        left={menuState.x}
        menuType={menuState.type}
        canPaste={clipboard !== null}
        onClose={() => setMenuState((prev) => ({ ...prev, visible: false }))}
        onDelete={handleDelete}
        onCopy={handleCopy}
        onPaste={handleContextPaste}
      />

      {/* Component Picker Overlay */}
      <ComponentPickerOverlay
        isVisible={isComponentPickerVisible}
        onClose={() => setIsComponentPickerVisible(false)}
        onAddComponent={handleAddComponent}
      />
    </div>
  );
}
