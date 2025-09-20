/**
 * Test script to debug undo/redo functionality
 * This helps identify issues with keyboard shortcuts and state management
 */

export function debugUndoRedo() {
  // Test 1: Check if keyboard events are being captured
  const handleKeyDown = (e: KeyboardEvent) => {
    const isModifierPressed = e.ctrlKey || e.metaKey;

    if (isModifierPressed && e.key.toLowerCase() === "z") {
      console.log("🔍 Debug: Cmd/Ctrl+Z detected", {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        key: e.key,
        code: e.code,
        target: e.target,
        activeElement: document.activeElement,
      });
    }

    if (isModifierPressed && e.key.toLowerCase() === "y") {
      console.log("🔍 Debug: Cmd/Ctrl+Y detected", {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        key: e.key,
        code: e.code,
        target: e.target,
        activeElement: document.activeElement,
      });
    }
  };

  document.addEventListener("keydown", handleKeyDown);

  console.log("🔍 Debug: Test listener added. Try pressing Cmd+Z or Cmd+Y");

  // Return cleanup function
  return () => {
    document.removeEventListener("keydown", handleKeyDown);
    console.log("🔍 Debug: Test listener removed");
  };
}

// Test 2: Check if history stack has data
export function debugHistoryStack(canvas: any) {
  if (!canvas) {
    console.log("🔍 Debug: No canvas available");
    return;
  }

  console.log("🔍 Debug: Canvas history investigation", {
    canvasType: typeof canvas,
    canvasConstructor: canvas.constructor.name,
    hasObjects: canvas.getObjects
      ? canvas.getObjects().length
      : "no getObjects method",
  });
}

// Test 3: Check if state saving is working
export function debugStateSaving(canvas: any) {
  if (!canvas) {
    console.log("🔍 Debug: No canvas for state saving test");
    return;
  }

  try {
    const state = canvas.toObject();
    console.log("🔍 Debug: Canvas state serialization", {
      stateType: typeof state,
      hasObjects: state?.objects?.length || 0,
      stateKeys: Object.keys(state || {}),
      stateSize: JSON.stringify(state).length,
    });
  } catch (error) {
    console.log("🔍 Debug: Canvas state serialization failed", error);
  }
}
