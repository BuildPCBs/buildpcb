"use client";

import { SchemaPanel } from "./SchemaPanel";
import { TopToolbar } from "./TopToolbar";
import { AIPromptPanel } from "./AIPromptPanel";
import { DeviceRestriction } from "./DeviceRestriction";
import { Canvas } from "@/canvas";
import { useOverrideBrowserControls } from "@/hooks/useOverrideBrowserControls";

export function IDECanvas() {
  // Override all browser mouse/keyboard controls
  useOverrideBrowserControls();

  return (
    <>
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
            <Canvas className="w-full h-full" />
          </div>

          {/* Schema Panel positioned absolutely on top of canvas */}
          <SchemaPanel />

          {/* Top Toolbar positioned absolutely on top of canvas */}
          <TopToolbar />
        </div>

        {/* AI Prompt Panel - Fixed at bottom, always visible */}
        <div className="flex-shrink-0 relative">
          <AIPromptPanel />
        </div>
      </div>
    </>
  );
}
