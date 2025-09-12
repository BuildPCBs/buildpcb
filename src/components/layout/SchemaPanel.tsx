import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HomeIcon, SearchIcon, WindowIcon } from "@/components/icons";
import { useClickOutside } from "@/hooks/useClickOutside";
import { r, responsive } from "@/lib/responsive";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";
import {
  useDatabaseComponents,
  ComponentDisplayData,
} from "@/hooks/useDatabaseComponents";

interface ComponentItemProps {
  component: ComponentDisplayData;
  onClick: (e: React.MouseEvent) => void;
}

function ComponentItem({ component, onClick }: ComponentItemProps) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-2 hover:border-[#0038DF] hover:shadow-sm transition-all duration-200 cursor-pointer group flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#0038DF] focus:border-[#0038DF]"
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e as any);
        }
      }}
    >
      <div className="w-6 h-6 bg-gray-50 rounded flex items-center justify-center group-hover:bg-[#0038DF]/10 transition-colors flex-shrink-0">
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

  // Use database components hook
  const {
    components: databaseComponents,
    loading: componentsLoading,
    error: componentsError,
    hasMore,
    searchComponents,
    loadMore,
  } = useDatabaseComponents();

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

  // Filter components based on search using database components
  const filteredComponents = searchQuery.trim()
    ? searchComponents(searchQuery)
    : databaseComponents;

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
            className="absolute bg-[#0038DF] rounded-full transition-all duration-500 ease-out"
            style={rippleStyle}
          />
        </div>
      )}

      {/* Inner container with 2px spacing from panel edges */}
      <div
        style={{ padding: responsive(2), height: "100%" }}
        className="flex flex-col"
      >
        {/* Very small state - just show a compact icon */}
        {!isHovered && !isFullyExpanded && (
          <div className="flex items-center justify-center w-full h-full">
            <WindowIcon size={20} className="text-[#0038DF]" />
          </div>
        )}

        {/* Hover state OR Fully expanded - show your original design */}
        {(isHovered || isFullyExpanded) && (
          <div className="flex flex-col h-full">
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
                  className="flex items-center hover:bg-[#0038DF]/10 rounded transition-colors button-ripple"
                  style={{ padding: responsive(4) }}
                >
                  <HomeIcon size={16} className="text-[#0038DF]" />
                </button>

                {!isSearching ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFullyExpanded) {
                        setIsSearching(true);
                      }
                    }}
                    className="flex items-center hover:bg-[#0038DF]/10 rounded transition-colors button-ripple"
                    style={{ padding: responsive(4) }}
                  >
                    <SearchIcon size={16} className="text-[#0038DF]" />
                  </button>
                ) : (
                  <div className="flex-1 max-w-32">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-[#0038DF]/30 rounded focus:outline-none focus:border-[#0038DF] focus:ring-1 focus:ring-[#0038DF]/20"
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
                className="flex items-center hover:bg-[#0038DF]/10 rounded transition-colors button-ripple"
                style={{ padding: responsive(4) }}
              >
                <WindowIcon size={16} className="text-[#0038DF]" />
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
                      ? "bg-white text-[#0038DF] shadow-sm"
                      : "text-gray-600 hover:text-[#0038DF] hover:bg-gray-50"
                  }`}
                >
                  Components
                </button>
                <button
                  onClick={() => setActiveTab("schemas")}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                    activeTab === "schemas"
                      ? "bg-white text-[#0038DF] shadow-sm"
                      : "text-gray-600 hover:text-[#0038DF] hover:bg-gray-50"
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
                <div
                  className="space-y-1 max-h-32 overflow-y-auto schema-scroll"
                  data-scrollable="true"
                >
                  {filteredComponents.map((component: ComponentDisplayData) => (
                    <ComponentItem
                      key={component.id}
                      component={component}
                      onClick={(e) => {
                        e.stopPropagation(); // THE FIX - Prevent multiple event firing
                        const timestamp = new Date().toISOString();
                        console.log(
                          `[${timestamp}] CLICK: Adding ${component.name} to canvas`
                        );
                        canvasCommandManager.executeCommand("component:add", {
                          id: component.id,
                          type: component.type,
                          svgPath: component.image,
                          name: component.name,
                          category: component.category,
                          description: component.description,
                          manufacturer: component.manufacturer,
                          partNumber: component.partNumber,
                          pinCount: component.pinCount,
                        });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Content based on active tab - only show when fully expanded and not searching */}
            {isFullyExpanded && !isSearching && (
              <div
                ref={scrollContainerRef}
                className="flex-1 flex flex-col min-h-0"
                data-scrollable="true"
                style={{ height: "100%" }}
              >
                {activeTab === "components" ? (
                  <div
                    className="flex-1 overflow-y-auto schema-scroll"
                    data-scrollable="true"
                    style={{ height: "0", minHeight: "100%" }}
                  >
                    {componentsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-sm text-gray-500">
                          Loading components...
                        </div>
                      </div>
                    ) : componentsError ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-sm text-red-500 text-center">
                          Error loading components: {componentsError}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {databaseComponents.map((component) => (
                          <ComponentItem
                            key={component.id}
                            component={component}
                            onClick={(e) => {
                              e.stopPropagation(); // THE FIX - Prevent multiple event firing
                              const timestamp = new Date().toISOString();
                              console.log(
                                `[${timestamp}] CLICK: Adding ${component.name} to canvas`
                              );
                              canvasCommandManager.executeCommand(
                                "component:add",
                                {
                                  id: component.id,
                                  type: component.type,
                                  svgPath: component.image,
                                  name: component.name,
                                  category: component.category,
                                  description: component.description,
                                  manufacturer: component.manufacturer,
                                  partNumber: component.partNumber,
                                  pinCount: component.pinCount,
                                }
                              );
                            }}
                          />
                        ))}
                        {hasMore && !componentsLoading && (
                          <div className="flex justify-center py-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                loadMore();
                              }}
                              className="px-4 py-2 text-xs bg-[#0038DF] text-white rounded-md hover:bg-[#0038DF]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0038DF]/50"
                            >
                              Load More Components
                            </button>
                          </div>
                        )}
                        {componentsLoading && databaseComponents.length > 0 && (
                          <div className="flex justify-center py-4">
                            <div className="text-xs text-gray-500">Loading more components...</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex-1 overflow-y-auto schema-scroll"
                    data-scrollable="true"
                    style={{ height: "0", minHeight: "100%" }}
                  >
                    <div className="space-y-2">
                      <div className="text-sm text-gray-500 text-center py-8">
                        Schemas feature coming soon...
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Simplified view for hover state */}
            {isHovered && !isFullyExpanded && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#0038DF] uppercase tracking-wider">
                  Schema Panel
                </div>
                <div className="text-xs text-gray-600">Click to expand</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
