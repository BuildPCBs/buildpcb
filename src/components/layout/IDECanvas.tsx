"use client";

import { SchemaPanel } from "./SchemaPanel";
import { TopToolbar } from "./TopToolbar";
import { AIPromptPanel } from "./AIPromptPanel";
import { DeviceRestriction } from "./DeviceRestriction";
import { IDEFabricCanvas } from "@/canvas";
import { PCBCanvas } from "@/canvas/PCBCanvas";
import { useOverrideBrowserControls } from "@/hooks/useOverrideBrowserControls";
import { useView } from "@/contexts/ViewContext";

export function IDECanvas() {
  // Override all browser mouse/keyboard controls
  useOverrideBrowserControls();
  
  const { currentView } = useView();

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
            {currentView === "schematic" ? (
              <IDEFabricCanvas className="w-full h-full" />
            ) : (
              <PCBCanvas className="w-full h-full" />
            )}
          </div>

          {/* Schema Panel positioned absolutely on top of canvas - only in schematic view */}
          {currentView === "schematic" && <SchemaPanel />}

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
