/**
 * Simple Wiring Tool - Works with Database Pin Data
 * A clean, straightforward implementation for connecting component pins
 */

import { useEffect, useState, useCallback, useRef } from "react";
import * as fabric from "fabric";

interface PinData {
  name: string;
  number: string;
  electrical_type: string;
  x: number;
  y: number;
  orientation: number;
}

interface WireConnection {
  fromComponentId: string;
  fromPinNumber: string;
  toComponentId: string;
  toPinNumber: string;
  wire: fabric.Line;
}

interface UseSimpleWiringToolProps {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
}

interface UseSimpleWiringToolReturn {
  isWireMode: boolean;
  isDrawing: boolean;
  toggleWireMode: () => void;
  exitWireMode: () => void;
  connections: WireConnection[];
  clearAllWires: () => void;
}

export function useSimpleWiringTool({
  canvas,
  enabled = true,
}: UseSimpleWiringToolProps): UseSimpleWiringToolReturn {
  const [isWireMode, setIsWireMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [connections, setConnections] = useState<WireConnection[]>([]);

  // Refs for current drawing state
  const startPinRef = useRef<{
    componentId: string;
    pinNumber: string;
    pin: fabric.Object;
  } | null>(null);
  const currentWireRef = useRef<fabric.Line | null>(null);

  // Find pin at mouse position
  const findPinAtPoint = useCallback((point: fabric.Point): fabric.Object | null => {
    if (!canvas) return null;

    const objects = canvas.getObjects();

    for (const obj of objects) {
      // Check if this is a pin (has pin data)
      const pinData = (obj as any).pinData;
      if (!pinData) continue;

      // Check if mouse is within pin bounds (simple circle collision)
      const pinCenter = obj.getCenterPoint();
      const distance = Math.sqrt(
        Math.pow(point.x - pinCenter.x, 2) + Math.pow(point.y - pinCenter.y, 2)
      );

      // Pin radius is approximately 4-6 pixels
      if (distance <= 6) {
        return obj;
      }
    }

    return null;
  }, [canvas]);

  // Create a wire between two pins
  const createWire = useCallback((
    fromPin: fabric.Object,
    toPin: fabric.Object,
    fromPinData: PinData,
    toPinData: PinData
  ) => {
    if (!canvas) return null;

    const fromCenter = fromPin.getCenterPoint();
    const toCenter = toPin.getCenterPoint();

    // Create wire line
    const wire = new fabric.Line([fromCenter.x, fromCenter.y, toCenter.x, toCenter.y], {
      stroke: '#0038DF',
      strokeWidth: 2,
      fill: '',
      selectable: true,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      hoverCursor: 'pointer',
    });

    // Store connection data on the wire
    (wire as any).connectionData = {
      fromComponentId: (fromPin as any).componentId,
      fromPinNumber: fromPinData.number,
      toComponentId: (toPin as any).componentId,
      toPinNumber: toPinData.number,
    };

    canvas.add(wire);

    return wire;
  }, [canvas]);

  // Handle mouse down for starting wire
  const handleMouseDown = useCallback((e: any) => {
    if (!isWireMode || !canvas) return;

    const pointer = canvas.getPointer(e.e);
    const point = new fabric.Point(pointer.x, pointer.y);

    const clickedPin = findPinAtPoint(point);

    if (clickedPin) {
      const pinData = (clickedPin as any).pinData as PinData;

      if (!startPinRef.current) {
        // Start drawing from this pin
        startPinRef.current = {
          componentId: (clickedPin as any).componentId,
          pinNumber: pinData.number,
          pin: clickedPin,
        };

        setIsDrawing(true);

        // Highlight the start pin
        clickedPin.set({
          fill: '#FF6B35',
          stroke: '#E53E3E',
        });
        canvas.renderAll();

      } else if (startPinRef.current.pin !== clickedPin) {
        // Complete the wire to this pin
        const fromPinData = (startPinRef.current.pin as any).pinData as PinData;
        const toPinData = pinData;

        // Check if trying to connect same component
        if (startPinRef.current.componentId === (clickedPin as any).componentId) {
          console.warn('Cannot connect pin to same component');
          return;
        }

        // Check if trying to connect same pin
        if (startPinRef.current.pinNumber === toPinData.number &&
            startPinRef.current.componentId === (clickedPin as any).componentId) {
          console.warn('Cannot connect pin to itself');
          return;
        }

        // Create the wire
        const wire = createWire(startPinRef.current.pin, clickedPin, fromPinData, toPinData);

        if (wire) {
          const connection: WireConnection = {
            fromComponentId: startPinRef.current.componentId,
            fromPinNumber: startPinRef.current.pinNumber,
            toComponentId: (clickedPin as any).componentId,
            toPinNumber: toPinData.number,
            wire: wire,
          };

          setConnections(prev => [...prev, connection]);
        }

        // Reset drawing state
        startPinRef.current.pin.set({
          fill: '#10B981',
          stroke: '#059669',
        });

        startPinRef.current = null;
        setIsDrawing(false);
        canvas.renderAll();
      }
    }
  }, [isWireMode, canvas, findPinAtPoint, createWire]);

  // Handle mouse move for wire preview
  const handleMouseMove = useCallback((e: any) => {
    if (!isWireMode || !isDrawing || !canvas || !startPinRef.current) return;

    const pointer = canvas.getPointer(e.e);
    const startPoint = startPinRef.current.pin.getCenterPoint();

    // Update or create preview wire
    if (currentWireRef.current) {
      currentWireRef.current.set({
        x2: pointer.x,
        y2: pointer.y,
      });
    } else {
      currentWireRef.current = new fabric.Line([startPoint.x, startPoint.y, pointer.x, pointer.y], {
        stroke: '#0038DF',
        strokeWidth: 2,
        strokeDashArray: [5, 5], // Dashed line for preview
        fill: '',
        selectable: false,
        hasControls: false,
        hasBorders: false,
      });
      canvas.add(currentWireRef.current);
    }

    canvas.renderAll();
  }, [isWireMode, isDrawing, canvas]);

  // Toggle wire mode
  const toggleWireMode = useCallback(() => {
    if (!canvas) return;

    const newWireMode = !isWireMode;
    setIsWireMode(newWireMode);

    if (!newWireMode) {
      exitWireMode();
    } else {
      // Enter wire mode - change cursor
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    }

    canvas.renderAll();
  }, [isWireMode, canvas]);

  // Exit wire mode
  const exitWireMode = useCallback(() => {
    if (!canvas) return;

    setIsWireMode(false);
    setIsDrawing(false);

    // Reset cursor
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';

    // Clean up any preview wire
    if (currentWireRef.current) {
      canvas.remove(currentWireRef.current);
      currentWireRef.current = null;
    }

    // Reset start pin highlight
    if (startPinRef.current) {
      startPinRef.current.pin.set({
        fill: '#10B981',
        stroke: '#059669',
      });
      startPinRef.current = null;
    }

    canvas.renderAll();
  }, [canvas]);

  // Clear all wires
  const clearAllWires = useCallback(() => {
    if (!canvas) return;

    connections.forEach(connection => {
      canvas.remove(connection.wire);
    });

    setConnections([]);
    canvas.renderAll();
  }, [canvas, connections]);

  // Set up event listeners
  useEffect(() => {
    if (!canvas || !enabled) return;

    if (isWireMode) {
      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
    }

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
    };
  }, [canvas, enabled, isWireMode, handleMouseDown, handleMouseMove]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (currentWireRef.current && canvas) {
        canvas.remove(currentWireRef.current);
      }
    };
  }, [canvas]);

  return {
    isWireMode,
    isDrawing,
    toggleWireMode,
    exitWireMode,
    connections,
    clearAllWires,
  };
}