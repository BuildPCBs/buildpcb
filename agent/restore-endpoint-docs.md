# Restore Endpoint Documentation

## Overview

API endpoint for restoring circuit states from snapshots, handling version rollbacks, and recovering from corrupted states.

## Endpoint Specifications

### Base Restore Endpoint

```
POST /api/circuit/restore
```

### Request Types

#### 1. Restore from Snapshot

```typescript
interface RestoreFromSnapshotRequest {
  type: "snapshot";
  circuitId: string;
  snapshotId: string;
  userId: string;
  preserveHistory?: boolean; // default: true
}
```

#### 2. Restore from Version

```typescript
interface RestoreFromVersionRequest {
  type: "version";
  circuitId: string;
  versionNumber: number;
  userId: string;
  createNewBranch?: boolean; // default: false
}
```

#### 3. Restore from Backup

```typescript
interface RestoreFromBackupRequest {
  type: "backup";
  circuitId: string;
  backupDate: string; // ISO date
  userId: string;
  verifyIntegrity?: boolean; // default: true
}
```

#### 4. Emergency Recovery

```typescript
interface EmergencyRecoveryRequest {
  type: "emergency";
  circuitId: string;
  userId: string;
  lastKnownGoodTimestamp?: string;
  autoRepair?: boolean; // default: false
}
```

## Response Format

### Successful Restore

```typescript
interface RestoreSuccessResponse {
  success: true;
  circuitId: string;
  restoredToVersion: number;
  restoredToTimestamp: string;
  circuit: FullCircuit;
  metadata: {
    originalVersion: number;
    changesLost: PatchOperation[];
    componentsAffected: string[];
    connectionsAffected: string[];
  };
  warnings: string[];
}
```

### Failed Restore

```typescript
interface RestoreFailureResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: any;
  };
  availableAlternatives: RestoreOption[];
  lastKnownGood?: {
    snapshotId: string;
    timestamp: string;
    version: number;
  };
}

interface RestoreOption {
  type: "snapshot" | "version" | "backup";
  id: string;
  timestamp: string;
  description: string;
  confidence: number; // 0-1
  dataLoss: string[]; // list of what will be lost
}
```

## Endpoint Variants

### Quick Restore (Simple Rollback)

```
POST /api/circuit/quick-restore
```

- Rolls back to previous stable version
- No user confirmation required for minor changes
- Preserves last 5 operations in history

### Selective Restore (Component-Level)

```
POST /api/circuit/selective-restore
```

```typescript
interface SelectiveRestoreRequest {
  circuitId: string;
  componentIds: string[];
  restoreToSnapshot: string;
  preserveConnections: boolean;
  userId: string;
}
```

### Bulk Restore (Multiple Circuits)

```
POST /api/circuit/bulk-restore
```

- For restoring multiple circuits from same backup
- Useful for recovering from system failures
- Requires admin privileges

## Restore Process Flow

### 1. Pre-Restore Validation

```
Request → Validate User Permissions
    ├── Check Circuit Ownership
    ├── Verify Snapshot/Version Exists
    ├── Assess Data Integrity
    └── Calculate Impact of Restore
```

### 2. Safety Checks

```typescript
interface RestoreSafetyCheck {
  currentStateValid: boolean;
  targetStateValid: boolean;
  dataLossRisk: "none" | "minimal" | "moderate" | "significant";
  conflictingChanges: string[];
  userConfirmationRequired: boolean;
}
```

### 3. Restore Execution

```
Create Current State Backup → Apply Restore → Validate Result
    ├── Success? → Update History → Notify User
    └── Failed? → Rollback → Return Error + Alternatives
```

## Advanced Restore Features

### Smart Merge Restore

Attempt to preserve recent changes while restoring older state:

```typescript
interface SmartMergeRestore {
  baseSnapshot: string;
  preserveChanges: {
    componentIds: string[];
    connections: string[];
    layoutOnly: boolean;
  };
  conflictResolution: "favor_current" | "favor_snapshot" | "manual";
}
```

### Incremental Restore

Restore only specific aspects of circuit:

```typescript
interface IncrementalRestoreRequest {
  circuitId: string;
  restoreAspects: {
    components?: boolean;
    connections?: boolean;
    layout?: boolean;
    metadata?: boolean;
  };
  fromSnapshot: string;
  userId: string;
}
```

## Error Handling

### Common Error Codes

- `CIRCUIT_NOT_FOUND` - Circuit ID doesn't exist
- `SNAPSHOT_CORRUPTED` - Target snapshot is invalid
- `INSUFFICIENT_PERMISSIONS` - User can't restore this circuit
- `CONCURRENT_MODIFICATION` - Circuit being edited by another user
- `RESTORE_WOULD_CAUSE_DATA_LOSS` - Significant changes would be lost
- `TARGET_STATE_INVALID` - Snapshot/version contains invalid data

### Error Recovery

```typescript
interface ErrorRecoveryOptions {
  autoRepairAttempt: boolean;
  fallbackToSafeVersion: boolean;
  createRepairReport: boolean;
  notifyUser: boolean;
}
```

## Monitoring & Analytics

### Restore Metrics

- Restore frequency per user/circuit
- Success/failure rates
- Data loss incidents
- Recovery time metrics
- User satisfaction with restore results

### Audit Trail

```typescript
interface RestoreAuditEntry {
  timestamp: string;
  userId: string;
  circuitId: string;
  restoreType: string;
  fromVersion: number;
  toVersion: number;
  success: boolean;
  dataLoss: string[];
  userConfirmed: boolean;
}
```

## Integration Guidelines

### Frontend Integration

```typescript
// Example usage in React component
const handleRestoreRequest = async (restoreOptions: RestoreRequest) => {
  try {
    const result = await restoreAPI.restore(restoreOptions);
    if (result.success) {
      // Update canvas with restored circuit
      // Show success notification
      // Update circuit history
    }
  } catch (error) {
    // Show error dialog with alternatives
    // Allow user to choose different restore option
  }
};
```

### Canvas Integration

- Restore operations should trigger canvas re-render
- Highlight restored components briefly
- Show diff overlay of what changed
- Provide undo option for restore action

### State Management Integration

- Update Zustand store with restored state
- Invalidate related caches
- Sync with other connected users
- Update local storage backup
