# Wheel Event Conflict Resolution

## Problem

The application was experiencing wheel event conflicts between multiple event listeners:

1. **Global browser override** (`useOverrideBrowserControls`) - passive wheel listener
2. **Canvas interaction handler** (`useCanvasInteraction`) - tries to preventDefault
3. **Fabric.js zoom handler** (`useFabricCanvasViewport`) - tries to preventDefault

This caused the error:

```
Unable to preventDefault inside passive event listener invocation.
```

## Solution

### 1. Updated `useOverrideBrowserControls`

Modified the global wheel event handler to be more selective:

```typescript
const handleWheel = (e: WheelEvent) => {
  const target = e.target as HTMLElement;

  // Allow canvas elements and their containers to handle their own wheel events
  if (
    target.tagName === "CANVAS" ||
    target.closest(".canvas-container") ||
    target.closest('[data-scrollable="false"]')
  ) {
    return; // Don't interfere with canvas wheel events
  }

  // Prevent browser zoom with Ctrl/Cmd + wheel on non-canvas elements
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
  }

  // Prevent page scrolling on non-scrollable elements
  const scrollableElement =
    target.closest('[data-scrollable="true"]') ||
    target.closest(".overflow-auto") ||
    target.closest(".overflow-y-auto") ||
    target.closest(".overflow-x-auto");

  if (!scrollableElement) {
    e.preventDefault();
  }
};
```

### 2. Marked Canvas Containers

Added proper CSS classes and data attributes to identify canvas areas:

**FabricCanvas component:**

```tsx
<div className="relative canvas-container" data-scrollable="false">
```

**IDECanvas component:**

```tsx
<div className="absolute inset-0 canvas-container" data-scrollable="false">
  <Canvas />
</div>
```

### 3. Selective Event Handling

The global override now:

- ✅ **Allows** canvas elements to handle their own wheel events
- ✅ **Allows** scrollable areas marked with `data-scrollable="true"` to scroll
- ✅ **Prevents** browser zoom with Ctrl/Cmd + wheel
- ✅ **Prevents** unwanted page scrolling on non-scrollable elements

## Testing

Visit `/fabric-test` to test:

1. Canvas zooming works without console errors
2. Scrollable areas still work normally
3. Browser zoom is prevented on canvas areas
4. No event listener conflicts

## Benefits

1. **No more console errors** - passive event listener conflicts resolved
2. **Proper event isolation** - each component handles its own events
3. **Maintained functionality** - all existing features still work
4. **Better user experience** - smooth zooming without browser interference
5. **Selective control** - only prevents events where needed

## Usage Guidelines

### For Canvas Components

- Wrap canvas elements in containers with `canvas-container` class
- Add `data-scrollable="false"` to prevent page scrolling

### For Scrollable Areas

- Add `data-scrollable="true"` to allow normal scrolling
- Or use Tailwind classes: `overflow-auto`, `overflow-y-auto`, `overflow-x-auto`

### For Non-Interactive Areas

- No special marking needed - global override will prevent unwanted scrolling
