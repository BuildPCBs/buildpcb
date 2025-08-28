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

// Calculate pad world position for a given component and pin
function calculatePadPosition(
  component: SharedComponent,
  pinType: string,
  canvas: fabric.Canvas
): { x: number; y: number } | null {
  if (!component.pcbPosition) {
    return null;
  }

  // Get the footprint data for this component
  const componentPinMap = COMPONENT_PIN_MAP[component.type as keyof typeof COMPONENT_PIN_MAP];
  if (!componentPinMap) {
    console.warn(`No pin map found for component type: ${component.type}`);
    return null;
  }

  // Handle different pin map structures
  let footprintKey: string | null = null;
  let pins: readonly { x: number; y: number; type: string }[] = [];

  if (Array.isArray(componentPinMap)) {
    // Legacy format - just pins array, no footprint
    pins = componentPinMap;
    // Try to map component type to footprint
    const typeToFootprint: Record<string, string> = {
      'resistor': 'RESISTOR',
      'capacitor': 'CAPACITOR',
      'led': 'LED',
      'diode': 'DIODE',
      'transistor': 'TRANSISTOR',
    };
    footprintKey = typeToFootprint[component.type] || null;
  } else {
    // New format with footprint property
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

  // Find the pin in the component's pin map to get the pad index
  const pinInfo = pins.find(p => p.type === pinType);
  if (!pinInfo) {
    console.warn(`No pin info found for pin ${pinType} in component ${component.type}`);
    return null;
  }

  // Get the pad index (assuming pins are ordered the same as pads)
  const pinIndex = pins.indexOf(pinInfo);
  const pad = footprintData.pads[pinIndex];
  
  if (!pad) {
    console.warn(`No pad found at index ${pinIndex} for pin ${pinType} in footprint ${footprintKey}`);
    return null;
  }

  // Calculate absolute position: component position + pad offset
  const worldX = component.pcbPosition.x + (pad.x * MM_TO_PX);
  const worldY = component.pcbPosition.y + (pad.y * MM_TO_PX);

  return { x: worldX, y: worldY };
}

// Create a single ratsnest line between two connected pads
export function createRatsnestLine(
  connection: ElectricalConnection,
  fromComponent: SharedComponent,
  toComponent: SharedComponent,
  canvas: fabric.Canvas
): fabric.Line | null {
  const fromPos = calculatePadPosition(fromComponent, connection.fromPin, canvas);
  const toPos = calculatePadPosition(toComponent, connection.toPin, canvas);

  if (!fromPos || !toPos) {
    return null;
  }

  const ratsnestLine = new fabric.Line(
    [fromPos.x, fromPos.y, toPos.x, toPos.y],
    {
      stroke: "#00ff00", // Bright green for ratsnest lines
      strokeWidth: 1,
      strokeDashArray: [3, 3], // Dashed line to distinguish from traces
      selectable: false,
      evented: false,
      opacity: 0.8,
      // Custom properties for ratsnest management
      isRatsnest: true,
      connectionId: connection.id,
      fromComponentId: connection.fromComponent,
      toComponentId: connection.toComponent,
    } as any
  );

  return ratsnestLine;
}

// Update a ratsnest line when components move
export function updateRatsnestLine(
  line: fabric.Line & { connectionId: string; fromComponentId: string; toComponentId: string },
  connection: ElectricalConnection,
  fromComponent: SharedComponent,
  toComponent: SharedComponent,
  canvas: fabric.Canvas
): void {
  const fromPos = calculatePadPosition(fromComponent, connection.fromPin, canvas);
  const toPos = calculatePadPosition(toComponent, connection.toPin, canvas);

  if (!fromPos || !toPos) {
    return;
  }

  line.set({
    x1: fromPos.x,
    y1: fromPos.y,
    x2: toPos.x,
    y2: toPos.y,
  });
}

// Add all ratsnest lines to the canvas
export function addRatsnestToCanvas(
  connections: ElectricalConnection[],
  components: SharedComponent[],
  canvas: fabric.Canvas
): RatsnestLine[] {
  const ratsnestLines: RatsnestLine[] = [];

  connections.forEach(connection => {
    const fromComponent = components.find(c => c.id === connection.fromComponent);
    const toComponent = components.find(c => c.id === connection.toComponent);

    if (fromComponent && toComponent) {
      const line = createRatsnestLine(connection, fromComponent, toComponent, canvas);
      if (line) {
        canvas.add(line);
        ratsnestLines.push({
          id: `ratsnest_${connection.id}`,
          connectionId: connection.id,
          fabricLine: line,
        });
      }
    }
  });

  canvas.renderAll();
  return ratsnestLines;
}

// Remove all ratsnest lines from canvas
export function removeRatsnestFromCanvas(canvas: fabric.Canvas): void {
  const objects = canvas.getObjects();
  const ratsnestLines = objects.filter((obj: any) => obj.isRatsnest);
  
  ratsnestLines.forEach(line => {
    canvas.remove(line);
  });
  
  canvas.renderAll();
}

// Update all ratsnest lines when components move
export function updateAllRatsnestLines(
  connections: ElectricalConnection[],
  components: SharedComponent[],
  canvas: fabric.Canvas
): void {
  const objects = canvas.getObjects();
  const ratsnestLines = objects.filter((obj: any) => obj.isRatsnest) as Array<fabric.Line & { connectionId: string; fromComponentId: string; toComponentId: string }>;

  ratsnestLines.forEach(line => {
    const connection = connections.find(c => c.id === line.connectionId);
    const fromComponent = components.find(c => c.id === line.fromComponentId);
    const toComponent = components.find(c => c.id === line.toComponentId);

    if (connection && fromComponent && toComponent) {
      updateRatsnestLine(line, connection, fromComponent, toComponent, canvas);
    }
  });

  canvas.renderAll();
}
