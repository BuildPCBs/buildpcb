/**
 * Memory Monitoring Utilities
 * Helps track and manage memory usage in the application
 */

import React from "react";

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usageRatio: number;
  formattedUsage: string;
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private monitoring = false;
  private intervalId: number | null = null;

  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  getMemoryInfo(): MemoryInfo | null {
    if (!("memory" in performance)) {
      return null;
    }

    const memory = (performance as any).memory;
    const usageRatio = memory.usedJSHeapSize / memory.totalJSHeapSize;

    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usageRatio,
      formattedUsage: `${(usageRatio * 100).toFixed(1)}%`,
    };
  }

  startMonitoring(
    callback?: (info: MemoryInfo) => void,
    interval = 10000
  ): void {
    if (this.monitoring) return;

    this.monitoring = true;
    console.log("🧠 Memory monitoring started");

    this.intervalId = window.setInterval(() => {
      const info = this.getMemoryInfo();
      if (info) {
        if (info.usageRatio > 0.8) {
          console.warn("⚠️ High memory usage detected:", info.formattedUsage);
        }

        if (callback) {
          callback(info);
        }
      }
    }, interval);
  }

  stopMonitoring(): void {
    if (!this.monitoring) return;

    this.monitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log("🧠 Memory monitoring stopped");
  }

  forceGarbageCollection(): void {
    if (window.gc) {
      console.log("🗑️ Forcing garbage collection...");
      window.gc();
    } else {
      console.log(
        '🗑️ Garbage collection not available (use --js-flags="--expose-gc" to enable)'
      );
    }
  }

  logMemoryUsage(label = "Memory Usage"): void {
    const info = this.getMemoryInfo();
    if (info) {
      console.log(`🧠 ${label}:`, {
        used: `${(info.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB`,
        total: `${(info.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB`,
        limit: `${(info.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB`,
        ratio: info.formattedUsage,
      });
    } else {
      console.log("🧠 Memory monitoring not available");
    }
  }
}

// Global memory monitor instance
export const memoryMonitor = MemoryMonitor.getInstance();

// React hook for memory monitoring
export function useMemoryMonitor(enabled = true) {
  const [memoryInfo, setMemoryInfo] = React.useState<MemoryInfo | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    const updateMemoryInfo = (info: MemoryInfo) => {
      setMemoryInfo(info);
    };

    memoryMonitor.startMonitoring(updateMemoryInfo);

    return () => {
      memoryMonitor.stopMonitoring();
    };
  }, [enabled]);

  return {
    memoryInfo,
    logMemoryUsage: memoryMonitor.logMemoryUsage.bind(memoryMonitor),
    forceGC: memoryMonitor.forceGarbageCollection.bind(memoryMonitor),
  };
}
