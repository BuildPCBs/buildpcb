import { useState } from "react";
import { useRouter } from "next/navigation";
import { HomeIcon, SearchIcon, WindowIcon } from "@/components/icons";
import { ProjectItem } from "@/components/ui/ProjectItem";
import { useClickOutside } from "@/hooks/useClickOutside";

const mockProjects = [
  "USB LED Layout",
  "Raspberry Pi Camera Module",
  "ESP32 Weather Station",
  "STM32 Motor Controller",
  "IoT Sensor Network",
];

export function SchemaPanel() {
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const toggleFullExpand = () => {
    if (isFullyExpanded) {
      // When closing from fully expanded, go back to very small rounded
      setIsFullyExpanded(false);
      setIsHovered(false); // Ensure we go to the minimal state
    } else {
      // When opening, go to fully expanded
      setIsFullyExpanded(true);
    }
  };

  // Handle click outside to collapse the panel when fully expanded
  const panelRef = useClickOutside<HTMLDivElement>(() => {
    if (isFullyExpanded) {
      setIsFullyExpanded(false);
      setIsHovered(false); // Go back to very small rounded state
    }
  });

  const handleHomeClick = () => {
    router.push("/dashboard");
  };

  // Determine panel state and styles
  const getPanelStyles = () => {
    if (isFullyExpanded) {
      // State 3: Fully expanded (your original big design)
      return {
        width: "280px",
        height: "auto",
        borderRadius: "24px",
        padding: "16px",
      };
    } else if (isHovered) {
      // State 2: Hover preview (your original smaller design - unchanged)
      return {
        width: "200px",
        height: "auto",
        borderRadius: "24px",
        padding: "16px",
      };
    } else {
      // State 1: Very small rounded (new minimal state)
      return {
        width: "60px",
        height: "60px",
        borderRadius: "30px",
        padding: "8px",
      };
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute bg-white border border-[#ddd] transition-all duration-300 ease-in-out overflow-hidden cursor-pointer"
      style={{
        top: "38px",
        left: "31px",
        ...getPanelStyles(),
      }}
      onMouseEnter={() => !isFullyExpanded && setIsHovered(true)}
      onMouseLeave={() => !isFullyExpanded && setIsHovered(false)}
      onClick={() => !isFullyExpanded && toggleFullExpand()}
    >
      {/* Very small state - just show a compact icon */}
      {!isHovered && !isFullyExpanded && (
        <div className="flex items-center justify-center w-full h-full">
          <WindowIcon size={20} className="text-[#969696]" />
        </div>
      )}

      {/* Hover state OR Fully expanded - show your original design */}
      {(isHovered || isFullyExpanded) && (
        <>
          {/* Top Header with Icons - your original design */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleHomeClick();
                }}
                className="flex items-center hover:bg-gray-100 p-1 rounded transition-colors"
              >
                <HomeIcon size={16} className="text-[#969696]" />
              </button>
              <SearchIcon size={16} className="text-[#969696]" />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullExpand();
              }}
              className="flex items-center hover:bg-gray-100 p-1 rounded transition-colors"
            >
              <WindowIcon size={16} className="text-[#969696]" />
            </button>
          </div>

          {/* Fixed spacing between icons and content - your original design */}
          <div className="mb-8"></div>

          {/* Schema Title - your original design */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              !isFullyExpanded ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
            } overflow-hidden`}
          >
            <h2 className="text-xs font-medium text-gray-900 uppercase tracking-wider mb-2">
              SCHEMAS
            </h2>
          </div>

          {/* Project List - your original design */}
          <div
            className={`transition-all duration-300 ease-in-out ${
              !isFullyExpanded ? "max-h-12" : "max-h-96"
            } overflow-hidden`}
          >
            <div className="space-y-1">
              {!isFullyExpanded ? (
                <ProjectItem
                  name={mockProjects[0]}
                  onClick={() => console.log(`Opening ${mockProjects[0]}`)}
                  isCollapsed={true}
                />
              ) : (
                mockProjects.map((project, index) => (
                  <ProjectItem
                    key={index}
                    name={project}
                    onClick={() => console.log(`Opening ${project}`)}
                    isCollapsed={false}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
