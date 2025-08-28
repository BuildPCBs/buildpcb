import * as fabric from "fabric";
import { ElectricalConnection, SharedComponent } from "@/contexts/ViewContext";
import { FOOTPRINT_DATA } from "@/lib/footprints";
import { COMPONENT_PIN_MAP } from "@/lib/constants";

// Convert millimeters to pixels (same as FootprintRenderer)
const MM_TO_PX = 10;

export interface RatsnestLine {
  id: string;
  connectionId: string;
  fabricLine: fabric.Line;
}

// Performance-optimized ratsnest renderer with batching and throttling
export class OptimizedRatsnestRenderer {
  private canvas: fabric.Canvas;
  private ratsnestLines: Map<string, fabric.Line> = new Map();
  private updateQueue: Set<string> = new Set();
  private isUpdating: boolean = false;
  private throttleTimer: NodeJS.Timeout | null = null;

  constructor(canvas: fabric.Canvas) {
    this.canvas = canvas;
  }

  // Main method to update all ratsnest lines with performance optimizations
  updateRatsnest(connections: ElectricalConnection[], components: SharedComponent[]): void {
    // Use requestAnimationFrame for smooth updates
    if (this.isUpdating) return;
    
    this.isUpdating = true;
    requestAnimationFrame(() => {
      this.performUpdate(connections, components);
      this.isUpdating = false;
    });
  }

  private performUpdate(connections: ElectricalConnection[], components: SharedComponent[]): void {
    const componentMap = new Map(components.map(c => [c.id, c]));
    const validConnections = connections.filter(conn => 
      componentMap.has(conn.fromComponent) && componentMap.has(conn.toComponent)
    );

    // Remove obsolete ratsnest lines
    this.cleanupObsoleteLines(validConnections);

    // Batch create/update ratsnest lines
    const linesToUpdate: Array<{
      connection: ElectricalConnection;
      fromComponent: SharedComponent;
      toComponent: SharedComponent;
    }> = [];

    validConnections.forEach(connection => {
      const fromComponent = componentMap.get(connection.fromComponent)!;
      const toComponent = componentMap.get(connection.toComponent)!;
      
      linesToUpdate.push({ connection, fromComponent, toComponent });
    });

    // Process updates in chunks to prevent UI blocking
    this.processUpdatesInChunks(linesToUpdate);
  }

  private processUpdatesInChunks(updates: Array<{
    connection: ElectricalConnection;
    fromComponent: SharedComponent;
    toComponent: SharedComponent;
  }>): void {
    const CHUNK_SIZE = 10;
    let index = 0;

    const processChunk = () => {
      const endIndex = Math.min(index + CHUNK_SIZE, updates.length);
      
      for (let i = index; i < endIndex; i++) {
        const { connection, fromComponent, toComponent } = updates[i];
        this.updateSingleRatsnestLine(connection, fromComponent, toComponent);
      }

      index = endIndex;

      if (index < updates.length) {
        // Continue processing in next frame
        requestAnimationFrame(processChunk);
      } else {
        // All updates complete, render once
        this.canvas.renderAll();
      }
    };

    processChunk();
  }

  private updateSingleRatsnestLine(
    connection: ElectricalConnection,
    fromComponent: SharedComponent,
    toComponent: SharedComponent
  ): void {
    const lineId = `ratsnest_${connection.id}`;
    const existingLine = this.ratsnestLines.get(lineId);

    const fromPos = this.calculatePadPosition(fromComponent, connection.fromPin);
    const toPos = this.calculatePadPosition(toComponent, connection.toPin);

    if (!fromPos || !toPos) {
      // Remove line if positions can't be calculated
      if (existingLine) {
        this.canvas.remove(existingLine);
        this.ratsnestLines.delete(lineId);
      }
      return;
    }

    if (existingLine) {
      // Update existing line positions efficiently
      existingLine.set({
        x1: fromPos.x,
        y1: fromPos.y,
        x2: toPos.x,
        y2: toPos.y,
      });
      existingLine.setCoords();
    } else {
      // Create new ratsnest line
      const newLine = this.createRatsnestLine(fromPos, toPos, connection);
      this.ratsnestLines.set(lineId, newLine);
      this.canvas.add(newLine);
    }
  }

  private createRatsnestLine(
    fromPos: { x: number; y: number },
    toPos: { x: number; y: number },
    connection: ElectricalConnection
  ): fabric.Line {
    return new fabric.Line([fromPos.x, fromPos.y, toPos.x, toPos.y], {
      stroke: this.getNetColor(connection.netId || 'default'),
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
      opacity: 0.7,
      // Custom properties for identification
      isRatsnest: true,
      connectionId: connection.id,
      netId: connection.netId,
    } as any);
  }

  private getNetColor(netId: string): string {
    // Generate consistent colors for different nets
    const colors = [
      '#00ff00', // Green
      '#ff6b6b', // Red
      '#4ecdc4', // Teal
      '#45b7d1', // Blue
      '#f9ca24', // Yellow
      '#f0932b', // Orange
      '#eb4d4b', // Dark Red
      '#6c5ce7', // Purple
    ];
    
    const hash = netId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  }

  private calculatePadPosition(
    component: SharedComponent,
    pinType: string
  ): { x: number; y: number } | null {
    if (!component.pcbPosition) {
      return null;
    }

    const componentPinMap = COMPONENT_PIN_MAP[component.type as keyof typeof COMPONENT_PIN_MAP];
    if (!componentPinMap) {
      console.warn(`No pin map found for component type: ${component.type}`);
      return null;
    }

    // Handle different pin map structures efficiently
    let footprintKey: string | null = null;
    let pins: readonly { x: number; y: number; type: string }[] = [];

    if (Array.isArray(componentPinMap)) {
      pins = componentPinMap;
      const typeToFootprint: Record<string, string> = {
        'resistor': 'RESISTOR',
        'capacitor': 'CAPACITOR',
        'led': 'LED',
        'diode': 'DIODE',
        'transistor': 'TRANSISTOR',
      };
      footprintKey = typeToFootprint[component.type] || null;
    } else {
      footprintKey = (componentPinMap as any).footprint;
      pins = (componentPinMap as any).pins;
    }

    if (!footprintKey) {
      console.warn(`No footprint defined for component type: ${component.type}`);
      return null;
    }

    const footprintData = FOOTPRINT_DATA[footprintKey];
    if (!footprintData) {
      console.warn(`No footprint data found for: ${footprintKey}`);
      return null;
    }

    const pinInfo = pins.find(p => p.type === pinType);
    if (!pinInfo) {
      console.warn(`No pin info found for pin ${pinType} in component ${component.type}`);
      return null;
    }

    const pinIndex = pins.indexOf(pinInfo);
    const pad = footprintData.pads[pinIndex];
    
    if (!pad) {
      console.warn(`No pad found at index ${pinIndex} for pin ${pinType} in footprint ${footprintKey}`);
      return null;
    }

    return {
      x: component.pcbPosition.x + (pad.x * MM_TO_PX),
      y: component.pcbPosition.y + (pad.y * MM_TO_PX)
    };
  }

  private cleanupObsoleteLines(validConnections: ElectricalConnection[]): void {
    const validConnectionIds = new Set(validConnections.map(c => c.id));
    
    // Remove ratsnest lines for non-existent connections
    this.ratsnestLines.forEach((line, lineId) => {
      const connectionId = lineId.replace('ratsnest_', '');
      if (!validConnectionIds.has(connectionId)) {
        this.canvas.remove(line);
        this.ratsnestLines.delete(lineId);
      }
    });
  }

  // Throttled update for real-time component movement
  scheduleUpdate(connections: ElectricalConnection[], components: SharedComponent[]): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
    }

    this.throttleTimer = setTimeout(() => {
      this.updateRatsnest(connections, components);
    }, 16); // ~60fps
  }

  // Clear all ratsnest lines
  clearAll(): void {
    this.ratsnestLines.forEach(line => {
      this.canvas.remove(line);
    });
    this.ratsnestLines.clear();
    this.canvas.renderAll();
  }

  // Get statistics for performance monitoring
  getStats(): { lineCount: number; updateQueueSize: number } {
    return {
      lineCount: this.ratsnestLines.size,
      updateQueueSize: this.updateQueue.size
    };
  }
}

// Legacy functions maintained for backward compatibility
export function createRatsnestLine(
  connection: ElectricalConnection,
  fromComponent: SharedComponent,
  toComponent: SharedComponent,
  canvas: fabric.Canvas
): fabric.Line | null {
  const renderer = new OptimizedRatsnestRenderer(canvas);
  const fromPos = renderer['calculatePadPosition'](fromComponent, connection.fromPin);
  const toPos = renderer['calculatePadPosition'](toComponent, connection.toPin);

  if (!fromPos || !toPos) {
    return null;
  }

  return renderer['createRatsnestLine'](fromPos, toPos, connection);
}

export function addRatsnestToCanvas(
  connections: ElectricalConnection[],
  components: SharedComponent[],
  canvas: fabric.Canvas
): RatsnestLine[] {
  const renderer = new OptimizedRatsnestRenderer(canvas);
  renderer.updateRatsnest(connections, components);
  
  // Return legacy format for compatibility
  return connections.map(conn => ({
    id: `ratsnest_${conn.id}`,
    connectionId: conn.id,
    fabricLine: new fabric.Line([0, 0, 0, 0]) // Placeholder
  }));
}

export function removeRatsnestFromCanvas(canvas: fabric.Canvas): void {
  const objects = canvas.getObjects();
  const ratsnestLines = objects.filter((obj: any) => obj.isRatsnest);
  
  ratsnestLines.forEach(line => {
    canvas.remove(line);
  });
  
  canvas.renderAll();
}

export function updateAllRatsnestLines(
  connections: ElectricalConnection[],
  components: SharedComponent[],
  canvas: fabric.Canvas
): void {
  const renderer = new OptimizedRatsnestRenderer(canvas);
  renderer.updateRatsnest(connections, components);
}
