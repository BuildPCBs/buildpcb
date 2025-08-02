# 🔌 Professional Wiring Tool - User Guide

## Overview
The BuildPCB wiring tool allows you to create electrical connections between components with professional orthogonal routing. This guide will walk you through every feature and provide tips for efficient circuit design.

## 🚀 Quick Start

### 1. **Activate Wire Mode**
```
Press the 'W' key
```
- Cursor changes to crosshair ✚
- Component pins become visible as blue circles
- Wire mode indicator appears in top-right corner

### 2. **Start Drawing a Wire**
```
Click on any component pin (blue circle)
```
- Pin highlights when you hover over it
- Ghost wire (dashed line) appears and follows your cursor
- Status shows "Drawing - Click to add waypoint"

### 3. **Route Your Wire**
```
Move cursor around the canvas
```
- Wire automatically follows orthogonal paths (90-degree angles only)
- System intelligently chooses horizontal or vertical direction
- Real-time preview shows exactly where your wire will go

### 4. **Add Waypoints (Optional)**
```
Click on empty canvas space
```
- Creates a routing point for complex paths
- Allows wiring around other components
- Each click adds a new segment to your wire

### 5. **Complete the Connection**
```
Click on the destination pin
```
- End pin highlights when you hover over it
- Status shows "Finishing - Click pin to complete"
- Solid wire is created connecting the two pins

### 6. **Exit Wire Mode**
```
Press 'W' again or 'ESC' key
```
- Returns to normal component mode
- Pins become invisible again
- Cursor returns to normal arrow

## 📋 Detailed Features

### **Pin System**
- **Pin Visibility**: Pins only appear during wire mode for clean design
- **Pin Highlighting**: 
  - Blue circle appears when hovering over valid pins
  - Pins grow slightly larger when highlighted
  - Different visual feedback for start vs end pins
- **Pin Detection**: 8px tolerance for easy targeting

### **Orthogonal Routing**
- **Automatic Direction**: System chooses horizontal or vertical based on cursor movement
- **90-Degree Angles**: All wires maintain professional right-angle bends
- **Smart Routing**: Optimal path calculation for clean circuit appearance

### **Waypoint System**
- **Multiple Segments**: Create complex routing paths
- **Click-to-Add**: Left-click empty canvas to add routing points
- **Visual Preview**: See complete wire path before finalizing

### **Wire Properties**
- **Professional Styling**: 2px width with rounded end caps
- **Brand Colors**: Consistent #0038DF blue throughout
- **Selectable Objects**: Completed wires can be selected and deleted
- **Single Object**: Multi-segment wires are one selectable polyline

## 🎯 Step-by-Step Examples

### **Example 1: Simple Connection**
1. Add two resistors to canvas
2. Press `W` to enter wire mode
3. Click left pin of first resistor
4. Move cursor to right pin of second resistor
5. Click to complete connection
6. Press `W` to exit wire mode

### **Example 2: Complex Routing**
1. Add components with obstacles between them
2. Press `W` to enter wire mode
3. Click starting pin
4. Move cursor horizontally, click to add waypoint
5. Move cursor vertically around obstacle, click waypoint
6. Move cursor horizontally to destination area
7. Click destination pin to complete
8. Press `W` to exit

### **Example 3: Multiple Connections**
1. Enter wire mode with `W`
2. Create first connection (start pin → end pin)
3. Immediately start second connection (tool stays in wire mode)
4. Continue creating multiple wires
5. Press `W` when finished with all connections

## ⚡ Pro Tips

### **Efficient Workflow**
- **Stay in Wire Mode**: Tool remains active for multiple connections
- **Plan Your Routes**: Think about wire organization before starting
- **Use Waypoints**: Route around components for cleaner layouts
- **Layer Awareness**: Consider component placement for easier wiring

### **Best Practices**
- **Minimize Crossings**: Use waypoints to avoid wire intersections
- **Consistent Spacing**: Maintain even spacing between parallel wires
- **Logical Grouping**: Group related connections together
- **Clean Exits**: Exit pins at appropriate angles for neat appearance

### **Keyboard Shortcuts**
| Key | Action |
|-----|--------|
| `W` | Toggle wire mode on/off |
| `ESC` | Cancel current wire or exit mode |
| `Right-click` | Cancel current wire drawing |
| `Left-click` | Start wire / Add waypoint / Complete wire |

## 🎨 Visual Feedback Guide

### **Status Indicators**
- **"Wire Mode - Click pin to start"**: Ready to begin new wire
- **"Drawing - Click to add waypoint"**: Actively routing wire
- **"Finishing - Click pin to complete"**: Hovering over valid end pin

### **Visual Elements**
- **Crosshair Cursor**: Indicates wire mode is active
- **Blue Pin Circles**: Show available connection points
- **Dashed Ghost Wire**: Preview of wire being drawn
- **Solid Blue Lines**: Completed electrical connections
- **Animated Pulse**: Mode indicator shows tool is active

## 🛠️ Troubleshooting

### **Common Issues**

#### **Can't Start Wire**
- ✅ Ensure you're in wire mode (press `W`)
- ✅ Click directly on blue pin circles
- ✅ Make sure pins are visible and highlighted

#### **Wire Won't Complete**
- ✅ Click on destination pin (not near it)
- ✅ Ensure end pin highlights before clicking
- ✅ Check that you're clicking a different pin than start

#### **Can't Add Waypoints**
- ✅ Click on empty canvas (not on components)
- ✅ Ensure you're in "Drawing" state
- ✅ Try clicking in clear areas away from components

#### **Wire Mode Won't Activate**
- ✅ Press `W` key (not in text input fields)
- ✅ Ensure canvas area has focus
- ✅ Check that mode indicator appears

### **Cancellation Options**
- **Cancel Current Wire**: Press `ESC` or right-click
- **Exit Wire Mode**: Press `W` again or `ESC`
- **Remove Completed Wire**: Select wire and press Delete

## 🎯 Advanced Techniques

### **Professional Circuit Layout**
1. **Grid Planning**: Mentally divide canvas into grid sections
2. **Signal Flow**: Route power connections first, then signals
3. **Hierarchy**: Main connections before detailed routing
4. **Documentation**: Use consistent routing patterns

### **Complex Component Connections**
1. **Multi-pin Components**: Connect one pin at a time
2. **Bus Connections**: Create parallel wire groups
3. **Power Distribution**: Use star or tree patterns
4. **Signal Integrity**: Minimize wire lengths where needed

### **Design Organization**
1. **Color Coding**: Future feature for different wire types
2. **Net Naming**: Future feature for wire identification
3. **Layer Management**: Future multi-layer support
4. **Design Rules**: Future electrical validation

## 📖 Component Integration

### **Supported Components**
- **Resistors**: Left and right connection pins
- **Future Components**: Capacitors, ICs, connectors will have appropriate pin layouts

### **Pin Locations**
- **Resistors**: Pins at left (-50px) and right (+70px) ends
- **Component Groups**: Pins move with parent components
- **Coordinate System**: World coordinates for accurate placement

## 🎉 Getting Started Checklist

- [ ] Add some resistors to your canvas
- [ ] Press `W` to activate wire mode
- [ ] Notice the crosshair cursor and visible pins
- [ ] Click on a pin to start your first wire
- [ ] Move cursor and observe orthogonal routing
- [ ] Click another pin to complete the connection
- [ ] Try adding waypoints by clicking empty space
- [ ] Press `ESC` to cancel if needed
- [ ] Press `W` to exit wire mode when done

## 🚀 Next Steps

Once you're comfortable with basic wiring:
1. **Practice Complex Routing**: Try multi-waypoint connections
2. **Organize Your Circuits**: Plan component placement for clean wiring
3. **Explore Integration**: Use with copy/paste and other canvas tools
4. **Prepare for Advanced Features**: Net naming, design rules, auto-routing

---

**💡 Remember**: The wiring tool is designed to feel natural and professional. Take your time to explore the features and develop your own efficient workflow patterns!

**🎯 Happy Circuit Building!** 🔌⚡
