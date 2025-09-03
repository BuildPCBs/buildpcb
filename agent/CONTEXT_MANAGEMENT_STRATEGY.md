# Context Management Strategy

_BuildPCB.ai AI Chat Context Management Plan_

## 🎯 **Core Challenge**

**Problem**: Each POST request to `/api/ai-agent` is stateless - the AI has no memory of:

- Previous conversation history
- Current canvas state
- User's project context
- Component relationships
- Design intent

**Solution**: Implement comprehensive context management system that packages all relevant state into each API call.

---

## 📦 **Context Payload Structure**

### **Current Implementation**

```typescript
// In AIChatContext.tsx - handlePromptSubmit
body: JSON.stringify({
  message: prompt,
  canvasState: null, // ❌ TODO: Get from canvas context
  conversationHistory: messages, // ✅ Basic history
  sessionId: "main-session", // ✅ Session tracking
});
```

### **Target Implementation**

```typescript
interface AIRequestPayload {
  // User Input
  message: string;

  // Canvas Context
  canvasState: {
    components: ComponentData[];
    connections: ConnectionData[];
    metadata: CanvasMetadata;
    selectedObjects: string[];
    lastAction: string;
  };

  // Conversation Context
  conversationHistory: ChatMessage[];
  conversationSummary?: string; // For long conversations

  // Session Context
  sessionId: string;
  projectId?: string;
  userId?: string;

  // Design Context
  designIntent?: string;
  constraints?: DesignConstraint[];
  preferences?: UserPreference[];

  // Performance Context
  requestId: string;
  timestamp: number;
  clientVersion: string;
}
```

---

## 🔧 **Implementation Strategy**

### **Phase 1: Canvas State Integration** (Week 1)

#### **1.1 Create Canvas State Hook**

**File**: `src/hooks/useCanvasState.ts`

```typescript
export function useCanvasState() {
  const canvas = useCanvasContext(); // Access Fabric.js canvas

  return useMemo(() => {
    if (!canvas) return null;

    return {
      components: extractComponents(canvas),
      connections: extractConnections(canvas),
      metadata: {
        zoom: canvas.getZoom(),
        viewportTransform: canvas.viewportTransform,
        selectedObjects: canvas.getActiveObjects().map((obj) => obj.id),
        canvasSize: { width: canvas.width, height: canvas.height },
      },
      timestamp: Date.now(),
    };
  }, [canvas, lastCanvasUpdate]); // Re-compute on canvas changes
}

function extractComponents(canvas: fabric.Canvas): ComponentData[] {
  return canvas
    .getObjects()
    .filter((obj) => obj.type === "component")
    .map((obj) => ({
      id: obj.id,
      type: obj.componentType,
      position: { x: obj.left, y: obj.top },
      rotation: obj.angle,
      properties: obj.componentProperties,
      connections: obj.connectionPoints,
    }));
}
```

#### **1.2 Update AIChatContext**

**File**: `src/contexts/AIChatContext.tsx`

```typescript
export function AIChatProvider({
  children,
  onCircuitUpdate,
}: AIChatProviderProps) {
  const canvasState = useCanvasState(); // ← Add this

  const handlePromptSubmit = async (prompt: string) => {
    // ... existing code ...

    const payload = {
      message: prompt,
      canvasState: canvasState, // ← Use live canvas state
      conversationHistory: messages,
      sessionId: sessionId,
      requestId: `req_${Date.now()}`,
      timestamp: Date.now(),
    };

    const response = await fetch("/api/ai-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };
}
```

### **Phase 2: Enhanced Context Management** (Week 2)

#### **2.1 Conversation Summarization**

```typescript
// For long conversations (>10 messages), summarize older context
function summarizeConversation(messages: ChatMessage[]): string {
  const recentMessages = messages.slice(-5); // Keep last 5 messages
  const olderMessages = messages.slice(0, -5);

  if (olderMessages.length === 0) return "";

  // Create summary of older conversation
  return `Previous conversation summary: User discussed ${extractTopics(
    olderMessages
  )}. AI assisted with ${extractActions(olderMessages)}.`;
}
```

#### **2.2 Design Intent Tracking**

```typescript
interface DesignContext {
  intent: string; // "building LED circuit", "power supply design"
  constraints: string[]; // "low power", "under $50", "battery operated"
  progress: string; // "component selection phase", "routing phase"
  goals: string[]; // "minimize size", "maximize efficiency"
}

// Track design intent across conversation
const designContext = useDesignContext();
```

#### **2.3 Session Persistence**

```typescript
// Store conversation in localStorage/IndexedDB
const sessionManager = {
  saveSession: (sessionId: string, data: SessionData) => {
    localStorage.setItem(`session_${sessionId}`, JSON.stringify(data));
  },

  loadSession: (sessionId: string): SessionData | null => {
    const data = localStorage.getItem(`session_${sessionId}`);
    return data ? JSON.parse(data) : null;
  },

  clearOldSessions: () => {
    // Clean up sessions older than 7 days
  },
};
```

### **Phase 3: Advanced Context Features** (Week 3-4)

#### **3.1 Smart Context Optimization**

```typescript
// Intelligently reduce context size for API efficiency
function optimizeContext(fullContext: AIRequestPayload): AIRequestPayload {
  return {
    ...fullContext,
    conversationHistory: compressHistory(fullContext.conversationHistory),
    canvasState: simplifyCanvasState(fullContext.canvasState),
    // Only include relevant components near current focus
  };
}
```

#### **3.2 Context Validation**

```typescript
// Ensure context integrity before sending
function validateContext(context: AIRequestPayload): ValidationResult {
  const issues: string[] = [];

  if (!context.canvasState) issues.push("Missing canvas state");
  if (context.conversationHistory.length === 0)
    issues.push("No conversation history");
  if (!context.sessionId) issues.push("Missing session ID");

  return { isValid: issues.length === 0, issues };
}
```

---

## 🚀 **API Endpoint Enhancement**

### **Current API Structure**

```typescript
// src/app/api/ai-agent/route.ts - Current
export async function POST(request: Request) {
  const { message, canvasState, conversationHistory, sessionId } =
    await request.json();
  // ... process ...
}
```

### **Enhanced API Structure**

```typescript
// src/app/api/ai-agent/route.ts - Target
export async function POST(request: Request) {
  const payload: AIRequestPayload = await request.json();

  // Validate context
  const validation = validateContext(payload);
  if (!validation.isValid) {
    return NextResponse.json({ error: validation.issues }, { status: 400 });
  }

  // Optimize for OpenAI
  const optimizedContext = optimizeForAI(payload);

  // Enhanced system prompt with context
  const systemPrompt = buildContextualSystemPrompt(optimizedContext);

  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...buildConversationHistory(optimizedContext.conversationHistory),
      { role: "user", content: buildContextualUserPrompt(optimizedContext) },
    ],
  });

  return NextResponse.json({
    textResponse: aiResponse.choices[0].message.content,
    circuit: parseCircuitInstructions(aiResponse),
    context: {
      requestId: payload.requestId,
      processingTime: Date.now() - payload.timestamp,
    },
  });
}
```

---

## 📋 **Implementation Checklist**

### **Week 1: Foundation**

- [ ] Create `useCanvasState` hook
- [ ] Update `AIChatContext` to include canvas state
- [ ] Test basic context passing
- [ ] Validate API receives full context

### **Week 2: Enhancement**

- [ ] Implement conversation summarization
- [ ] Add design intent tracking
- [ ] Create session persistence
- [ ] Add context size optimization

### **Week 3: Polish**

- [ ] Add context validation
- [ ] Implement smart context reduction
- [ ] Add error handling for context issues
- [ ] Performance optimization

### **Week 4: Advanced Features**

- [ ] Multi-project context support
- [ ] Context analytics and debugging
- [ ] A/B testing for context strategies
- [ ] Documentation and examples

---

## 🎯 **Success Metrics**

### **Context Quality**

- AI responses are contextually relevant (>90%)
- Canvas state accurately reflected in responses
- Conversation continuity maintained

### **Performance**

- API response time <3 seconds
- Context payload size <50KB
- No memory leaks in long sessions

### **User Experience**

- AI understands project context
- Suggestions build on previous work
- No repetitive or out-of-context responses

---

## 🔗 **Related Files**

- `src/hooks/useCanvasState.ts` - Canvas state extraction
- `src/contexts/AIChatContext.tsx` - Main context management
- `src/app/api/ai-agent/route.ts` - API endpoint
- `src/lib/contextOptimization.ts` - Context processing utilities
- `src/lib/sessionManager.ts` - Session persistence

---

**This strategy ensures every AI interaction has full context of the user's design session, enabling intelligent, contextual responses that build on previous work.**
