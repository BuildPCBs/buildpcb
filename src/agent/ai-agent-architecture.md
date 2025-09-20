# AI Agent Architecture for BuildPCBs

## Overview

The BuildPCBs AI Agent is an intelligent assistant that powers advanced PCB design capabilities within the IDE. It provides engineers with AI-powered tools spanning from basic component manipulation to advanced circuit analysis and manufacturing preparation.
User

## Core Architecture

### Agent Context

```typescript
export interface AgentContext {
  // Current canvas state
  canvas: fabric.Canvas;
  circuit: Circuit;
  netlist: any[];

  // Project context
  project: Project;

  // User context
  selectedComponents: string[];
  viewportBounds: { x: number; y: number; width: number; height: number };
}
```

### Agent Capabilities Framework

```typescript
export interface AgentCapability {
  id: string;
  category: AgentCategory;
  description: string;
  execute: (context: AgentContext, params: any) => Promise<any>;
  validate?: (context: AgentContext, params: any) => boolean;
}

export type AgentCategory =
  | "component-management"
  | "wiring-connectivity"
  | "design-analysis"
  | "knowledge-rag"
  | "circuit-scaffolding"
  | "schematic-review"
  | "pcb-manufacturing"
  | "canvas-management";
```

## Agent Capabilities

### 1. Component Management

Core CRUD operations for parts on the canvas with intelligent search and placement.

#### Capabilities:

- `searchComponentDatabase(query, filters)` - Search component library with fuzzy matching
- `addComponentToCanvas(componentId, position)` - Add component with optimal placement
- `removeComponentFromCanvas(componentIds)` - Remove components and clean up connections
- `moveComponent(componentId, newPosition)` - Move with connection preservation
- `createComponentSymbol(specifications)` - Generate custom symbols from specs

#### Integration Points:

- `useComponentStore` from Zustand
- Canvas object management
- Component library database

### 2. Wiring & Connectivity

Intelligent net creation and management that transforms individual parts into functional circuits.

#### Capabilities:

- `createNetConnection(fromPin, toPin)` - Create electrical connections
- `removeNetConnection(netId)` - Remove connections with validation
- `autoWirePowerNets(powerRails)` - Auto-connect power/ground rails
- `validateConnections()` - Check for floating pins and shorts

#### Integration Points:

- Current netlist state from `ProjectContext`
- Wiring tool system
- Canvas connection rendering

### 3. Design Checks & Calculations

Basic circuit reasoning and validation for design correctness.

#### Capabilities:

- `runDesignCheck(checkTypes)` - Comprehensive design validation
- `calculateLedResistor(ledSpec, supplyVoltage)` - LED resistor calculations
- `calculateCircuitParameter(calculation)` - General circuit calculations
- `validatePowerBudget()` - Power supply capacity validation

#### Integration Points:

- Circuit analysis utilities
- Component specifications
- Real-time validation system

### 4. Knowledge & Explanation (RAG)

AI-powered learning and explanation system for circuit understanding.

#### Capabilities:

- `askKnowledgeBase(question, context)` - Query circuit knowledge
- `explainComponentFunction(componentId)` - Component behavior explanation
- `summarizeSchematic(includeCalculations)` - Circuit summary generation
- `suggestSimilarDesigns(currentCircuit)` - Pattern-based recommendations

#### Integration Points:

- RAG (Retrieval-Augmented Generation) system
- Component documentation
- Circuit pattern database

### 5. High-Level Circuit Scaffolding

Natural language to functional circuit generation.

#### Capabilities:

- `scaffoldProject(description, requirements)` - Full project generation
- `scaffoldSubCircuit(blockType, specifications)` - Sub-circuit creation
- `optimizeLayout()` - Component placement optimization

#### Integration Points:

- Natural language processing
- Circuit template library
- Layout optimization algorithms

### 6. Analysis & Review

Senior engineer-level circuit review and optimization suggestions.

#### Capabilities:

- `reviewSchematic(focusAreas)` - Comprehensive schematic review
- `suggestOptimizations(optimizationType)` - Performance improvements
- `estimateCurrentDraw(operatingConditions)` - Power consumption analysis
- `checkNetIntegrity()` - Electrical connectivity validation
- `identifyPotentialIssues()` - Proactive problem detection

#### Integration Points:

- Circuit analysis algorithms
- Design rule checking
- Performance simulation

### 7. PCB & Manufacturing Prep

Bridge between schematic design and physical board manufacturing.

#### Capabilities:

- `generateNetlist(format)` - Export in various formats
- `exportBOM(includeAlternatives)` - Bill of Materials generation
- `assignFootprints(preferredManufacturers)` - Footprint assignment
- `checkPowerTraceWidths(currentRequirements)` - Trace width validation
- `estimateManufacturingCost()` - Cost estimation

#### Integration Points:

- Netlist generation system
- Component database with footprints
- Manufacturing specifications

### 8. Project & Canvas Management

Tool-level interaction and canvas manipulation capabilities.

#### Capabilities:

- `renameProject(newName)` - Project management
- `highlightComponent(componentIds, highlightStyle)` - Visual feedback
- `annotateCanvas(annotation)` - Canvas annotations
- `groupIntoBlock(componentIds, blockName)` - Component grouping
- `cleanUpWiring(strategy)` - Wiring optimization

#### Integration Points:

- `ProjectContext` for project operations
- Fabric.js canvas manipulation
- Visual feedback system

## Integration with Existing Codebase

### ProjectContext Integration

```typescript
import { useProject } from "@/contexts/ProjectContext";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";

export class AIAgentService {
  private context: AgentContext;

  constructor() {
    this.context = this.buildContext();
  }

  private buildContext(): AgentContext {
    const { currentProject, currentCircuit, currentNetlist } = useProject();
    const canvas = canvasCommandManager.getCanvas();

    return {
      canvas,
      circuit: currentCircuit!,
      netlist: currentNetlist || [],
      project: currentProject!,
      selectedComponents: this.getSelectedComponents(),
      viewportBounds: this.getViewportBounds(),
    };
  }

  async executeCapability(capabilityId: string, params: any): Promise<any> {
    const capability = this.getCapability(capabilityId);
    return capability.execute(this.context, params);
  }
}
```

### State Management Integration

- **Zustand Stores**: Component state, canvas state, UI state
- **Project Context**: Project lifecycle, data persistence
- **Canvas Command Manager**: Canvas operations, undo/redo

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

1. Component Management capabilities
2. Canvas Management capabilities
3. Basic agent service infrastructure

### Phase 2: Core Functionality (Week 3-4)

1. Wiring & Connectivity capabilities
2. Design Checks & Calculations
3. Knowledge base integration

### Phase 3: Intelligence (Week 5-6)

1. Circuit Scaffolding (natural language)
2. Analysis & Review capabilities
3. RAG system for explanations

### Phase 4: Manufacturing (Week 7-8)

1. PCB Manufacturing Prep
2. Netlist generation
3. BOM export capabilities

## Technical Specifications

### Dependencies

- OpenAI GPT-4 for natural language processing
- Vector database for RAG (Pinecone/Chroma)
- Circuit simulation libraries
- Component database integration

### Performance Requirements

- Response time < 2 seconds for basic operations
- < 5 seconds for complex analysis
- Real-time validation during design
- Background processing for heavy computations

### Security Considerations

- Input validation for all user queries
- Safe execution environment for code generation
- Component library access controls
- Project data privacy

### Testing Strategy

- Unit tests for individual capabilities
- Integration tests with canvas operations
- End-to-end tests for complete workflows
- Performance benchmarks for AI operations

## Future Enhancements

### Advanced Features

- Multi-language support for component libraries
- Collaborative design review
- Integration with SPICE simulation
- 3D visualization of PCB layouts
- Automated design optimization
- Machine learning for design pattern recognition

### Scalability

- Distributed processing for heavy computations
- Caching layer for frequently accessed data
- Progressive enhancement for large circuits
- Cloud-based processing for complex analysis

---

_This architecture provides a solid foundation for an intelligent PCB design assistant that grows with the needs of professional engineers._
