"use client";

/**
 * Universal debounced save utility
 * Ensures latest state is captured and prevents stale closures
 * Based on the successful 3-second debounce pattern from AIChatContext
 */

export class DebouncedSaveManager {
  private timeoutRef: NodeJS.Timeout | null = null;
  private delay: number;
  private saveCallback: () => void;

  constructor(saveCallback: () => void, delay: number = 3000) {
    this.saveCallback = saveCallback;
    this.delay = delay;
  }

  /**
   * Trigger a debounced save
   * Cancels any pending save and schedules a new one
   */
  trigger(): void {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }

    this.timeoutRef = setTimeout(() => {
      queueMicrotask(() => {
        this.saveCallback();
      });
    }, this.delay);
  }

  /**
   * Cancel any pending save
   */
  cancel(): void {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
      this.timeoutRef = null;
    }
  }

  /**
   * Execute save immediately
   */
  immediate(): void {
    this.cancel();
    queueMicrotask(() => {
      this.saveCallback();
    });
  }

  /**
   * Update delay time
   */
  setDelay(delay: number): void {
    this.delay = delay;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.cancel();
  }
}

/**
 * Custom event-based save trigger (for cross-component communication)
 * Uses the same pattern as AIChatContext's triggerChatSave
 */
export function dispatchSaveEvent(detail?: any): void {
  if (typeof window === "undefined") return;

  queueMicrotask(() => {
    window.dispatchEvent(
      new CustomEvent("triggerProjectSave", {
        detail: detail || { timestamp: Date.now() },
      })
    );
  });
}

/**
 * Listen for save events
 * Returns cleanup function
 */
export function onSaveEvent(callback: (detail: any) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail);
  };

  window.addEventListener("triggerProjectSave", handler);

  return () => {
    window.removeEventListener("triggerProjectSave", handler);
  };
}
