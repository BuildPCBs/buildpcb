# Canvas Reference System

## Overview

Interactive system for making AI response elements clickable to highlight and reference components on the canvas.

## Reference Types

### Component References

```typescript
interface ComponentReference {
  type: "component";
  componentId: string;
  highlightStyle: "pulse" | "outline" | "glow" | "blink";
  duration: number; // milliseconds
  action: "highlight" | "zoom" | "select" | "info";
}
```

### Connection References

```typescript
interface ConnectionReference {
  type: "connection";
  connectionId: string;
  fromComponent: string;
  toComponent: string;
  highlightPath: boolean;
  showFlow?: boolean; // animate signal flow
}
```

### Area References

```typescript
interface AreaReference {
  type: "area";
  components: string[];
  label: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  highlightStyle: "border" | "overlay" | "background";
}
```

### Circuit Section References

```typescript
interface SectionReference {
  type: "section";
  name: string;
  description: string;
  components: string[];
  functionality: string;
  highlightColor: string;
}
```

## Response Integration

### Clickable Text Format

AI responses should include special markdown syntax for canvas references:

```markdown
The [[resistor:R1|330Ω resistor]] limits current to the [[led:LED1|status LED]].

The [[section:power-supply|power supply section]] provides stable 5V output.

Check the [[connection:R1-LED1|connection between R1 and LED1]] for proper soldering.
```

### Reference Syntax

```
[[type:id|display-text]]
[[type:id|display-text|action]]
[[type:id|display-text|action|duration]]
```

**Examples:**

- `[[component:R1|330Ω resistor]]` - Basic component reference
- `[[component:R1|this resistor|zoom|2000]]` - Zoom to component for 2 seconds
- `[[section:amplifier|op-amp stage|highlight|3000]]` - Highlight section for 3 seconds
- `[[connection:R1-C1|RC filter|trace|1500]]` - Trace connection path

### Parsed Reference Object

```typescript
interface ParsedReference {
  originalText: string;
  displayText: string;
  reference:
    | ComponentReference
    | ConnectionReference
    | AreaReference
    | SectionReference;
  position: {
    start: number;
    end: number;
  };
}
```

## Canvas Integration

### Highlight Effects

```typescript
interface HighlightEffect {
  componentId: string;
  effect: {
    type: "pulse" | "outline" | "glow" | "blink" | "bounce";
    color: string;
    intensity: number; // 0-1
    duration: number;
    repeat?: number;
  };
  onComplete?: () => void;
}
```

### Canvas Actions

```typescript
interface CanvasAction {
  type: "highlight" | "zoom" | "select" | "pan" | "info" | "trace";
  target: string | string[];
  options: {
    duration?: number;
    intensity?: number;
    color?: string;
    showTooltip?: boolean;
    animateEntry?: boolean;
  };
}
```

### Fabric.js Implementation

```typescript
class CanvasReferenceManager {
  private canvas: fabric.Canvas;
  private activeHighlights: Map<string, fabric.Object[]> = new Map();

  highlightComponent(componentId: string, options: HighlightOptions): void {
    // Find component on canvas
    // Apply highlight effect
    // Set auto-removal timer
  }

  traceConnection(connectionId: string, options: TraceOptions): void {
    // Find connection path
    // Animate signal flow
    // Highlight connected components
  }

  zoomToComponent(componentId: string, zoomLevel?: number): void {
    // Calculate component bounds
    // Smooth zoom animation
    // Center component in view
  }
}
```

## Frontend Integration

### Response Renderer Component

```typescript
interface ResponseRendererProps {
  content: string;
  onReferenceClick: (reference: ParsedReference) => void;
  canvasManager: CanvasReferenceManager;
}

const ResponseRenderer: React.FC<ResponseRendererProps> = ({
  content,
  onReferenceClick,
  canvasManager,
}) => {
  const references = parseReferences(content);

  return (
    <div className="response-content">
      {renderWithClickableReferences(content, references, onReferenceClick)}
    </div>
  );
};
```

### Reference Parser

```typescript
function parseReferences(text: string): ParsedReference[] {
  const referenceRegex =
    /\[\[([^|]+):([^|]+)\|([^|\]]+)(?:\|([^|\]]+))?(?:\|(\d+))?\]\]/g;
  const references: ParsedReference[] = [];

  let match;
  while ((match = referenceRegex.exec(text)) !== null) {
    const [fullMatch, type, id, displayText, action, duration] = match;

    references.push({
      originalText: fullMatch,
      displayText,
      reference: createReference(type, id, action, parseInt(duration) || 1000),
      position: {
        start: match.index,
        end: match.index + fullMatch.length,
      },
    });
  }

  return references;
}
```

## Visual Feedback

### Hover States

```typescript
interface HoverFeedback {
  componentPreview: boolean; // Show component info on hover
  pathHighlight: boolean; // Highlight connection paths
  tooltipInfo: string; // Component details tooltip
  cursorStyle: "pointer" | "crosshair" | "zoom-in";
}
```

### Click Feedback

```typescript
interface ClickFeedback {
  visualConfirmation: boolean; // Flash or pulse on click
  soundEnabled: boolean; // Audio feedback
  hapticEnabled: boolean; // Vibration on mobile
  showActionResult: boolean; // Display what action was performed
}
```

## Advanced Features

### Multi-Component References

```markdown
The [[group:power-components|power supply components]] including [[component:U1|voltage regulator]], [[component:C1|input capacitor]], and [[component:C2|output capacitor]] work together.
```

### Conditional References

```typescript
interface ConditionalReference {
  condition: "exists" | "selected" | "visible" | "valid";
  fallback: {
    action: "disable" | "hide" | "replace";
    replacement?: string;
  };
}
```

### Animation Sequences

```typescript
interface AnimationSequence {
  name: string;
  steps: {
    componentId: string;
    delay: number;
    duration: number;
    effect: HighlightEffect;
  }[];
  totalDuration: number;
}

// Example: Show signal flow through circuit
const signalFlowAnimation: AnimationSequence = {
  name: "signal-flow",
  steps: [
    { componentId: "INPUT", delay: 0, duration: 500, effect: pulsEffect },
    { componentId: "R1", delay: 500, duration: 300, effect: flowEffect },
    { componentId: "C1", delay: 800, duration: 300, effect: flowEffect },
    {
      componentId: "OUTPUT",
      delay: 1100,
      duration: 500,
      effect: arrivalEffect,
    },
  ],
  totalDuration: 1600,
};
```

### Context-Aware References

```typescript
interface ContextAwareReference {
  baseReference: ComponentReference;
  context: {
    zoomLevel: number;
    selectedComponents: string[];
    visibleArea: BoundingBox;
    userExperience: "beginner" | "intermediate" | "expert";
  };
  adaptedAction: CanvasAction;
}
```

## Analytics & Optimization

### Usage Tracking

```typescript
interface ReferenceAnalytics {
  clickRate: number; // How often users click references
  popularComponents: string[]; // Most referenced components
  effectiveActions: string[]; // Which actions help users most
  sessionEngagement: number; // Time spent interacting with references
}
```

### Performance Optimization

- Debounce rapid reference clicks
- Batch canvas updates for multiple references
- Cache highlight animations for reuse
- Optimize rendering for large circuits

## Integration with AI Responses

### Response Enhancement

AI should strategically use references to:

1. **Guide attention** to relevant components
2. **Explain relationships** between parts
3. **Demonstrate concepts** through interaction
4. **Facilitate learning** by connecting theory to visual

### Smart Reference Selection

```typescript
interface SmartReferenceStrategy {
  prioritizeNewComponents: boolean; // Highlight recently added parts
  emphasizeProblemAreas: boolean; // Focus on issues or modifications
  supportLearningFlow: boolean; // Guide through circuit understanding
  minimizeDistraction: boolean; // Don't over-reference simple parts
}
```
