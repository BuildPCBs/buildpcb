// PCB Footprint definitions for components
// Each footprint is an array of pads with shape, size, and position (in mm)

export type PadShape = 'rect' | 'circle' | 'oval';

export interface Pad {
  shape: PadShape;
  width: number; // mm
  height: number; // mm
  x: number; // mm, relative to footprint origin
  y: number; // mm, relative to footprint origin
}

export interface Footprint {
  name: string;
  pads: Pad[];
}

export const FOOTPRINT_DATA: Record<string, Footprint> = {
  RESISTOR: {
    name: 'Resistor 0603',
    pads: [
      { shape: 'rect', width: 1.0, height: 1.5, x: -1.5, y: 0 },
      { shape: 'rect', width: 1.0, height: 1.5, x: 1.5, y: 0 },
    ],
  },
  CAPACITOR: {
    name: 'Capacitor 0603',
    pads: [
      { shape: 'rect', width: 1.0, height: 1.5, x: -1.5, y: 0 },
      { shape: 'rect', width: 1.0, height: 1.5, x: 1.5, y: 0 },
    ],
  },
  LED: {
    name: 'LED 0805',
    pads: [
      { shape: 'rect', width: 1.2, height: 1.8, x: -1.7, y: 0 },
      { shape: 'rect', width: 1.2, height: 1.8, x: 1.7, y: 0 },
    ],
  },
  DIODE: {
    name: 'Diode SOD-123',
    pads: [
      { shape: 'rect', width: 1.1, height: 1.6, x: -2.0, y: 0 },
      { shape: 'rect', width: 1.1, height: 1.6, x: 2.0, y: 0 },
    ],
  },
  TRANSISTOR: {
    name: 'Transistor SOT-23',
    pads: [
      { shape: 'rect', width: 0.6, height: 1.0, x: -1.2, y: 0.95 },
      { shape: 'rect', width: 0.6, height: 1.0, x: 0, y: -0.95 },
      { shape: 'rect', width: 0.6, height: 1.0, x: 1.2, y: 0.95 },
    ],
  },
};
