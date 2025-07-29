import { useState } from "react";
import { HomeIcon, SearchIcon, WindowIcon } from "@/components/icons";
import { ProjectItem } from "@/components/ui/ProjectItem";

const mockProjects = [
  "USB LED Layout",
  "Raspberry Pi Camera Module",
  "ESP32 Weather Station",
  "STM32 Motor Controller",
  "IoT Sensor Network",
];

export function SchemaPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className="absolute bg-white border border-[#ddd] transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        top: "38px",
        left: "31px",
        width: isCollapsed ? "200px" : "280px",
        height: isCollapsed ? "auto" : "auto",
        borderRadius: "24px",
        padding: "16px",
      }}
    >
      {/* Top Header with Icons */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <HomeIcon size={16} className="text-gray-600" />
          <SearchIcon size={16} className="text-gray-600" />
        </div>
        <button
          onClick={toggleCollapse}
          className="flex items-center hover:bg-gray-100 p-1 rounded transition-colors"
        >
          <WindowIcon size={16} className="text-gray-600" />
        </button>
      </div>

      {/* Fixed spacing between icons and content */}
      <div className="mb-8"></div>

      {/* Schema Title - only show when expanded */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isCollapsed ? "max-h-0 opacity-0" : "max-h-10 opacity-100"
        } overflow-hidden`}
      >
        <h2 className="text-xs font-medium text-gray-900 uppercase tracking-wider mb-2">
          SCHEMAS
        </h2>
      </div>

      {/* Project List - animate the fold */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isCollapsed ? "max-h-12" : "max-h-96"
        } overflow-hidden`}
      >
        <div className="space-y-1">
          {isCollapsed ? (
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
    </div>
  );
}
