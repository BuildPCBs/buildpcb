import * as fabric from "fabric";
import { FOOTPRINT_DATA, Footprint, Pad } from "@/lib/footprints";

// Convert millimeters to pixels (assuming 1mm = 10px for now)
const MM_TO_PX = 10;

export interface FootprintInstance {
  id: string;
  footprintKey: string;
  x: number;
  y: number;
  rotation: number;
  fabricObject?: fabric.Group;
}

// Create a visual footprint on the canvas
export function createFootprintVisual(
  footprint: Footprint,
  x: number,
  y: number,
  componentId: string,
  rotation: number = 0
): fabric.Group {
  const pads: fabric.Object[] = [];

  // Create pads for the footprint
  footprint.pads.forEach((pad, index) => {
    const padVisual = createPadVisual(pad, index);
    
    // Position the pad relative to footprint origin
    padVisual.set({
      left: pad.x * MM_TO_PX,
      top: pad.y * MM_TO_PX,
    });

    pads.push(padVisual);
  });

  // Create footprint label
  const label = new fabric.Text(footprint.name, {
    fontSize: 8,
    fill: "#ffffff",
    fontFamily: "Arial, sans-serif",
    originX: "center",
    originY: "center",
    top: (footprint.pads.length > 0 ? Math.max(...footprint.pads.map(p => p.y)) * MM_TO_PX : 0) + 15,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 2,
  });

  // Group all elements
  const footprintGroup = new fabric.Group([...pads, label], {
    left: x,
    top: y,
    angle: rotation,
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
  });

  // Add metadata
  (footprintGroup as any).componentId = componentId;
  (footprintGroup as any).footprintType = "pcb-footprint";
  (footprintGroup as any).footprintName = footprint.name;

  return footprintGroup;
}

// Create a visual representation of a single pad
function createPadVisual(pad: Pad, index: number): fabric.Object {
  const width = pad.width * MM_TO_PX;
  const height = pad.height * MM_TO_PX;

  let padShape: fabric.Object;

  switch (pad.shape) {
    case 'circle':
      padShape = new fabric.Circle({
        radius: Math.min(width, height) / 2,
        fill: "#cd7f32", // Copper color
        stroke: "#b8860b",
        strokeWidth: 0.5,
        originX: "center",
        originY: "center",
      });
      break;
    
    case 'oval':
      padShape = new fabric.Ellipse({
        rx: width / 2,
        ry: height / 2,
        fill: "#cd7f32", // Copper color
        stroke: "#b8860b",
        strokeWidth: 0.5,
        originX: "center",
        originY: "center",
      });
      break;
    
    case 'rect':
    default:
      padShape = new fabric.Rect({
        width: width,
        height: height,
        fill: "#cd7f32", // Copper color
        stroke: "#b8860b",
        strokeWidth: 0.5,
        rx: 1,
        ry: 1,
        originX: "center",
        originY: "center",
      });
      break;
  }

  // Add pad metadata
  (padShape as any).isPad = true;
  (padShape as any).padIndex = index;
  (padShape as any).padData = pad;

  return padShape;
}

// Add a footprint to the canvas
export function addFootprintToCanvas(
  canvas: fabric.Canvas,
  componentId: string,
  footprintKey: string,
  x: number,
  y: number,
  rotation: number = 0
): fabric.Group | null {
  const footprint = FOOTPRINT_DATA[footprintKey];
  if (!footprint) {
    console.warn(`Footprint not found: ${footprintKey}`);
    return null;
  }

  console.log(`🔧 Creating footprint ${footprint.name} for component ${componentId}`);
  
  const footprintVisual = createFootprintVisual(footprint, x, y, componentId, rotation);
  canvas.add(footprintVisual);
  canvas.renderAll();

  return footprintVisual;
}

// Remove a footprint from the canvas by component ID
export function removeFootprintFromCanvas(canvas: fabric.Canvas, componentId: string): boolean {
  const objects = canvas.getObjects();
  const footprintToRemove = objects.find(obj => 
    (obj as any).componentId === componentId && 
    (obj as any).footprintType === "pcb-footprint"
  );

  if (footprintToRemove) {
    canvas.remove(footprintToRemove);
    canvas.renderAll();
    console.log(`🗑️ Removed footprint for component ${componentId}`);
    return true;
  }

  return false;
}

// Find footprint on canvas by component ID
export function findFootprintOnCanvas(canvas: fabric.Canvas, componentId: string): fabric.Group | null {
  const objects = canvas.getObjects();
  const footprint = objects.find(obj => 
    (obj as any).componentId === componentId && 
    (obj as any).footprintType === "pcb-footprint"
  ) as fabric.Group;

  return footprint || null;
}

// Update footprint position
export function updateFootprintPosition(canvas: fabric.Canvas, componentId: string, x: number, y: number): void {
  const footprint = findFootprintOnCanvas(canvas, componentId);
  if (footprint) {
    footprint.set({ left: x, top: y });
    canvas.renderAll();
  }
}
