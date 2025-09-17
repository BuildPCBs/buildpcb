"use client";

import { useState, useCallback } from "react";
import { SchemaPanel } from "./SchemaPanel";
import { TopToolbar } from "./TopToolbar";
import { AIPromptPanel } from "./AIPromptPanel";
import { AIChatInterface } from "../ai/AIChatInterface";
import { DeviceRestriction } from "./DeviceRestriction";
import { IDEFabricCanvas } from "@/canvas";
import { useOverrideBrowserControls } from "@/hooks/useOverrideBrowserControls";
import { AIChatProvider } from "../../contexts/AIChatContext";
import { CanvasProvider } from "../../contexts/CanvasContext";
import { responsive } from "@/lib/responsive";
import { logger } from "@/lib/logger";
import * as fabric from "fabric";
import { useProject } from "@/contexts/ProjectContext";
import { useCanvasAutoSave } from "@/canvas/hooks/useCanvasAutoSave";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";

export function IDECanvas() {
  // Override all browser mouse/keyboard controls
  useOverrideBrowserControls();

  // Canvas state for the provider
  const [canvas, setCanvas] = useState<any>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [getNetlist, setGetNetlist] = useState<(() => any) | null>(null);

  // Get project context for save functionality
  const { currentProject } = useProject();

  // Get canvas instance for auto-save
  const fabricCanvas = canvasCommandManager.getCanvas();

  // Use the auto-save mechanism
  const autoSave = useCanvasAutoSave({
    canvas: fabricCanvas,
    netlist: getNetlist || (() => []),
    enabled: !!currentProject, // Only enable when we have a project
  });

  // Shared save function that both Ctrl+S and Export button will use
  const sharedSaveFunction = useCallback(async () => {
    if (!currentProject) {
      throw new Error("Cannot save: no project loaded");
    }

    if (!fabricCanvas) {
      throw new Error("Cannot save: canvas not initialized");
    }

    const currentNetlist = getNetlist ? getNetlist() : [];
    console.log("💾 Shared save function called", {
      hasProject: !!currentProject,
      projectId: currentProject?.id,
      canvasObjects: fabricCanvas.getObjects().length,
      netlistNets: currentNetlist.length,
      netlistConnections: currentNetlist.reduce(
        (sum: number, net: any) => sum + (net.connections?.length || 0),
        0
      ),
    });

    // Call the auto-save mechanism
    await autoSave.saveNow();

    console.log("✅ Shared save function completed");
  }, [currentProject, fabricCanvas, autoSave]);

  const handleCanvasReady = (fabricCanvas: any) => {
    logger.canvas("Canvas is ready!", fabricCanvas);
    setCanvas(fabricCanvas);
    setIsCanvasReady(true);
  };

  const handleNetlistReady = (getNetlistFn: () => any) => {
    logger.wire("Netlist access ready");
    setGetNetlist(() => getNetlistFn);
  };

  return (
    <CanvasProvider canvas={canvas} isReady={isCanvasReady}>
      <AIChatProvider>
        {/* Show restriction message on smaller screens */}
        <DeviceRestriction />

        {/* Main IDE - only visible on large screens */}
        <div className="hidden lg:flex flex-col relative w-full h-screen bg-gray-100 overflow-hidden">
          {/* Canvas Container - Flexible and can shrink */}
          <div className="flex-1 min-h-0 relative">
            {/* Interactive Canvas Background */}
            <div
              className="absolute inset-0 canvas-container"
              data-scrollable="false"
            >
              <IDEFabricCanvas
                className="w-full h-full"
                onCanvasReady={handleCanvasReady}
                onNetlistReady={handleNetlistReady}
                onSave={sharedSaveFunction}
              />
            </div>

            {/* Schema Panel positioned absolutely on top of canvas */}
            <SchemaPanel />

            {/* Top Toolbar positioned absolutely on top of canvas */}
            <TopToolbar getNetlist={getNetlist} onSave={sharedSaveFunction} />

            {/* AI Chat Interface - positioned above PromptEntry */}
            <div
              className="absolute z-20"
              style={{
                bottom: responsive(150), // 32 (prompt bottom) + 97 (prompt height) + 25 (thinking height) + 15 (spacing: 10 + 5)
                right: responsive(32), // Match PromptEntry's responsive(32)
                width: responsive(338), // Match PromptEntry's exact width
              }}
            >
              <AIChatInterface
                onCircuitUpdate={(changes) => {
                  logger.api("Circuit changes from AI:", changes);
                  // TODO: Apply circuit changes to canvas
                }}
              />
            </div>
          </div>

          {/* AI Prompt Panel - Fixed at bottom, always visible */}
          <div className="flex-shrink-0 relative">
            <AIPromptPanel />
          </div>
        </div>
      </AIChatProvider>
    </CanvasProvider>
  );
}
