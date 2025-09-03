"use client";

import { useState } from "react";
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
import * as fabric from "fabric";

export function IDECanvas() {
  // Override all browser mouse/keyboard controls
  useOverrideBrowserControls();

  // Canvas state for the provider
  const [canvas, setCanvas] = useState<any>(null);
  const [isCanvasReady, setIsCanvasReady] = useState(false);

  const handleCanvasReady = (fabricCanvas: any) => {
    console.log("🎨 Canvas is ready!", fabricCanvas);
    setCanvas(fabricCanvas);
    setIsCanvasReady(true);
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
              />
            </div>

            {/* Schema Panel positioned absolutely on top of canvas */}
            <SchemaPanel />

            {/* Top Toolbar positioned absolutely on top of canvas */}
            <TopToolbar />

            {/* AI Chat Interface - positioned above PromptEntry */}
            <div
              className="absolute z-20"
              style={{
                bottom: responsive(180), // 32 (prompt bottom) + 97 (prompt height) + 25 (thinking height) + 15 (spacing: 10 + 5)
                right: responsive(32), // Match PromptEntry's responsive(32)
                width: responsive(338), // Match PromptEntry's exact width
              }}
            >
              <AIChatInterface
                onCircuitUpdate={(changes) => {
                  console.log("Circuit changes from AI:", changes);
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
