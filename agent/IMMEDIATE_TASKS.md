# Immediate Implementation Tasks

_Priority tasks for AI-Canvas integration_

## 🔥 **URGENT: Canvas State Integration**

### **Task 1: Create useCanvasState Hook**

**File**: `src/hooks/useCanvasState.ts`
**Purpose**: Extract live canvas data for AI context

```typescript
export function useCanvasState() {
  // Extract from IDEFabricCanvas:
  // - All fabric objects (components)
  // - Wire connections
  // - Canvas properties (zoom, pan)
  // - Selected objects

  return {
    components: [], // Serialized component data
    connections: [], // Wire connection data
    metadata: { zoom, pan, selection },
  };
}
```

### **Task 2: Update AIChatContext**

**File**: `src/contexts/AIChatContext.tsx`
**Purpose**: Include canvas state in AI requests

```typescript
// In handlePromptSubmit:
const canvasState = useCanvasState(); // Get from canvas context
body: JSON.stringify({
  message: prompt,
  canvasState: canvasState, // ← Add this
  conversationHistory: messages,
  sessionId: "main-session",
});
```

### **Task 3: Circuit Response Parser**

**File**: `src/lib/circuitResponseParser.ts`
**Purpose**: Parse AI responses and apply to canvas

```typescript
export function parseCircuitResponse(response: any) {
  // Parse according to circuit-response-schema.md
  // Return structured commands for canvas updates
}

export function applyCircuitChanges(changes: any, canvas: fabric.Canvas) {
  // Apply parsed changes to Fabric.js canvas
  // Add/modify/delete components
  // Update wire connections
}
```

---

## 🎯 **This Week's Goals**

1. **Monday-Tuesday**: Canvas state extraction
2. **Wednesday-Thursday**: Circuit response parsing
3. **Friday**: Basic AI → Canvas integration test

---

## 🧪 **Testing Strategy**

### **Test Cases**

1. "Add a resistor" → Should place resistor on canvas
2. "Connect LED to battery" → Should create wire connection
3. "Remove the capacitor" → Should delete component
4. "Move the resistor to the right" → Should update position

### **Success Criteria**

- Canvas state accurately captured
- AI responses properly parsed
- Components appear on canvas as expected
- No errors in console

---

## 🚨 **Blockers to Address**

1. **Component Factory Cleanup** - Multiple factories conflict
2. **Canvas Context Access** - Need direct access to Fabric.js canvas
3. **Wire Tool Integration** - Coordinate with existing wiring system
4. **State Synchronization** - Prevent conflicts between manual and AI changes

---

## 📞 **When to Continue**

Return to this implementation when ready to:

1. Connect AI responses to actual canvas changes
2. Test end-to-end AI circuit generation
3. Polish the user experience
4. Handle edge cases and errors

The foundation is solid - now we need the canvas integration layer!
