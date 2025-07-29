import { useState } from "react";
import { useRouter } from "next/navigation";
import { HomeIcon, SearchIcon, WindowIcon } from "@/components/icons";
import { ProjectItem } from "@/components/ui/ProjectItem";
import { useClickOutside } from "@/hooks/useClickOutside";
import { r, responsive, responsiveFontSize } from "@/lib/responsive";

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
      // State 3: Fully expanded - responsive design
      return {
        width: responsive(280),
        minWidth: responsive(250),
        maxWidth: "25vw",
        ...r({
          borderRadius: 24,
          padding: 16,
        }),
      };
    } else if (isHovered) {
      // State 2: Hover preview - responsive design
      return {
        width: responsive(200),
        minWidth: responsive(180),
        ...r({
          borderRadius: 24,
          padding: 16,
        }),
      };
    } else {
      // State 1: Very small rounded - responsive design
      return {
        ...r({
          width: 60,
          height: 60,
          borderRadius: 30,
          padding: 8,
        }),
      };
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute bg-white border border-[#ddd] transition-all duration-300 ease-in-out overflow-hidden cursor-pointer"
      style={{
        top: responsive(38),
        left: responsive(31),
        ...getPanelStyles(),
      }}
      onMouseEnter={() => !isFullyExpanded && setIsHovered(true)}
      onMouseLeave={() => !isFullyExpanded && setIsHovered(false)}
      onClick={() => !isFullyExpanded && toggleFullExpand()}
    >
      {/* Inner container with 2px spacing from panel edges */}
      <div style={{ padding: responsive(2), height: "100%" }}>
        {/* Very small state - just show a compact icon */}
        {!isHovered && !isFullyExpanded && (
          <div className="flex items-center justify-center w-full h-full">
            <WindowIcon size={20} className="text-[#969696]" />
          </div>
        )}

        {/* Hover state OR Fully expanded - show your original design */}
        {(isHovered || isFullyExpanded) && (
          <>
            {/* Top Header with Icons - responsive design */}
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: responsive(8) }}
            >
              <div
                className="flex items-center"
                style={{ gap: responsive(12) }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHomeClick();
                  }}
                  className="flex items-center hover:bg-gray-100 rounded transition-colors"
                  style={{ padding: responsive(4) }}
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
                className="flex items-center hover:bg-gray-100 rounded transition-colors"
                style={{ padding: responsive(4) }}
              >
                <WindowIcon size={16} className="text-[#969696]" />
              </button>
            </div>

            {/* Fixed spacing between icons and content - responsive */}
            <div style={{ marginBottom: responsive(32) }}></div>

            {/* Schema Title - responsive design */}
            <div
              className={`transition-all duration-300 ease-in-out ${
                !isFullyExpanded ? "max-h-0 opacity-0" : "opacity-100"
              } overflow-hidden`}
              style={{
                maxHeight: isFullyExpanded ? responsive(40) : 0,
                marginBottom: responsive(8),
              }}
            >
              <h2
                className="font-medium text-gray-900 uppercase tracking-wider"
                style={{ fontSize: responsiveFontSize(12) }}
              >
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
      </div>{" "}
      {/* Close inner container with 4px spacing */}
    </div>
  );
}
