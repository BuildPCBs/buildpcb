# Circuit State Management

## Overview

Documentation for saving, restoring, and maintaining circuit state across chat sessions and user interactions.

## State Persistence Strategy

### Circuit State Structure

```typescript
interface CircuitState {
  id: string;
  sessionId: string;
  userId: string;
  circuit: FullCircuit;
  history: CircuitVersion[];
  metadata: {
    created: string;
    lastModified: string;
    version: number;
    tags: string[];
  };
}

interface CircuitVersion {
  id: string;
  timestamp: string;
  operation: "create" | "edit" | "restore";
  changes: PatchOperation[];
  userPrompt?: string;
  aiResponse?: string;
}
```

### Chat Continuation Context

When user continues a conversation about an existing circuit:

```typescript
interface ChatContext {
  circuitId: string;
  currentState: CircuitState;
  conversationHistory: ChatMessage[];
  lastOperation: {
    type: "generation" | "edit";
    timestamp: string;
    components: string[]; // affected component IDs
  };
}

interface ChatMessage {
  id: string;
  timestamp: string;
  role: "user" | "assistant";
  content: string;
  circuitChanges?: PatchOperation[];
}
```

## Reading Current Circuit State

### Pre-Request State Check

Before processing any user request, the system must:

1. **Identify Circuit Context**

   ```typescript
   async function loadCircuitContext(
     sessionId: string
   ): Promise<ChatContext | null> {
     // Check if user is referencing existing circuit
     // Load current circuit state
     // Retrieve conversation history
     // Return context for AI processing
   }
   ```

2. **State Validation**

   ```typescript
   interface StateValidation {
     isValid: boolean;
     lastKnownGood: string; // timestamp
     corruptedComponents: string[];
     repairActions: string[];
   }
   ```

3. **Conflict Resolution**
   - Handle concurrent edits
   - Merge conflicting changes
   - Preserve user intent

### State Loading Process

```
User Request → Check Session Context
    ├── No Circuit? → Full Generation Mode
    ├── Has Circuit? → Load Current State
    │   ├── Validate State Integrity
    │   ├── Load Conversation History
    │   └── Prepare Edit Mode Context
    └── State Corrupted? → Restore from Last Good Version
```

## Automatic State Snapshots

### Snapshot Triggers

- Before any AI-generated changes
- After successful user edits
- At regular intervals during long sessions
- Before major circuit modifications

### Snapshot Structure

```typescript
interface CircuitSnapshot {
  id: string;
  circuitId: string;
  timestamp: string;
  trigger: "auto" | "manual" | "pre-edit" | "checkpoint";
  state: FullCircuit;
  compressed: boolean; // for large circuits
  metadata: {
    componentCount: number;
    connectionCount: number;
    byteSize: number;
  };
}
```

### Retention Policy

- Keep last 10 snapshots for active sessions
- Daily snapshots for 30 days
- Weekly snapshots for 6 months
- Archive major versions permanently

## State Synchronization

### Real-time Updates

For collaborative editing:

```typescript
interface StateUpdate {
  circuitId: string;
  userId: string;
  operation: PatchOperation;
  timestamp: string;
  clientId: string;
}
```

### Conflict Resolution Strategy

1. **Optimistic Updates** - Apply changes immediately
2. **Conflict Detection** - Check for overlapping modifications
3. **Merge Strategy** - Preserve both changes when possible
4. **User Notification** - Alert when manual resolution needed

## Performance Considerations

### Large Circuit Handling

- Compress inactive circuit sections
- Load components on-demand
- Use differential updates for changes
- Implement circuit pagination for massive designs

### Memory Management

```typescript
interface MemoryLimits {
  maxActiveCircuits: number;
  maxSnapshotsPerCircuit: number;
  maxHistoryLength: number;
  circuitSizeLimit: number; // in bytes
}
```

## Error Recovery

### Common State Issues

1. **Corrupted Circuit Data**

   - Restore from last valid snapshot
   - Notify user of data loss
   - Provide manual recovery options

2. **Missing Components**

   - Attempt component reconstruction
   - Flag affected connections
   - Suggest replacement components

3. **Invalid Connections**
   - Remove invalid connections
   - Preserve component placement
   - Log issues for user review

### Recovery Procedures

```typescript
interface RecoveryAction {
  type: "restore" | "repair" | "recreate";
  target: string; // component or circuit ID
  confidence: number; // 0-1, how likely to succeed
  userConfirmationRequired: boolean;
}
```
