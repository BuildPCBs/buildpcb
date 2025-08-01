# Copy and Paste Workflow Improvements

## Overview
This document outlines the comprehensive overhaul of the context menu and copy/paste logic to create a seamless, professional user experience.

## Part 1: Refactored Context Menu Logic

### Target File: `src/canvas/IDEFabricCanvas.tsx`

#### Updated State Management
```typescript
const [menuState, setMenuState] = useState({
  visible: false,
  x: 0,
  y: 0,
  type: 'object' as 'object' | 'canvas',
  target: null as fabric.FabricObject | null,
});
```

#### Rethought Context Menu Event Handler
The context menu now handles two distinct cases:

**Case A: Right-Click on an Object**
- Uses `canvas.findTarget(e)` to detect objects
- Shows context menu with "Copy" and "Delete" options
- Makes the object the active selection on the canvas
- Excludes workspace objects from interaction

**Case B: Right-Click on Empty Canvas**
- Detects empty canvas clicks when `findTarget()` returns null
- Shows context menu with only "Paste" option
- "Paste" option is disabled if clipboard is empty

## Part 2: Enhanced handlePaste() Function

### Key Improvements

#### Intelligent Paste Positioning
```typescript
const handlePaste = (pasteX?: number, pasteY?: number) => {
  // Context menu paste: paste at right-click coordinates
  // Keyboard paste: paste in center of current viewport with offset
}
```

#### Two Paste Modes:
1. **Context Menu Paste**: Pastes object at the exact location where user right-clicked
2. **Keyboard Shortcut Paste**: Pastes in center of current viewport with random offset to avoid overlap

#### Coordinate Transformation
- Properly converts screen coordinates to canvas coordinates
- Accounts for canvas viewport transformations
- Uses `fabric.util.transformPoint()` for accurate positioning

## Part 3: Asynchronous Operations Handling

### Correct Copy Implementation
```typescript
activeObject.clone().then((cloned: fabric.Object) => {
  setClipboard(cloned);
  console.log("Object copied to clipboard");
});
```

### Correct Paste Implementation
```typescript
clipboard.clone().then((cloned: fabric.Object) => {
  // Position and add to canvas
});
```

## Part 4: Updated Context Menu Component

### Target File: `src/canvas/ui/ContextMenu.tsx`

#### Enhanced Interface
```typescript
interface ContextMenuProps {
  visible: boolean;
  top: number;
  left: number;
  menuType: 'object' | 'canvas';
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  canPaste: boolean;
  onClose: () => void;
}
```

#### Dynamic Menu Content
- **Object Menu**: Shows "Copy" and "Delete" options
- **Canvas Menu**: Shows only "Paste" option
- **Disabled State**: "Paste" is disabled when clipboard is empty

## Features Implemented

### ✅ **Smart Context Detection**
- Automatically detects whether user clicked on object or empty canvas
- Shows appropriate menu options for each case

### ✅ **Professional Object Selection**
- Objects become selected when right-clicked
- Clear visual feedback for user actions

### ✅ **Intelligent Paste Positioning**
- Context menu paste: exactly where user right-clicked
- Keyboard paste: center of viewport with offset

### ✅ **Proper Async Handling**
- All `clone()` operations use Promise-based API
- Prevents race conditions and memory leaks

### ✅ **Workspace Protection**
- Workspace boundary objects cannot be copied or deleted
- Context menu respects object hierarchy

## Testing Instructions

1. **Object Context Menu**:
   - Right-click on any component
   - Should see "Copy" and "Delete" options
   - Object should become selected

2. **Canvas Context Menu**:
   - Right-click on empty canvas space
   - Should see only "Paste" option
   - Should be disabled if clipboard is empty

3. **Copy and Paste Flow**:
   - Copy an object via context menu or Ctrl+C
   - Paste via context menu (at cursor) or Ctrl+V (at center)
   - Multiple pastes should create multiple objects

4. **Coordinate Accuracy**:
   - Right-click paste should place object exactly at cursor
   - Keyboard paste should place object in viewport center

## Technical Notes

- Uses modern Fabric.js 6.x Promise-based API
- Proper TypeScript typing throughout
- Canvas coordinate transformation for accurate positioning
- React state management with proper cleanup
- Cross-platform keyboard shortcuts maintained
