# Elastic Wire System Documentation

## Overview

The Elastic Wire System provides advanced wire drawing capabilities for BuildPCBs with smooth elastic behavior, tension visualization, and seamless net integration. This system enhances the user experience by providing visual feedback during wire creation and maintaining proper electrical connectivity.

## Architecture

### Core Components

1. **ElasticWire Class** (`ElasticWire.ts`)

   - Core elastic wire implementation
   - Handles tension calculation and visualization
   - Manages wire geometry and animation

2. **useElasticWire Hook** (`useElasticWire.ts`)

   - React hook for managing elastic wire state
   - Integrates with netlist system
   - Provides wire lifecycle management

3. **Integration Layer**
   - Seamless integration with existing wire system
   - Net-based electrical connectivity
   - Database persistence support

## Key Features

### 🎯 Elastic Behavior

- **Smooth Stretching**: Wires stretch smoothly as you drag
- **Tension Visualization**: Color and thickness change based on tension
- **Real-time Feedback**: Immediate visual response to user input

### 🔗 Net Integration

- **Automatic Net Creation**: Wires automatically create/manage electrical nets
- **Net Merging**: Smart net merging when connecting existing nets
- **Connection Tracking**: Full connection data persistence

### 🎨 Visual Design

- **Tension-Based Coloring**:
  - Blue: Normal tension
  - Orange: Medium tension
  - Red: High tension
- **Dynamic Thickness**: Stroke width increases with tension
- **Smooth Animation**: 60fps elastic animations

### 💾 Database Persistence

- **Complete Serialization**: Full wire state saved to database
- **Net Preservation**: Electrical connectivity maintained across sessions
- **Version Compatibility**: Backward compatible with existing data

## Usage

### Basic Usage

```typescript
import { useElasticWire } from "@/canvas/hooks/useElasticWire";

function SchematicCanvas() {
  const elasticWire = useElasticWire({
    canvas: canvasRef.current,
    enabled: true,
    onNetlistChange: handleNetlistChange,
  });

  // Toggle elastic wire mode
  const handleToggleElastic = () => {
    elasticWire.toggleElasticMode();
  };

  return (
    <div>
      <button onClick={handleToggleElastic}>
        {elasticWire.isElasticMode ? "Exit Elastic Mode" : "Enter Elastic Mode"}
      </button>
      {/* Canvas component */}
    </div>
  );
}
```

### Advanced Configuration

```typescript
const elasticWire = useElasticWire({
  canvas: canvasRef.current,
  config: {
    strokeColor: "#0066CC",
    baseStrokeWidth: 1.5,
    maxStrokeWidth: 4,
    animationDuration: 200,
    tensionThreshold: 75,
    damping: 0.7,
    springConstant: 0.15,
  },
  onNetlistChange: (nets) => {
    // Handle netlist changes
    saveToDatabase(nets);
  },
});
```

## API Reference

### useElasticWire Hook

#### Props

```typescript
interface UseElasticWireProps {
  canvas: fabric.Canvas | null;
  enabled?: boolean;
  config?: Partial<ElasticWireConfig>;
  onNetlistChange?: (nets: any[]) => void;
  initialNetlist?: any[];
}
```

#### Return Value

```typescript
interface UseElasticWireReturn {
  // State
  isElasticMode: boolean;
  isDrawing: boolean;
  currentElasticWire: ElasticWire | null;
  elasticConnections: ElasticWireConnection[];

  // Actions
  toggleElasticMode: () => void;
  exitElasticMode: () => void;
  startElasticWire: (startPoint: fabric.Point, startPin: fabric.Object) => void;
  updateElasticWire: (
    endPoint: fabric.Point,
    targetPin?: fabric.Object
  ) => void;
  finishElasticWire: (endPin: fabric.Object) => void;
  cancelElasticWire: () => void;
  addBendPoint: (point: fabric.Point) => void;
  clearBendPoints: () => void;

  // Management
  clearAllElasticWires: () => void;
  getElasticWireById: (id: string) => ElasticWireConnection | null;
  removeElasticWire: (id: string) => void;

  // Net integration
  nets: any[];
  setNetlist: (nets: any[]) => void;

  // Serialization
  serializeElasticWires: () => any[];
  deserializeElasticWires: (data: any[]) => void;
}
```

### ElasticWire Class

#### Constructor

```typescript
constructor(
  startPoint: fabric.Point,
  endPoint: fabric.Point,
  config?: Partial<ElasticWireConfig>,
  canvas?: fabric.Canvas
)
```

#### Methods

```typescript
// Update wire endpoint
updateEndPoint(newEndPoint: fabric.Point): void

// Add bend point for multi-segment wires
addBendPoint(point: fabric.Point): void
clearBendPoints(): void

// Set connection data for net management
setConnectionData(data: ElasticWireState['connectionData']): void

// Convert to regular wire (remove elastic properties)
convertToRegularWire(): fabric.Path | null

// Get current state
getState(): ElasticWireState
getTension(): number
isHighTension(): boolean

// Serialization
serialize(): any
static deserialize(data: any, canvas?: fabric.Canvas): ElasticWire

// Cleanup
destroy(): void
```

## Configuration Options

### ElasticWireConfig

```typescript
interface ElasticWireConfig {
  strokeColor: string; // Base wire color
  baseStrokeWidth: number; // Normal wire thickness
  maxStrokeWidth: number; // Maximum thickness when stretched
  animationDuration: number; // Animation duration in ms
  tensionThreshold: number; // Distance for max tension
  damping: number; // Elastic damping factor (0-1)
  springConstant: number; // Spring behavior constant
}
```

### Default Configuration

```typescript
const DEFAULT_ELASTIC_CONFIG: ElasticWireConfig = {
  strokeColor: "#0038DF",
  baseStrokeWidth: 1,
  maxStrokeWidth: 3,
  animationDuration: 300,
  tensionThreshold: 50,
  damping: 0.8,
  springConstant: 0.1,
};
```

## Net Integration

### Automatic Net Management

The elastic wire system automatically manages electrical nets:

1. **New Net Creation**: When connecting two unconnected pins
2. **Net Merging**: When connecting pins from different existing nets
3. **Net Extension**: When connecting to an existing net

### Net Data Structure

```typescript
interface Net {
  netId: string;
  connections: NetConnection[];
  name?: string;
}

interface NetConnection {
  componentId: string;
  pinNumber: string;
}
```

## Database Schema

### Wire Storage

```sql
-- Elastic wires are stored as part of the netlist
CREATE TABLE schematic_nets (
  id SERIAL PRIMARY KEY,
  schematic_id INTEGER REFERENCES schematics(id),
  net_data JSONB, -- Contains net information with wire connections
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Serialized Data Structure

```typescript
interface SerializedElasticWire {
  id: string;
  wireData: {
    type: "elasticWire";
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
    bendPoints: Array<{ x: number; y: number }>;
    connectionData: {
      fromComponentId: string;
      fromPinNumber: string;
      toComponentId: string;
      toPinNumber: string;
    };
    config: ElasticWireConfig;
  };
  fromComponentId: string;
  fromPinNumber: string;
  toComponentId: string;
  toPinNumber: string;
  netId: string;
}
```

## Performance Considerations

### Optimization Strategies

1. **Canvas Batching**: Multiple canvas operations batched together
2. **Selective Rendering**: Only affected wires re-rendered
3. **Memory Management**: Proper cleanup of fabric objects
4. **Animation Throttling**: 60fps animation with requestAnimationFrame

### Memory Management

```typescript
// Automatic cleanup on unmount
useEffect(() => {
  return () => {
    if (currentElasticWire) {
      currentElasticWire.destroy();
    }
    elasticConnections.forEach((connection) => {
      connection.elasticWire.destroy();
    });
  };
}, [currentElasticWire, elasticConnections]);
```

## Integration with Existing System

### Migration Path

1. **Gradual Adoption**: Can coexist with existing wire system
2. **Backward Compatibility**: Existing wires remain functional
3. **Feature Flags**: Enable elastic wires per user preference

### Canvas Integration

```typescript
// Integration with existing canvas setup
const elasticWire = useElasticWire({
  canvas: canvasRef.current,
  enabled: true,
  onNetlistChange: (nets) => {
    // Update existing netlist system
    existingNetlistSystem.update(nets);
  },
});
```

## Error Handling

### Common Issues

1. **Canvas Not Available**: Graceful degradation when canvas unmounted
2. **Invalid Pin Data**: Validation before wire creation
3. **Net Conflicts**: Automatic resolution of net conflicts

### Error Recovery

```typescript
try {
  elasticWire.startElasticWire(startPoint, startPin);
} catch (error) {
  logger.error("Failed to start elastic wire:", error);
  // Fallback to regular wire system
  fallbackWireSystem.startWire(startPoint, startPin);
}
```

## Testing

### Unit Tests

```typescript
describe("ElasticWire", () => {
  it("should create elastic wire with correct initial state", () => {
    const wire = new ElasticWire(startPoint, endPoint);
    expect(wire.getTension()).toBe(0);
  });

  it("should update tension based on distance", () => {
    const wire = new ElasticWire(startPoint, endPoint);
    wire.updateEndPoint(farPoint);
    expect(wire.getTension()).toBeGreaterThan(0.5);
  });
});
```

### Integration Tests

```typescript
describe("useElasticWire", () => {
  it("should integrate with netlist system", () => {
    const { result } = renderHook(() => useElasticWire({ canvas }));
    // Test net creation and management
  });
});
```

## Future Enhancements

### Planned Features

1. **Wire Routing Algorithms**: Automatic obstacle avoidance
2. **Wire Bundling**: Visual grouping of related wires
3. **Wire Labels**: Automatic net name labeling
4. **Wire Simulation**: Real-time electrical simulation
5. **Collaborative Editing**: Multi-user wire editing

### Performance Improvements

1. **WebWorkers**: Offload complex calculations
2. **Virtual Scrolling**: Handle large numbers of wires
3. **LOD Rendering**: Level-of-detail for wire complexity

## Troubleshooting

### Common Issues

**Issue**: Wires not appearing elastic
**Solution**: Check canvas reference and elastic mode state

**Issue**: Net connections not updating
**Solution**: Verify `onNetlistChange` callback is properly set

**Issue**: Performance degradation with many wires
**Solution**: Implement wire culling for off-screen wires

### Debug Information

```typescript
// Enable detailed logging
logger.wire.setLevel("debug");

// Inspect wire state
console.log("Elastic wire state:", elasticWire.getState());
console.log("Netlist:", elasticWire.nets);
```

## Conclusion

The Elastic Wire System provides a modern, professional wire drawing experience for BuildPCBs with comprehensive net integration and database persistence. The system is designed for performance, maintainability, and extensibility, making it a solid foundation for advanced PCB design features.

For questions or contributions, please refer to the main BuildPCBs documentation or create an issue in the project repository.
