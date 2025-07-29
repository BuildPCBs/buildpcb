import { SchemaPanel } from "./SchemaPanel";
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
      <div className="hidden lg:block relative w-full h-screen bg-gray-100 overflow-hidden">
        {/* Interactive Canvas Background */}
        <div className="absolute inset-0">
          <Canvas />
        </div>

        {/* Schema Panel positioned absolutely on top of canvas */}
        <SchemaPanel />
      </div>
    </>
  );
}
