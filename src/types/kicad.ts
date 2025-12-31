/**
 * KiCad Component Type Definitions
 *
 * This file contains comprehensive TypeScript interfaces for KiCad component data.
 * These types represent the structure of parsed KiCad symbol files.
 */

// ============================================================================
// BASE TYPES
// ============================================================================

/**
 * 2D Position with optional angle
 */
export interface Position {
  x: number;
  y: number;
  angle: number;
}

/**
 * 2D Point (simpler than Position, no angle)
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Font size definition
 */
export interface FontSize {
  width: number;
  height: number;
}

/**
 * Font properties
 */
export interface Font {
  size: FontSize;
}

/**
 * Stroke definition for drawing elements
 */
export interface Stroke {
  width: number;
  type: "default" | string; // Usually "default", but can be other types
}

/**
 * Fill definition for drawing elements
 * Types: "none", "background", "outline"
 */
export interface Fill {
  type: "none" | "background" | "outline" | string;
}

// ============================================================================
// PIN TYPES
// ============================================================================

/**
 * Pin type definitions from KiCad
 */
export type PinType =
  | "input"
  | "output"
  | "bidirectional"
  | "tri_state"
  | "passive"
  | "free"
  | "unspecified"
  | "power_in"
  | "power_out"
  | "open_collector"
  | "open_emitter"
  | "no_connect";

/**
 * Pin shape definitions
 */
export type PinShape =
  | "line"
  | "inverted"
  | "clock"
  | "inverted_clock"
  | "input_low"
  | "clock_low"
  | "output_low"
  | "edge_clock_high"
  | "non_logic";

/**
 * Pin definition
 */
export interface Pin {
  /** Pin electrical type */
  type: PinType;

  /** Pin visual shape */
  shape: PinShape;

  /** Pin name/label (e.g., "VCC", "GND", "A0", "~RST") */
  name: string;

  /** Pin number (as string, can be alphanumeric) */
  number: string;

  /** Pin position and orientation */
  position: Position;

  /** Pin length in mm */
  length: number;
}

// ============================================================================
// GRAPHICS ELEMENTS
// ============================================================================

/**
 * Rectangle graphic element
 */
export interface Rectangle {
  /** Top-left corner */
  start: Point;

  /** Bottom-right corner */
  end: Point;

  /** Stroke/outline properties */
  stroke: Stroke;

  /** Fill properties */
  fill: Fill;
}

/**
 * Circle graphic element
 */
export interface Circle {
  /** Center point of the circle */
  center: Point;

  /** Radius in mm */
  radius: number;

  /** Stroke/outline properties */
  stroke: Stroke;

  /** Fill properties */
  fill: Fill;
}

/**
 * Polyline (connected line segments) graphic element
 */
export interface Polyline {
  /** Array of points defining the polyline path */
  points: Point[];

  /** Stroke/outline properties */
  stroke: Stroke;

  /** Fill properties (for closed polylines) */
  fill: Fill;
}

/**
 * Arc graphic element
 */
export interface Arc {
  /** Start point of the arc */
  start: Point;

  /** Mid point of the arc (defines curvature) */
  mid: Point;

  /** End point of the arc */
  end: Point;

  /** Stroke/outline properties */
  stroke: Stroke;

  /** Fill properties */
  fill: Fill;
}

/**
 * Text justification/alignment
 */
export interface TextEffects {
  /** Font properties */
  font: Font;

  /** Justification string (e.g., "left", "right", "center", or empty) */
  justify: string;
}

/**
 * Text graphic element
 */
export interface Text {
  /** Text content to display */
  content: string;

  /** Position and rotation */
  position: Position;

  /** Text formatting effects */
  effects: TextEffects;
}

/**
 * Graphics container for all drawable elements
 */
export interface Graphics {
  /** Rectangle elements */
  rectangles: Rectangle[];

  /** Circle elements */
  circles: Circle[];

  /** Polyline elements */
  polylines: Polyline[];

  /** Arc elements */
  arcs: Arc[];

  /** Text elements */
  text: Text[];
}

// ============================================================================
// SYMBOL DATA
// ============================================================================

/**
 * Symbol data containing pins and graphics
 */
export interface SymbolData {
  /** Array of component pins */
  pins: Pin[];

  /** Graphic elements that make up the symbol body */
  graphics: Graphics;
}

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

/**
 * Field value and position (for reference, value, etc.)
 */
export interface Field {
  /** Field value/text */
  value: string;

  /** Position and rotation of the field */
  position: Position;
}

/**
 * Component fields (reference designator, value, etc.)
 */
export interface Fields {
  /** Reference designator field (e.g., "U", "R", "C") */
  reference: Field;

  /** Value field (component name/value) */
  value: Field;

  // Note: Additional custom fields may be present but are not typed here
}

// ============================================================================
// MAIN COMPONENT TYPE
// ============================================================================

/**
 * Complete KiCad component definition
 */
export interface KiCadComponent {
  /** Unique identifier (UUID) */
  id: string;

  /** Component name (e.g., "LM358", "ATmega328P") */
  name: string;

  /** Library name this component belongs to */
  library: string;

  /** Component description */
  description: string;

  /** URL to component datasheet */
  datasheet: string;

  /** Space-separated keywords for searching */
  keywords: string;

  /** Total number of pins */
  pin_count: number;

  /** Symbol graphical and pin data */
  symbol_data: SymbolData;

  /** Array of footprint filter patterns (e.g., ["DIP?16*", "SOIC*"]) */
  footprint_filter: string[];

  /** Component fields (reference, value, etc.) */
  fields: Fields;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Array of KiCad components (typical JSON file format)
 */
export type KiCadComponentLibrary = KiCadComponent[];

/**
 * Partial component (for search results or previews)
 */
export type PartialKiCadComponent = Partial<KiCadComponent>;

/**
 * Component with optional fields (for validation)
 */
export interface KiCadComponentOptional {
  id: string;
  name: string;
  library: string;
  description?: string;
  datasheet?: string;
  keywords?: string;
  pin_count: number;
  symbol_data: SymbolData;
  footprint_filter?: string[];
  fields: Fields;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if an object is a valid Position
 */
export function isPosition(obj: any): obj is Position {
  return (
    typeof obj === "object" &&
    typeof obj.x === "number" &&
    typeof obj.y === "number" &&
    typeof obj.angle === "number"
  );
}

/**
 * Type guard to check if an object is a valid Pin
 */
export function isPin(obj: any): obj is Pin {
  return (
    typeof obj === "object" &&
    typeof obj.type === "string" &&
    typeof obj.shape === "string" &&
    typeof obj.name === "string" &&
    typeof obj.number === "string" &&
    isPosition(obj.position) &&
    typeof obj.length === "number"
  );
}

/**
 * Type guard to check if an object is a valid KiCadComponent
 */
export function isKiCadComponent(obj: any): obj is KiCadComponent {
  return (
    typeof obj === "object" &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.library === "string" &&
    typeof obj.pin_count === "number" &&
    typeof obj.symbol_data === "object" &&
    Array.isArray(obj.symbol_data.pins) &&
    typeof obj.symbol_data.graphics === "object" &&
    typeof obj.fields === "object"
  );
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Valid pin types
 */
export const PIN_TYPES: readonly PinType[] = [
  "input",
  "output",
  "bidirectional",
  "tri_state",
  "passive",
  "free",
  "unspecified",
  "power_in",
  "power_out",
  "open_collector",
  "open_emitter",
  "no_connect",
] as const;

/**
 * Valid pin shapes
 */
export const PIN_SHAPES: readonly PinShape[] = [
  "line",
  "inverted",
  "clock",
  "inverted_clock",
  "input_low",
  "clock_low",
  "output_low",
  "edge_clock_high",
  "non_logic",
] as const;

/**
 * Valid fill types
 */
export const FILL_TYPES = ["none", "background", "outline"] as const;

/**
 * Valid stroke types
 */
export const STROKE_TYPES = ["default"] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the bounding box of a component
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/**
 * Get the bounding box for a component
 */
export function getComponentBounds(component: KiCadComponent): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Check pins
  component.symbol_data.pins.forEach((pin) => {
    minX = Math.min(minX, pin.position.x);
    minY = Math.min(minY, pin.position.y);
    maxX = Math.max(maxX, pin.position.x);
    maxY = Math.max(maxY, pin.position.y);
  });

  // Check rectangles
  component.symbol_data.graphics.rectangles.forEach((rect) => {
    minX = Math.min(minX, rect.start.x, rect.end.x);
    minY = Math.min(minY, rect.start.y, rect.end.y);
    maxX = Math.max(maxX, rect.start.x, rect.end.x);
    maxY = Math.max(maxY, rect.start.y, rect.end.y);
  });

  // Check circles
  component.symbol_data.graphics.circles.forEach((circle) => {
    minX = Math.min(minX, circle.center.x - circle.radius);
    minY = Math.min(minY, circle.center.y - circle.radius);
    maxX = Math.max(maxX, circle.center.x + circle.radius);
    maxY = Math.max(maxY, circle.center.y + circle.radius);
  });

  // Check polylines
  component.symbol_data.graphics.polylines.forEach((polyline) => {
    polyline.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  // Check arcs
  component.symbol_data.graphics.arcs.forEach((arc) => {
    minX = Math.min(minX, arc.start.x, arc.mid.x, arc.end.x);
    minY = Math.min(minY, arc.start.y, arc.mid.y, arc.end.y);
    maxX = Math.max(maxX, arc.start.x, arc.mid.x, arc.end.x);
    maxY = Math.max(maxY, arc.start.y, arc.mid.y, arc.end.y);
  });

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Filter components by search term
 */
export function filterComponents(
  components: KiCadComponent[],
  searchTerm: string
): KiCadComponent[] {
  const term = searchTerm.toLowerCase().trim();

  if (!term) {
    return components;
  }

  return components.filter(
    (comp) =>
      comp.name.toLowerCase().includes(term) ||
      comp.description.toLowerCase().includes(term) ||
      comp.keywords.toLowerCase().includes(term) ||
      comp.library.toLowerCase().includes(term)
  );
}

/**
 * Get unique libraries from components
 */
export function getUniqueLibraries(components: KiCadComponent[]): string[] {
  const libraries = new Set(components.map((c) => c.library));
  return Array.from(libraries).sort();
}

/**
 * Group components by library
 */
export function groupByLibrary(
  components: KiCadComponent[]
): Record<string, KiCadComponent[]> {
  return components.reduce((acc, comp) => {
    if (!acc[comp.library]) {
      acc[comp.library] = [];
    }
    acc[comp.library].push(comp);
    return acc;
  }, {} as Record<string, KiCadComponent[]>);
}

/**
 * Count pins by type
 */
export function countPinsByType(
  component: KiCadComponent
): Record<PinType, number> {
  const counts: Record<string, number> = {};

  component.symbol_data.pins.forEach((pin) => {
    counts[pin.type] = (counts[pin.type] || 0) + 1;
  });

  return counts as Record<PinType, number>;
}

/**
 * Check if component has graphics of specific type
 */
export function hasGraphicsType(
  component: KiCadComponent,
  type: "rectangles" | "circles" | "polylines" | "arcs" | "text"
): boolean {
  return component.symbol_data.graphics[type].length > 0;
}
