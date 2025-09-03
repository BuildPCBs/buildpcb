# Context Management System

**Version 1.0 - Professional Engineering Focus** | *Last Updated: September 3, 2025*

This document defines the comprehensive context management strategy for BuildPCB.ai's AI agent system, addressing the challenge of maintaining conversation state across stateless HTTP POST requests.

---

## 🎯 **Core Challenge**

### **HTTP Statelessness Problem**
- Each API request is independent (stateless)
- No built-in session management
- Canvas state must be preserved manually
- Conversation history requires external storage

### **Professional Requirements**
- **Zero Data Loss**: Never lose user work or conversation context
- **Concurrent Sessions**: Support multiple simultaneous conversations
- **Performance**: Fast context retrieval and updates
- **Scalability**: Handle thousands of active engineering sessions
- **Security**: Protect sensitive design data

---

## 🆔 **Unique Identifier System**

### **Conversation ID Generation**

#### **Primary Identifier: Conversation UUID**
```typescript
interface ConversationId {
  id: string;              // UUID v4
  created: Date;           // Creation timestamp
  userId: string;          // User identifier
  sessionType: 'design' | 'analysis' | 'collaboration';
  metadata: {
    projectName?: string;
    industry?: string;
    complexity?: 'simple' | 'medium' | 'complex';
  };
}
```

#### **Generation Strategy**
```typescript
function generateConversationId(userId: string, context: RequestContext): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const userHash = crypto.createHash('sha256')
    .update(userId)
    .digest('hex')
    .substring(0, 8);

  return `conv_${timestamp}_${userHash}_${random}`;
}
```

### **Request Correlation**

#### **Request ID Chain**
```typescript
interface RequestChain {
  conversationId: string;
  requestId: string;        // Unique per request
  parentRequestId?: string; // For follow-up requests
  sequenceNumber: number;   // Incremental counter
  timestamp: Date;
}
```

#### **Canvas State Correlation**
```typescript
interface CanvasContext {
  conversationId: string;
  canvasId: string;         // Unique canvas identifier
  version: number;          // Incremental version
  lastModified: Date;
  checksum: string;         // Data integrity check
}
```

---

## 💾 **Storage Architecture**

### **Multi-Layer Storage Strategy**

#### **Layer 1: In-Memory Cache (Hot Data)**
```typescript
interface MemoryCache {
  conversations: Map<string, ConversationData>;
  canvasStates: Map<string, CanvasSnapshot>;
  activeSessions: Set<string>;
  maxSize: number;
  ttl: number;  // Time to live in seconds
}
```

**Use Cases:**
- Active conversation state
- Recent canvas operations
- Frequently accessed components
- Real-time collaboration data

#### **Layer 2: Redis Cache (Warm Data)**
```typescript
interface RedisStorage {
  conversationHistory: {
    key: `conv:${conversationId}`,
    ttl: 24 * 60 * 60,  // 24 hours
    data: ConversationHistory
  };
  canvasSnapshots: {
    key: `canvas:${conversationId}:${version}`,
    ttl: 7 * 24 * 60 * 60,  // 7 days
    data: CanvasSnapshot
  };
}
```

**Use Cases:**
- Conversation history
- Canvas state snapshots
- Session metadata
- Temporary collaboration data

#### **Layer 3: Database (Cold Data)**
```sql
-- Conversation table
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL,
  metadata JSONB,
  project_name VARCHAR(255),
  industry VARCHAR(100)
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sequence_number INTEGER NOT NULL,
  role VARCHAR(50) NOT NULL,  -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL
);

-- Canvas states table
CREATE TABLE canvas_states (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  version INTEGER NOT NULL,
  data JSONB NOT NULL,
  checksum VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

**Use Cases:**
- Long-term conversation history
- Archived canvas states
- Analytics and reporting data
- Compliance and audit trails

---

## 🔄 **Context Lifecycle Management**

### **Session Creation**

#### **New Conversation Flow**
```typescript
async function createConversation(request: InitialRequest): Promise<ConversationContext> {
  // 1. Generate unique conversation ID
  const conversationId = generateConversationId(request.userId, request.context);

  // 2. Initialize conversation record
  const conversation = await db.conversations.create({
    id: conversationId,
    userId: request.userId,
    status: 'active',
    metadata: request.metadata,
    createdAt: new Date()
  });

  // 3. Create initial canvas state
  const initialCanvas = await initializeCanvas(request.canvasConfig);

  // 4. Store in cache
  await cache.set(`conv:${conversationId}`, {
    conversation,
    canvas: initialCanvas,
    messages: []
  });

  return { conversationId, canvas: initialCanvas };
}
```

### **Context Retrieval**

#### **Request Processing Flow**
```typescript
async function processRequest(request: APIRequest): Promise<Response> {
  // 1. Extract or validate conversation ID
  const conversationId = request.conversationId || await createConversation(request);

  // 2. Load context from cache/database
  const context = await loadContext(conversationId);

  // 3. Validate context integrity
  if (!isValidContext(context)) {
    throw new Error('Context corruption detected');
  }

  // 4. Update context with new request
  const updatedContext = await updateContext(context, request);

  // 5. Process request with full context
  const response = await processWithContext(request, updatedContext);

  // 6. Persist updated context
  await persistContext(conversationId, updatedContext);

  return response;
}
```

### **Context Synchronization**

#### **Canvas State Sync**
```typescript
interface ContextSync {
  conversationId: string;
  canvasVersion: number;
  lastSync: Date;
  pendingChanges: CanvasOperation[];
  conflicts: ConflictResolution[];
}

async function syncCanvasState(conversationId: string, canvasData: CanvasData): Promise<void> {
  // 1. Check for version conflicts
  const currentVersion = await getCurrentCanvasVersion(conversationId);

  if (canvasData.version !== currentVersion + 1) {
    // Handle version conflict
    const resolution = await resolveVersionConflict(conversationId, canvasData);
    canvasData = resolution.mergedData;
  }

  // 2. Update canvas state
  await updateCanvasState(conversationId, canvasData);

  // 3. Broadcast to collaborators
  await broadcastCanvasUpdate(conversationId, canvasData);
}
```

---

## 🔐 **Security & Privacy**

### **Data Protection**

#### **Encryption Strategy**
```typescript
interface DataProtection {
  atRest: {
    algorithm: 'AES-256-GCM';
    keyRotation: '30 days';
    backupEncryption: true;
  };
  inTransit: {
    protocol: 'TLS 1.3';
    certificateValidation: true;
    perfectForwardSecrecy: true;
  };
  accessControl: {
    userIsolation: true;
    conversationAccess: 'owner-only';
    auditLogging: true;
  };
}
```

#### **Access Control**
- **Conversation Ownership**: Only conversation creator can access
- **Collaborator Permissions**: Granular read/write permissions
- **Session Timeouts**: Automatic cleanup of inactive sessions
- **Audit Trails**: Complete access logging for compliance

### **Privacy Considerations**

#### **Data Retention**
```typescript
const RETENTION_POLICIES = {
  activeConversations: 'indefinite',
  inactiveConversations: '2 years',
  canvasSnapshots: '1 year',
  auditLogs: '7 years',
  temporaryData: '24 hours'
};
```

#### **Data Minimization**
- Store only necessary context data
- Automatic cleanup of temporary data
- User-controlled data export/deletion
- Compliance with privacy regulations

---

## ⚡ **Performance Optimization**

### **Caching Strategy**

#### **Multi-Level Caching**
```typescript
interface CacheStrategy {
  l1: {  // Memory cache
    size: '100MB',
    ttl: '5 minutes',
    eviction: 'LRU'
  };
  l2: {  // Redis cache
    size: '1GB',
    ttl: '1 hour',
    eviction: 'TTL'
  };
  l3: {  // Database
    compression: true,
    indexing: true,
    partitioning: 'monthly'
  };
}
```

#### **Cache Invalidation**
- **Immediate**: User actions that change state
- **Lazy**: Background cleanup of stale data
- **Proactive**: Predictive cache warming for likely requests
- **Event-Driven**: Real-time invalidation on data changes

### **Query Optimization**

#### **Database Indexing**
```sql
-- Optimized indexes for common queries
CREATE INDEX idx_conversations_user_status ON conversations(user_id, status);
CREATE INDEX idx_messages_conversation_sequence ON messages(conversation_id, sequence_number);
CREATE INDEX idx_canvas_states_conversation_version ON canvas_states(conversation_id, version DESC);
```

#### **Read Optimization**
- **Connection Pooling**: Efficient database connections
- **Query Batching**: Multiple operations in single request
- **Result Caching**: Frequently accessed data
- **Pagination**: Large dataset handling

---

## 🔄 **State Synchronization**

### **Real-time Collaboration**

#### **WebSocket Integration**
```typescript
interface CollaborationSession {
  conversationId: string;
  participants: User[];
  activeUsers: Map<string, UserStatus>;
  canvasLock: LockState;
  changeQueue: Operation[];
}

class CollaborationManager {
  async joinSession(conversationId: string, userId: string): Promise<void> {
    // 1. Validate access permissions
    // 2. Load current canvas state
    // 3. Establish WebSocket connection
    // 4. Sync with other participants
    // 5. Handle real-time updates
  }

  async handleCanvasOperation(operation: CanvasOperation): Promise<void> {
    // 1. Validate operation permissions
    // 2. Apply operation to canvas
    // 3. Broadcast to all participants
    // 4. Persist to storage
    // 5. Handle conflicts if any
  }
}
```

### **Conflict Resolution**

#### **Operational Transformation**
```typescript
interface Operation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  path: string[];
  value?: any;
  timestamp: Date;
  userId: string;
}

function transformOperations(clientOp: Operation, serverOp: Operation): Operation[] {
  // Transform operations to maintain consistency
  // Handle concurrent modifications
  // Preserve user intent
}
```

---

## 📊 **Monitoring & Analytics**

### **Context Health Metrics**

#### **Key Performance Indicators**
```typescript
interface ContextMetrics {
  conversationCount: number;
  activeSessions: number;
  averageSessionDuration: number;
  contextLoadTime: number;      // ms
  cacheHitRate: number;         // %
  storageUtilization: number;   // %
  errorRate: number;            // %
}
```

#### **Health Checks**
- **Context Integrity**: Validate data consistency
- **Performance Monitoring**: Track response times
- **Storage Capacity**: Monitor disk/database usage
- **Security Scanning**: Regular vulnerability assessment

### **Analytics & Insights**

#### **Usage Patterns**
- **Conversation Length**: Average messages per session
- **Canvas Complexity**: Components and connections per design
- **User Behavior**: Common workflows and patterns
- **Performance Trends**: System usage over time

---

## 🚨 **Error Handling & Recovery**

### **Context Corruption Recovery**

#### **Automatic Recovery**
```typescript
async function recoverCorruptedContext(conversationId: string): Promise<ConversationContext> {
  // 1. Detect corruption through checksum validation
  // 2. Attempt repair from recent snapshots
  // 3. Fallback to last known good state
  // 4. Notify user of recovery action
  // 5. Log incident for analysis
}
```

#### **Manual Recovery Options**
- **Point-in-Time Restore**: Revert to specific timestamp
- **Selective Recovery**: Restore specific components
- **Export/Import**: Backup and restore functionality
- **Version Comparison**: Compare different states

### **Disaster Recovery**

#### **Backup Strategy**
- **Real-time Replication**: Cross-region data backup
- **Point-in-Time Recovery**: Any point in last 30 days
- **Automated Testing**: Regular backup integrity validation
- **Recovery Time Objective**: <4 hours for critical data

---

## 🔧 **Implementation Guidelines**

### **API Design**

#### **Context Headers**
```typescript
interface ContextHeaders {
  'X-Conversation-ID': string;
  'X-Request-ID': string;
  'X-Canvas-Version': number;
  'X-User-ID': string;
  'X-Session-Token': string;
}
```

#### **Response Metadata**
```typescript
interface ContextResponse {
  conversationId: string;
  canvasVersion: number;
  contextValid: boolean;
  warnings?: string[];
  nextActions?: string[];
}
```

### **Client Integration**

#### **Context Persistence**
```typescript
class ContextManager {
  private conversationId: string | null = null;
  private canvasVersion: number = 0;

  async initialize(): Promise<void> {
    // Load from localStorage/sessionStorage
    // Validate with server
    // Handle session recovery
  }

  async sendRequest(request: APIRequest): Promise<Response> {
    // Attach context headers
    // Handle response metadata
    // Update local context
  }
}
```

---

## 📈 **Scaling Considerations**

### **Horizontal Scaling**

#### **Session Distribution**
- **Load Balancer**: Distribute requests across servers
- **Sticky Sessions**: Maintain conversation affinity
- **Shared Cache**: Redis cluster for cross-server context
- **Database Sharding**: Partition data by conversation ID

#### **Performance Scaling**
- **Read Replicas**: Database read scaling
- **Cache Clustering**: Redis cluster for high availability
- **CDN Integration**: Static asset delivery
- **Microservices**: Decompose for independent scaling

### **Global Distribution**

#### **Multi-Region Deployment**
- **Data Replication**: Cross-region data consistency
- **Latency Optimization**: Geo-based routing
- **Compliance**: Regional data sovereignty
- **Failover**: Automatic region switching

---

*This context management system ensures BuildPCB.ai can maintain professional-grade conversation state across stateless HTTP requests, providing engineers with seamless, reliable design sessions that never lose their work.*
