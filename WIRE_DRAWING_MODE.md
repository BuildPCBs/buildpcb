# Wire Drawing Mode Implementation

## Overview
This document outlines the complete implementation of Wire Drawing Mode that allows users to draw connections between components. The system provides an intuitive interface for creating electrical connections in the PCB design workflow.

## Features Implemented

### ✅ **Component Connection Points (Pins)**
- **Location**: Updated in `src/canvas/canvas-command-manager.ts`
- **Implementation**: 
  - Resistors now include invisible pin objects at connection points
  - Pins are positioned at left and right ends of resistor symbol
  - Pins are grouped with the main component for unified movement
  - Special properties: `pin: true`, `pinType: "left|right"`

### ✅ **Wire Drawing Mode Toggle**
- **Keyboard Shortcut**: Press `W` key to toggle Wire Mode
- **Visual Feedback**: Cursor changes to crosshair in Wire Mode
- **Exit Options**: Press `W` again or `ESC` to exit Wire Mode
- **Object Selection**: Disabled during Wire Mode for focused interaction

### ✅ **Interactive Pin Visualization**
- **Wire Mode**: Pins become visible with blue stroke and transparent fill
- **Normal Mode**: Pins remain invisible for clean component appearance
- **Hover Detection**: 8px tolerance for accurate pin targeting

### ✅ **Wire Drawing Logic**
- **Start Wire**: Click on any component pin to begin drawing
- **Follow Mouse**: Wire endpoint follows cursor in real-time
- **End Wire**: Click on another pin to complete the connection
- **Cancel Wire**: Press `ESC` to cancel current wire drawing

## Implementation Details

### Part 1: Component Pin System

#### Enhanced Resistor Creation
```typescript
// Create invisible pin objects at connection points
const leftPin = new fabric.Circle({
  radius: 4,
  fill: "transparent",
  stroke: "#0038DF",
  strokeWidth: 0, // Initially invisible
  left: -50,
  top: 10,
  pin: true, // Special property to identify pins
  pinType: "left", // Identifier for this specific pin
});

// Group resistor parts including pins
const resistorGroup = new fabric.Group(
  [leftLead, resistorBody, rightLead, leftPin, rightPin],
  {
    componentType: "resistor", // Identify as component
  }
);
```

### Part 2: Wire Tool Hook (`useWireTool.ts`)

#### State Management
```typescript
interface WireToolState {
  isWireMode: boolean;
  isDrawing: boolean;
  currentWire: fabric.Line | null;
  startPin: fabric.Object | null;
}
```

#### Key Functions
- **`toggleWireMode()`**: Activates/deactivates wire drawing mode
- **`findPinAtPoint()`**: Detects pins near cursor position
- **`handleMouseDown()`**: Manages wire start/end logic
- **`handleMouseMove()`**: Updates wire endpoint during drawing

### Part 3: Canvas Integration

#### Visual Indicators
- **Wire Mode Badge**: Appears in top-right corner during Wire Mode
- **Instructions**: Shows "Click pins to connect" and keyboard shortcuts
- **Drawing Status**: Indicates when actively drawing a wire

#### Mouse Event Handling
- **Canvas Selection**: Disabled during Wire Mode
- **Pin Detection**: Uses coordinate transformation for accurate positioning
- **Real-time Preview**: Wire follows cursor until second pin is clicked

## User Workflow

### 1. **Activate Wire Mode**
```
Press 'W' key → Canvas enters Wire Mode → Cursor becomes crosshair
```

### 2. **Start Drawing Wire**
```
Click on component pin → Wire starts at pin location → Wire follows mouse
```

### 3. **Complete Wire Connection**
```
Click on different pin → Wire snaps to second pin → Connection created
```

### 4. **Exit Wire Mode**
```
Press 'W' again or 'ESC' → Return to normal mode → Object selection restored
```

## Technical Architecture

### **Hook Structure**
- `useWireTool`: Main wire drawing logic
- `useCanvasZoom`: Zoom functionality (unaffected by wire mode)
- `useCanvasPan`: Pan functionality (disabled during wire mode)
- `useCanvasHotkeys`: Keyboard shortcuts (enhanced with wire mode)

### **Event Management**
- Mouse events are hijacked during Wire Mode
- Coordinate transformation handles canvas zoom/pan
- Pin detection uses distance calculation for accuracy

### **Visual Feedback**
- Pins highlight when Wire Mode is active
- Real-time wire preview during drawing
- Mode indicators and instructions for user guidance

## Integration Points

### **Canvas Component (`IDEFabricCanvas.tsx`)**
```typescript
// Wire drawing tool
const wireTool = useWireTool({
  canvas: fabricCanvas,
  enabled: !!fabricCanvas,
});
```

### **Component Creation (`canvas-command-manager.ts`)**
- All components now include pin objects
- Pins are properly grouped with main component
- Special properties for identification and interaction

### **Visual UI Elements**
- Wire Mode indicator with instructions
- Keyboard shortcut display
- Drawing status feedback

## Testing Instructions

### **Basic Wire Drawing**
1. Add resistors to canvas using existing component system
2. Press `W` to activate Wire Mode
3. Observe pins becoming visible on components
4. Click on one pin, then another to create wire connection

### **Mode Transitions**
1. Verify cursor changes to crosshair in Wire Mode
2. Test `ESC` key cancels current wire drawing
3. Confirm `W` key toggles mode on/off
4. Ensure object selection works normally outside Wire Mode

### **Pin Detection**
1. Test pin detection accuracy near component edges
2. Verify pins move correctly when components are moved
3. Confirm wires maintain connections to pins

## Future Enhancements

### **Potential Improvements**
- **Multi-component Support**: Add pins to capacitors, ICs, etc.
- **Wire Styles**: Different wire types (power, signal, ground)
- **Connection Validation**: Electrical rule checking
- **Wire Routing**: Automatic path optimization
- **Undo/Redo**: Wire creation/deletion history

### **Advanced Features**
- **Bus Connections**: Multi-wire bundles
- **Net Naming**: Wire group identification
- **Auto-routing**: Intelligent path finding
- **Design Rule Check**: Electrical validation

The Wire Drawing Mode provides a solid foundation for electrical connection creation in the PCB design environment, with room for future electrical engineering features.
