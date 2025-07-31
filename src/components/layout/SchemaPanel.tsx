import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeIcon, SearchIcon, WindowIcon } from "@/components/icons";
import { useClickOutside } from "@/hooks/useClickOutside";
import { r, responsive, responsiveFontSize } from "@/lib/responsive";
import { COMPONENT_CATEGORIES } from "@/lib/constants";

// Mock component data
const mockComponents = [
  {
    id: "1",
    name: "Resistor",
    category: "Resistors",
    image: "/components/resistor.svg",
  },
  {
    id: "2",
    name: "Capacitor",
    category: "Capacitors",
    image: "/components/capacitor.svg",
  },
  { id: "3", name: "LED", category: "Diodes", image: "/components/led.svg" },
  {
    id: "4",
    name: "Transistor",
    category: "Transistors",
    image: "/components/transistor.svg",
  },
  {
    id: "5",
    name: "Arduino Uno",
    category: "ICs",
    image: "/components/arduino.svg",
  },
  {
    id: "6",
    name: "Temperature Sensor",
    category: "Sensors",
    image: "/components/sensor.svg",
  },
  {
    id: "7",
    name: "Switch",
    category: "Switches",
    image: "/components/switch.svg",
  },
  {
    id: "8",
    name: "Connector",
    category: "Connectors",
    image: "/components/connector.svg",
  },
  {
    id: "9",
    name: "Inductor",
    category: "Inductors",
    image: "/components/resistor.svg",
  },
  {
    id: "10",
    name: "Op-Amp",
    category: "ICs",
    image: "/components/arduino.svg",
  },
  {
    id: "11",
    name: "Battery",
    category: "Power",
    image: "/components/capacitor.svg",
  },
  {
    id: "12",
    name: "Motor",
    category: "Other",
    image: "/components/switch.svg",
  },
];

const mockSchemas = [
  {
    id: "1",
    name: "Basic LED Circuit",
    description: "Simple LED with resistor",
  },
  {
    id: "2",
    name: "Arduino Blink",
    description: "Arduino with LED blink circuit",
  },
  {
    id: "3",
    name: "Temperature Monitor",
    description: "Temperature sensor with display",
  },
  { id: "4", name: "Power Supply", description: "5V regulated power supply" },
  {
    id: "5",
    name: "Audio Amplifier",
    description: "Simple audio amplifier circuit",
  },
  {
    id: "6",
    name: "Motor Driver",
    description: "H-bridge motor control circuit",
  },
];

interface ComponentItemProps {
  component: (typeof mockComponents)[0];
  onClick: () => void;
}

function ComponentItem({ component, onClick }: ComponentItemProps) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-300 hover:shadow-sm transition-all duration-200 cursor-pointer group flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center group-hover:bg-blue-50 transition-colors flex-shrink-0">
        <img
          src={component.image}
          alt={component.name}
          className="w-4 h-4 object-contain"
          onError={(e) => {
            // Fallback to text if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            target.nextElementSibling?.classList.remove("hidden");
          }}
        />
        <div className="w-4 h-4 bg-gray-300 rounded flex items-center justify-center text-xs text-gray-600 hidden">
          {component.name.charAt(0)}
        </div>
      </div>
      <div className="text-xs text-gray-700 font-medium truncate flex-1">
        {component.name}
      </div>
    </div>
  );
}

interface SchemaItemProps {
  schema: (typeof mockSchemas)[0];
  onClick: () => void;
}

function SchemaItem({ schema, onClick }: SchemaItemProps) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-300 hover:shadow-sm transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="font-medium text-sm text-gray-900 mb-1 truncate">
        {schema.name}
      </div>
      <div className="text-xs text-gray-600 truncate">{schema.description}</div>
    </div>
  );
}

export function SchemaPanel() {
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeTab, setActiveTab] = useState<"components" | "schemas">(
    "components"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [rippleStyle, setRippleStyle] = useState<React.CSSProperties>({});
  const router = useRouter();
  const rippleRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Allow scrolling within the panel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Allow normal scrolling within the schema panel
      e.stopPropagation();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow keyboard navigation within the schema panel
      if (isFullyExpanded) {
        // Allow arrow keys, page up/down, home/end for navigation
        if (
          [
            "ArrowUp",
            "ArrowDown",
            "PageUp",
            "PageDown",
            "Home",
            "End",
          ].includes(e.key)
        ) {
          e.stopPropagation();
        }
        // Allow tab navigation
        if (e.key === "Tab") {
          e.stopPropagation();
        }
        // Allow escape to close panel
        if (e.key === "Escape") {
          e.stopPropagation();
          setIsFullyExpanded(false);
          setIsHovered(false);
          setSearchQuery("");
          setIsSearching(false);
        }
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer && isFullyExpanded) {
      scrollContainer.addEventListener("wheel", handleWheel, { passive: true });
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        scrollContainer.removeEventListener("wheel", handleWheel);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isFullyExpanded]);

  const toggleFullExpand = () => {
    if (isFullyExpanded) {
      setIsFullyExpanded(false);
      setIsHovered(false);
      setSearchQuery("");
      setIsSearching(false);
    } else {
      setIsFullyExpanded(true);
    }
  };

  // Handle click outside to collapse the panel when fully expanded
  const panelRef = useClickOutside<HTMLDivElement>(() => {
    if (isFullyExpanded) {
      setIsFullyExpanded(false);
      setIsHovered(false);
      setSearchQuery("");
      setIsSearching(false);
    }
  });

  const handleHomeClick = () => {
    router.push("/dashboard");
  };

  // Handle ripple effect
  const handleRipple = (e: React.MouseEvent) => {
    if (isFullyExpanded || !rippleRef.current) return;

    const rect = rippleRef.current.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    setRippleStyle({
      width: size,
      height: size,
      left: x,
      top: y,
      opacity: 0.3,
    });

    setTimeout(() => {
      setRippleStyle((prev) => ({ ...prev, opacity: 0 }));
    }, 100);
  };

  // Filter components based on search
  const filteredComponents = mockComponents.filter(
    (component) =>
      component.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      component.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Determine panel state and styles
  const getPanelStyles = () => {
    if (isFullyExpanded) {
      return {
        width: responsive(320),
        minWidth: responsive(300),
        maxWidth: "30vw",
        height: "calc(50vh - 60px)", // 50% shorter
        ...r({
          borderRadius: 24,
          padding: 16,
        }),
      };
    } else if (isHovered) {
      return {
        width: responsive(200),
        minWidth: responsive(180),
        ...r({
          borderRadius: 24,
          padding: 16,
        }),
      };
    } else {
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
      className="absolute bg-white border border-gray-200 shadow-lg transition-all duration-300 ease-in-out overflow-hidden cursor-pointer relative ripple-container"
      style={{
        top: responsive(38),
        left: responsive(31),
        ...getPanelStyles(),
      }}
      onMouseEnter={() => !isFullyExpanded && setIsHovered(true)}
      onMouseLeave={() => !isFullyExpanded && setIsHovered(false)}
      onClick={(e) => {
        if (!isFullyExpanded) {
          handleRipple(e);
          toggleFullExpand();
        }
      }}
      onWheel={(e) => {
        // Allow scrolling within the schema panel
        if (isFullyExpanded) {
          e.stopPropagation();
        }
      }}
      onKeyDown={(e) => {
        // Allow keyboard navigation within the schema panel
        if (isFullyExpanded) {
          e.stopPropagation();
        }
      }}
    >
      {/* Ripple effect for collapsed state */}
      {!isFullyExpanded && (
        <div
          ref={rippleRef}
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ borderRadius: "inherit" }}
        >
          <div
            className="absolute bg-blue-400 rounded-full transition-all duration-500 ease-out"
            style={rippleStyle}
          />
        </div>
      )}

      {/* Inner container with 2px spacing from panel edges */}
      <div style={{ padding: responsive(2), height: "100%" }}>
        {/* Very small state - just show a compact icon */}
        {!isHovered && !isFullyExpanded && (
          <div className="flex items-center justify-center w-full h-full">
            <WindowIcon size={20} className="text-blue-500" />
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
                  className="flex items-center hover:bg-blue-50 rounded transition-colors button-ripple"
                  style={{ padding: responsive(4) }}
                >
                  <HomeIcon size={16} className="text-blue-600" />
                </button>

                {!isSearching ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFullyExpanded) {
                        setIsSearching(true);
                      }
                    }}
                    className="flex items-center hover:bg-blue-50 rounded transition-colors button-ripple"
                    style={{ padding: responsive(4) }}
                  >
                    <SearchIcon size={16} className="text-blue-600" />
                  </button>
                ) : (
                  <div className="flex-1 max-w-32">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-blue-200 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                      autoFocus
                      onBlur={() => {
                        if (!searchQuery) {
                          setIsSearching(false);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullExpand();
                }}
                className="flex items-center hover:bg-blue-50 rounded transition-colors button-ripple"
                style={{ padding: responsive(4) }}
              >
                <WindowIcon size={16} className="text-blue-600" />
              </button>
            </div>

            {/* Fixed spacing between icons and content - responsive */}
            <div style={{ marginBottom: responsive(12) }}></div>

            {/* Modern Tabs - only show when fully expanded */}
            {isFullyExpanded && (
              <div className="flex bg-gray-100 rounded-lg p-1 mb-3">
                <button
                  onClick={() => setActiveTab("components")}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    activeTab === "components"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-blue-600 hover:bg-gray-50"
                  }`}
                >
                  Components
                </button>
                <button
                  onClick={() => setActiveTab("schemas")}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    activeTab === "schemas"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-blue-600 hover:bg-gray-50"
                  }`}
                >
                  Schemas
                </button>
              </div>
            )}

            {/* Search Results - only show when searching */}
            {isSearching && searchQuery && isFullyExpanded && (
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-2">
                  Found {filteredComponents.length} results
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto schema-scroll">
                  {filteredComponents.map((component) => (
                    <ComponentItem
                      key={component.id}
                      component={component}
                      onClick={() => console.log(`Selected ${component.name}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Content based on active tab - only show when fully expanded and not searching */}
            {isFullyExpanded && !isSearching && (
              <div ref={scrollContainerRef} className="flex-1 overflow-hidden">
                {activeTab === "components" ? (
                  <div className="space-y-1 h-full overflow-y-auto schema-scroll">
                    {mockComponents.map((component) => (
                      <ComponentItem
                        key={component.id}
                        component={component}
                        onClick={() =>
                          console.log(`Selected ${component.name}`)
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 h-full overflow-y-auto schema-scroll">
                    {mockSchemas.map((schema) => (
                      <SchemaItem
                        key={schema.id}
                        schema={schema}
                        onClick={() => console.log(`Selected ${schema.name}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Simplified view for hover state */}
            {isHovered && !isFullyExpanded && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-blue-700 uppercase tracking-wider">
                  Schema Panel
                </div>
                <div className="text-xs text-gray-600">Click to expand</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
