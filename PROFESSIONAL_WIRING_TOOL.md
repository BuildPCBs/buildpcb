# Professional-Grade Wiring Tool Implementation

## Overview
This document outlines the complete implementation of a professional-grade wiring tool that replaces the previous flawed system. The new tool implements a robust state machine approach with orthogonal wire routing, mimicking the behavior of modern PCB design software like Altium Designer and KiCad.

## Core Architecture: State Machine Design

### State Machine States
The wiring tool operates as a finite state machine with three distinct states:

```typescript
type WireState = 'idle' | 'drawing' | 'finishing';
```

#### **'idle' State**
- **Purpose**: Default state when not actively drawing wires
- **Behavior**: User can hover over pins to see highlights, click pins to start new wires
- **Visual**: Pins are visible in wire mode, cursor is crosshair

#### **'drawing' State** 
- **Purpose**: Actively routing a wire with orthogonal segments
- **Behavior**: Ghost wire follows cursor with orthogonal constraints, clicks add waypoints
- **Visual**: Dashed ghost wire, real-time preview, waypoint indicators

#### **'finishing' State**
- **Purpose**: About to complete wire on a valid end pin
- **Behavior**: End pin is highlighted, click completes the wire connection
- **Visual**: End pin highlighted differently, ready-to-connect feedback

## User Experience Flow

### 1. **Entering Wire Mode**
```
Press 'W' → Cursor becomes crosshair → Pins become visible → State: 'idle'
```

### 2. **Starting a Wire**
```
Hover pin → Pin highlights → Click pin → Ghost wire starts → State: 'drawing'
```

### 3. **Orthogonal Routing**
```
Move cursor → Wire follows orthogonally → Click empty space → Add waypoint → Continue routing
```

### 4. **Completing Wire**
```
Hover end pin → Pin highlights → State: 'finishing' → Click pin → Wire completed → State: 'idle'
```

### 5. **Cancelling Operations**
```
Press 'ESC' or Right-click → Cancel current wire → Remove ghost wire → State: 'idle'
```

## Technical Implementation Details

### **Wire Object Structure**
```typescript
// Wire is created as fabric.Polyline for multi-segment support
const finalWire = new fabric.Polyline(fabricPoints, {
  fill: 'transparent',
  stroke: '#0038DF',
  strokeWidth: 2,
  strokeLineCap: 'round',
  strokeLineJoin: 'round',
  selectable: true,
  evented: true,
  wireType: 'connection',
  startPin: startPin,
  endPin: endPin,
});
```

### **Orthogonal Logic Algorithm**
```typescript
const calculateOrthogonalPoint = (lastPoint: WirePoint, currentPoint: WirePoint): WirePoint => {
  const deltaX = Math.abs(currentPoint.x - lastPoint.x);
  const deltaY = Math.abs(currentPoint.y - lastPoint.y);

  if (deltaX > deltaY) {
    // Horizontal line - fix Y coordinate
    return { x: currentPoint.x, y: lastPoint.y };
  } else {
    // Vertical line - fix X coordinate
    return { x: lastPoint.x, y: currentPoint.y };
  }
};
```

### **Pin Detection System**
```typescript
// 8px tolerance for accurate pin targeting
const findPinAtPoint = (point: fabric.Point): fabric.Object | null => {
  // Iterate through component groups
  // Transform coordinates from group space to world space
  // Calculate distance and return pin if within tolerance
  const distance = point.distanceFrom(pinPoint);
  return distance <= 8 ? pin : null;
};
```

## Advanced Features

### **Pin Highlighting System**
- **Hover Highlighting**: Pins change color and size when cursor approaches
- **State Preservation**: Original pin appearance restored when highlight removed
- **Visual Feedback**: Different highlights for start pins vs end pins

### **Ghost Wire Preview**
- **Real-time Rendering**: Wire follows cursor with live preview
- **Dashed Styling**: Clear distinction between temporary and final wires
- **Orthogonal Constraints**: Automatic 90-degree angle enforcement

### **Waypoint Management**
- **Click-to-Add**: Left-click on empty canvas adds routing waypoints
- **Multiple Segments**: Support for complex routing around obstacles
- **Visual Feedback**: Clear indication of wire path and bend points

### **Professional Interactions**
- **Right-click Cancel**: Industry-standard cancellation method
- **Escape Key**: Alternative cancellation for keyboard users
- **Mode Indicators**: Clear visual feedback for current tool state

## Event Handling Architecture

### **Mouse Event Management**
```typescript
// mouse:move - Real-time ghost wire updates and pin highlighting
const handleMouseMove = (options: any) => {
  // 1. Detect pins for highlighting
  // 2. Update wire state (drawing → finishing)
  // 3. Calculate orthogonal ghost wire position
  // 4. Render real-time preview
};

// mouse:down - Start wires, add waypoints, complete connections
const handleMouseDown = (options: any) => {
  // 1. Check current state
  // 2. Detect pin vs empty canvas clicks
  // 3. Execute state transitions
  // 4. Manage wire creation/completion
};
```

### **Keyboard Event Management**
```typescript
// 'W' key - Toggle wire mode on/off
// 'ESC' key - Cancel current operation or exit mode
// Right-click - Cancel current wire drawing
```

## Canvas Integration

### **Component Pin System**
```typescript
// Enhanced resistor with connection pins
const leftPin = new fabric.Circle({
  radius: 4,
  fill: "transparent",
  stroke: "#0038DF",
  strokeWidth: 0, // Initially invisible
  pin: true,
  pinType: "left",
});
```

### **Canvas State Management**
- **Selection Disabled**: Object selection turned off during wire mode
- **Event Control**: Component interaction disabled for focused wiring
- **Cursor Management**: Professional crosshair cursor during wire mode
- **Visual Indicators**: Mode badges and state information

## User Interface Elements

### **Mode Indicator Badge**
```typescript
// Top-right corner status display
{wiringTool.isWireMode && (
  <div className="wire-mode-indicator">
    <div className="status-indicator">
      {wiringTool.wireState === 'idle' && 'Wire Mode - Click pin to start'}
      {wiringTool.wireState === 'drawing' && 'Drawing - Click to add waypoint'}
      {wiringTool.wireState === 'finishing' && 'Finishing - Click pin to complete'}
    </div>
    <div className="instructions">
      Press W to toggle • ESC to cancel • Right-click to cancel
    </div>
  </div>
)}
```

### **Visual Feedback System**
- **Animated Indicator**: Pulsing dot shows active wire mode
- **State-specific Messages**: Clear instructions for each operation phase
- **Keyboard Shortcuts**: Always-visible shortcut reminders

## Quality Assurance Features

### **Robust Error Handling**
- **Null Checks**: Comprehensive validation of canvas and pin objects
- **State Validation**: Prevents invalid state transitions
- **Memory Management**: Proper cleanup of ghost wires and highlights

### **Performance Optimization**
- **Event Debouncing**: Efficient mouse move handling
- **Selective Rendering**: Only update canvas when necessary
- **Memory Cleanup**: Proper disposal of temporary objects

### **Cross-Platform Compatibility**
- **Keyboard Handling**: Works across different operating systems
- **Mouse Events**: Consistent behavior on all input devices
- **Touch Support**: Ready for future touch device integration

## Testing Guidelines

### **Basic Functionality Tests**
1. **Mode Activation**: Press 'W', verify crosshair cursor and pin visibility
2. **Wire Creation**: Click pin → move cursor → verify orthogonal ghost wire
3. **Waypoint Addition**: Click empty canvas → verify waypoint creation
4. **Wire Completion**: Click end pin → verify solid wire creation
5. **Cancellation**: Press ESC/right-click → verify ghost wire removal

### **Advanced Scenario Tests**
1. **Complex Routing**: Create multi-segment wires with multiple waypoints
2. **Pin Highlighting**: Verify start/end pin highlighting behavior
3. **State Transitions**: Test all state machine transitions
4. **Error Recovery**: Test cancellation at each stage
5. **Performance**: Test with multiple components and wires

### **Edge Case Validation**
1. **Rapid Clicks**: Verify system handles fast user input
2. **Invalid Targets**: Test clicking on non-pin objects
3. **Mode Switching**: Test entering/exiting wire mode during drawing
4. **Canvas Zoom/Pan**: Verify wire tool works at different zoom levels

## Future Enhancement Opportunities

### **Electrical Intelligence**
- **Net Naming**: Assign names to wire networks
- **Electrical Rules**: Validate connections based on component types
- **Auto-routing**: Intelligent path finding between pins

### **Advanced Routing**
- **Bus Connections**: Multi-wire bundle support
- **Via Support**: Layer-to-layer connections
- **Differential Pairs**: Matched-length routing

### **User Experience**
- **Undo/Redo**: Wire creation/deletion history
- **Wire Styles**: Different line styles for different signal types
- **Snap Grid**: Grid-aligned wire routing

The new professional-grade wiring tool provides a solid foundation for electrical connection creation, with architecture designed to support advanced PCB design features and professional workflow requirements.
