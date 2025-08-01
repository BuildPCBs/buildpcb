# Fabric.js Mouse Wheel Zooming Hook

This document explains how to use the `useFabricCanvasViewport` hook to implement mouse wheel zooming functionality for Fabric.js canvases.

## Installation

Make sure you have the required dependencies:

```bash
pnpm install fabric
pnpm install --save-dev @types/fabric
```

## Usage

### Basic Implementation

```tsx
import React, { useRef, useEffect, useState } from "react";
import * as fabric from "fabric";
import { useFabricCanvasViewport } from "@/canvas";

export function MyFabricCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);

  // Initialize the zoom hook
  const { getCurrentZoom, setZoom, resetZoom, zoomToFit } =
    useFabricCanvasViewport(fabricCanvas || undefined);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create Fabric.js canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 800,
      height: 600,
    });

    setFabricCanvas(canvas);

    // Add some objects
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: "#ff6b6b",
    });

    canvas.add(rect);

    return () => {
      canvas.dispose();
    };
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} />
      <div>Current Zoom: {Math.round(getCurrentZoom() * 100)}%</div>
    </div>
  );
}
```

## Features

### Mouse Wheel Zooming

- **Scroll up**: Zoom in
- **Scroll down**: Zoom out
- **Zoom factor**: 1.1x per scroll step
- **Zoom range**: 10% to 1000%
- **Zoom center**: Mouse cursor position

### Programmatic Controls

The hook returns the following functions:

#### `getCurrentZoom(): number`

Returns the current zoom level (1.0 = 100%).

```tsx
const currentZoom = getCurrentZoom();
console.log(`Current zoom: ${currentZoom * 100}%`);
```

#### `setZoom(zoom: number): void`

Sets the zoom level programmatically.

```tsx
setZoom(2.0); // Set zoom to 200%
setZoom(0.5); // Set zoom to 50%
```

#### `resetZoom(): void`

Resets the zoom level to 100%.

```tsx
resetZoom(); // Reset to 100% zoom
```

#### `zoomToFit(): void`

Automatically zooms and pans to fit all objects in the canvas with some padding.

```tsx
zoomToFit(); // Fit all objects in view
```

## Configuration

The hook uses the following constants that can be customized:

```tsx
const ZOOM_FACTOR = 1.1; // Zoom step size (10% per scroll)
const MIN_ZOOM = 0.1; // Minimum zoom (10%)
const MAX_ZOOM = 10; // Maximum zoom (1000%)
```

## Event Handling

The hook automatically:

- Prevents default browser scrolling when zooming
- Stops event propagation
- Adds and removes event listeners properly
- Cleans up on component unmount

## Complete Example

See `src/canvas/FabricCanvas.tsx` for a complete working example with control buttons and zoom indicator.

## Browser Support

This hook works with all modern browsers that support:

- Fabric.js
- Mouse wheel events
- React hooks

## Notes

- The hook only works with Fabric.js Canvas instances
- Mouse wheel zooming is centered on the current mouse position
- The hook handles event cleanup automatically
- For HTML Canvas (non-Fabric.js), use the original `useCanvasViewport` hook instead
