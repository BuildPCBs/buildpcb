# Circuit Response Schema

## Core Data Structures

### Circuit JSON Schema

```typescript
interface CircuitResponse {
  mode: "full" | "edit";
  circuit?: FullCircuit; // for generation mode
  edit?: CircuitPatch; // for modification mode
  metadata: {
    timestamp: string;
    version: string;
    explanation: string;
  };
  canvasReferences?: CanvasReference[]; // clickable references to canvas elements
  sessionContext?: {
    circuitId?: string;
    isRestoration?: boolean;
    previousState?: string; // snapshot ID if this is a continuation
  };
}

interface CanvasReference {
  id: string;
  type: "component" | "connection" | "area" | "section";
  targetId: string;
  displayText: string;
  action: "highlight" | "zoom" | "select" | "trace";
  position: {
    start: number;
    end: number;
  };
}

interface FullCircuit {
  id: string;
  name: string;
  description: string;
  components: Component[];
  connections: Connection[];
  layout: LayoutInfo;
}

interface CircuitPatch {
  id: string;
  operations: PatchOperation[];
  affectedComponents: string[];
}
```

### Component Model

Every component must have these required fields:

```typescript
interface Component {
  id: string; // unique, immutable
  type: ComponentType; // resistor, LED, IC, etc.
  value: string; // 330Ω, 10µF, etc.
  position: {
    // for Fabric.js rendering
    x: number;
    y: number;
  };
  connections: Pin[]; // netlist style connections
  datasheet: string; // link/path to datasheet
  explanation: string; // AI reasoning for this part
  metadata: {
    package?: string; // DIP, SMD, etc.
    rating?: string; // power, voltage ratings
    tolerance?: string; // for precision components
  };
}

type ComponentType =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "led"
  | "diode"
  | "transistor"
  | "ic"
  | "microcontroller"
  | "sensor"
  | "switch"
  | "button"
  | "connector"
  | "battery"
  | "voltage_regulator";

interface Pin {
  id: string;
  name: string;
  netId: string;
  type: "input" | "output" | "bidirectional" | "power" | "ground";
}
```

## Interaction Modes

### Full Generation Mode

AI outputs entire circuit JSON with:

- Complete component list
- All connections defined
- Layout positioning
- Full explanations

### Edit Mode

AI outputs patch object with:

- Specific operations (add, remove, modify)
- Only affected components
- Incremental changes
- Change reasoning

```typescript
interface PatchOperation {
  type: "add" | "remove" | "modify" | "connect" | "disconnect";
  target: string; // component ID or connection ID
  data?: any; // new data for add/modify operations
  reason: string; // explanation for this change
}
```

### Context Summaries

Lightweight state snapshots to protect against AI drift:

```typescript
interface CircuitSummary {
  id: string;
  componentCount: number;
  primaryFunction: string;
  keyComponents: string[];
  lastModified: string;
  validationStatus: "valid" | "warning" | "error";
}
```

## AI Guardrails

### Validation Rules

1. **Schema Validation**: All responses must validate against TypeScript schema
2. **ID Integrity**: Reject edits referencing unknown component IDs
3. **Immutable Fields**: Reject attempts to change immutable fields (id, type)
4. **Connection Validation**: Ensure all connections reference valid pins
5. **Value Validation**: Component values must be realistic and properly formatted

### Fallback Strategy

```
AI Response → Validate Schema
    ├── Valid? → Apply to Circuit
    └── Invalid? → Rollback to Last Summary → Retry with Constraints
```

### Required Explanations

Every component must include:

- Why this component was chosen
- How it fits in the overall circuit
- Key specifications and their importance
- Alternative components that could work

## Error Handling

### Common Error Types

```typescript
interface ValidationError {
  type: "schema" | "reference" | "value" | "connection";
  field: string;
  message: string;
  suggestion?: string;
}
```

### Response Status

```typescript
interface ResponseStatus {
  success: boolean;
  errors: ValidationError[];
  warnings: string[];
  appliedOperations?: number;
}
```

## Rendering Integration

### Fabric.js Coordinate System

- Grid standardized at 10px = 1 unit
- Origin at top-left of canvas
- Components snap to grid intersections

### Component Symbol Mapping

```typescript
const SYMBOL_LIBRARY = {
  resistor: { symbol: "zigzag", width: 40, height: 10 },
  capacitor: { symbol: "parallel_plates", width: 20, height: 30 },
  led: { symbol: "diode_arrow", width: 25, height: 20 },
  ic: { symbol: "rectangle", width: 60, height: 40 },
  // ... more mappings
};
```

### Rendering Strategy

- **Full Circuit**: Render entire circuit from JSON
- **Edit Mode**: Apply patch operations and update only affected elements
- **Progressive Loading**: Large circuits render in chunks to maintain performance

## Related Documentation

- **[Circuit State Management](./circuit-state-management.md)** - How circuit states are saved, restored, and maintained across sessions
- **[Restore Endpoint](./restore-endpoint-docs.md)** - API documentation for state restoration and recovery
- **[Canvas Reference System](./canvas-reference-system.md)** - Interactive references between AI responses and canvas elements
