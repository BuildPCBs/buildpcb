"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { SearchIcon } from "@/components/icons";
import {
  useDatabaseComponents,
  ComponentDisplayData,
} from "@/hooks/useDatabaseComponents";
import { canvasCommandManager } from "@/canvas/canvas-command-manager";
import { logger } from "@/lib/logger";

// Lazy loading image component for memory optimization
function LazyImage({
  src,
  alt,
  className,
  placeholder,
}: {
  src: string;
  alt: string;
  className: string;
  placeholder: React.ReactNode;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => setIsLoaded(true);
  const handleError = () => setHasError(true);

  return (
    <div ref={containerRef} className="relative">
      {!isLoaded && !hasError && placeholder}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={className}
          onLoad={handleLoad}
          onError={handleError}
          style={{ display: isLoaded ? "block" : "none" }}
        />
      )}
    </div>
  );
}

interface ComponentPickerOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

interface ComponentPreviewProps {
  component: ComponentDisplayData | null;
  onClose: () => void;
}

function ComponentPreview({ component, onClose }: ComponentPreviewProps) {
  if (!component) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-gray-400">
        <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
          <SearchIcon size={32} className="text-gray-300" />
        </div>
        <p className="text-sm text-center">Select a component to preview</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced Image Preview Section */}
      <div className="flex flex-col items-center mb-4 p-4 bg-white rounded-lg border border-gray-200">
        <div className="w-8 h-8 mb-3 flex items-center justify-center">
          {component.image ? (
            <img
              src={component.image}
              alt={component.package_id}
              className="max-w-full max-h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                target.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className="w-full h-full bg-gray-100 rounded flex flex-col items-center justify-center text-gray-500 hidden">
            <div className="text-2xl font-semibold mb-1">
              {component.package_id.charAt(0)}
            </div>
            <p className="text-xs">No image available</p>
          </div>
        </div>

        <div className="text-center">
          <h3 className="font-semibold text-gray-900 text-lg mb-1">
            {component.package_id}
          </h3>
          <p className="text-sm text-gray-500">{component.category}</p>
        </div>
      </div>

      {/* Component Details */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-3">
          {component.description && (
            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Description
              </h4>
              <p className="text-sm text-gray-600">{component.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {component.manufacturer && (
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                  Manufacturer
                </h4>
                <p className="text-sm text-gray-600">
                  {component.manufacturer}
                </p>
              </div>
            )}

            {component.partNumber && (
              <div>
                <h4 className="text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                  Part Number
                </h4>
                <p className="text-sm text-gray-600">{component.partNumber}</p>
              </div>
            )}

            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Pins
              </h4>
              <p className="text-sm text-gray-600">
                {component.pinCount || 0} pins
              </p>
            </div>

            <div>
              <h4 className="text-xs font-medium text-gray-700 mb-1 uppercase tracking-wide">
                Type
              </h4>
              <p className="text-sm text-gray-600">{component.type}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => {
          logger.component("Add to Canvas clicked for:", component.package_id);
          logger.component("Component data:", {
            id: component.id,
            type: component.type,
            image: component.image,
            name: component.name,
            package_id: component.package_id,
            category: component.category,
            description: component.description,
            manufacturer: component.manufacturer,
            partNumber: component.partNumber,
            pinCount: component.pinCount,
          });
          logger.component(
            "Image starts with:",
            component.image.substring(0, 50) + "..."
          );
          logger.component("Image length:", component.image.length);

          const timestamp = new Date().toISOString();
          logger.component(`Adding ${component.name} to canvas from overlay`);

          try {
            logger.component(
              "Canvas command manager canvas:",
              canvasCommandManager.getCanvas()
            );
            const result = canvasCommandManager.executeCommand(
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

            logger.component("Command execution result:", result);

            if (result) {
              logger.component("Component added successfully");
              onClose();
            } else {
              console.error(
                "❌ Failed to add component - command returned false"
              );
            }
          } catch (error) {
            console.error("❌ Error executing component:add command:", error);
          }
        }}
        className="w-full mt-4 px-4 py-2.5 bg-[#0038DF] text-white rounded-lg hover:bg-[#0038DF]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0038DF]/50 font-medium"
      >
        Add to Canvas
      </button>
    </div>
  );
}

export function ComponentPickerOverlay({
  isVisible,
  onClose,
}: ComponentPickerOverlayProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedComponent, setSelectedComponent] =
    useState<ComponentDisplayData | null>(null);
  const [isKeyboardNavigation, setIsKeyboardNavigation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    components: databaseComponents,
    loading: componentsLoading,
    error: componentsError,
    hasMore,
    searchComponents,
    loadMore,
  } = useDatabaseComponents();

  const filteredComponents = useMemo(() => {
    const baseComponents = searchQuery.trim()
      ? searchComponents(searchQuery)
      : databaseComponents;

    // Filter out components with temporary IDs (components without proper database uid)
    return baseComponents.filter(
      (component) => !component.id.startsWith("temp_")
    );
  }, [searchQuery, databaseComponents, searchComponents]);

  // Debug logging - only in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      logger.component("ComponentPickerOverlay state:", {
        databaseComponentsCount: databaseComponents.length,
        componentsLoading,
        componentsError,
        hasMore,
        searchQuery,
        filteredComponentsCount: filteredComponents.length,
      });
    }
  }, [
    databaseComponents.length,
    componentsLoading,
    componentsError,
    hasMore,
    searchQuery,
  ]);

  useEffect(() => {
    // Only reset selection when search query changes or when filteredComponents is empty
    if (searchQuery.trim()) {
      // When searching, reset to first result
      setSelectedIndex(0);
      setSelectedComponent(filteredComponents[0] || null);
    } else if (filteredComponents.length === 0) {
      // When no components, clear selection
      setSelectedIndex(0);
      setSelectedComponent(null);
    } else if (selectedIndex >= filteredComponents.length) {
      // If current selection is out of bounds, adjust to last valid item
      const newIndex = Math.max(0, filteredComponents.length - 1);
      setSelectedIndex(newIndex);
      setSelectedComponent(filteredComponents[newIndex] || null);
    } else if (filteredComponents.length > 0 && !selectedComponent) {
      // If we have components but no selection, select first one
      setSelectedIndex(0);
      setSelectedComponent(filteredComponents[0]);
    }
  }, [searchQuery, filteredComponents.length]);

  // Ensure selectedComponent stays in sync with selectedIndex
  useEffect(() => {
    if (
      filteredComponents.length > 0 &&
      selectedIndex >= 0 &&
      selectedIndex < filteredComponents.length
    ) {
      const currentComponent = filteredComponents[selectedIndex];
      if (currentComponent !== selectedComponent) {
        setSelectedComponent(currentComponent);
      }
    }
  }, [selectedIndex, filteredComponents, selectedComponent]);

  // Focus input when overlay becomes visible
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isVisible]);

  // Load more components if needed
  useEffect(() => {
    if (
      searchQuery.trim() &&
      filteredComponents.length === 0 &&
      hasMore &&
      !componentsLoading
    ) {
      logger.component("No search results found, loading more components...");
      loadMore();
    }
  }, [
    searchQuery,
    filteredComponents.length,
    hasMore,
    componentsLoading,
    loadMore,
  ]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible) return;

      // Allow arrow keys to work even when input is focused
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === "Escape"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }

      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowDown":
          setIsKeyboardNavigation(true);
          setSelectedIndex((prev) => {
            const next = Math.min(prev + 1, filteredComponents.length - 1);
            // Only update if we're not already at the boundary
            if (next !== prev) {
              setSelectedComponent(filteredComponents[next] || null);
              // Clear any pending scroll timeout
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
              }
              return next;
            }
            return prev;
          });
          // Reset keyboard navigation flag after a longer delay
          setTimeout(() => setIsKeyboardNavigation(false), 500);
          break;
        case "ArrowUp":
          setIsKeyboardNavigation(true);
          setSelectedIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            // Only update if we're not already at the boundary
            if (next !== prev) {
              setSelectedComponent(filteredComponents[next] || null);
              // Clear any pending scroll timeout
              if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
              }
              return next;
            }
            return prev;
          });
          // Reset keyboard navigation flag after a longer delay
          setTimeout(() => setIsKeyboardNavigation(false), 500);
          break;
        case "Enter":
          if (selectedComponent) {
            const timestamp = new Date().toISOString();
            logger.component(
              `Adding ${selectedComponent.name} to canvas from overlay`
            );
            logger.component(`Selected component data:`, {
              id: selectedComponent.id,
              name: selectedComponent.name,
              package_id: selectedComponent.package_id,
              type: selectedComponent.type,
              hasImage: !!selectedComponent.image,
              imageLength: selectedComponent.image?.length,
              pinCount: selectedComponent.pinCount,
              imagePreview: selectedComponent.image?.substring(0, 200) + "...",
            });

            canvasCommandManager.executeCommand("component:add", {
              id: selectedComponent.id,
              type: selectedComponent.type,
              svgPath: selectedComponent.image,
              name: selectedComponent.name,
              category: selectedComponent.category,
              description: selectedComponent.description,
              manufacturer: selectedComponent.manufacturer,
              partNumber: selectedComponent.partNumber,
              pinCount: selectedComponent.pinCount,
            });
            onClose();
          }
          break;
      }
    },
    [isVisible, onClose, selectedComponent, filteredComponents]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        const container = listRef.current;
        const elementTop = selectedElement.offsetTop;
        const elementHeight = selectedElement.offsetHeight;
        const containerHeight = container.clientHeight;
        const containerScrollTop = container.scrollTop;

        // Check if element is not fully visible
        if (elementTop < containerScrollTop) {
          // Element is above viewport, scroll up to show it
          container.scrollTo({
            top: elementTop,
            behavior: "smooth",
          });
        } else if (
          elementTop + elementHeight >
          containerScrollTop + containerHeight
        ) {
          // Element is below viewport, scroll down to show it
          container.scrollTo({
            top: elementTop + elementHeight - containerHeight,
            behavior: "smooth",
          });
        }
      }
    }
  }, [selectedIndex]);

  // Add scroll event listener to keep selection in sync with scroll position
  useEffect(() => {
    const handleScroll = () => {
      // Skip scroll sync during keyboard navigation
      if (isKeyboardNavigation) return;

      // Debounce scroll events
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        if (!listRef.current || filteredComponents.length === 0) return;

        const container = listRef.current;
        const containerScrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;

        // Find the item that's most visible in the current scroll position
        let bestIndex = 0;
        let bestVisibility = 0;

        for (let i = 0; i < filteredComponents.length; i++) {
          const element = container.children[i] as HTMLElement;
          if (!element) continue;

          const elementTop = element.offsetTop;
          const elementHeight = element.offsetHeight;
          const elementBottom = elementTop + elementHeight;

          // Calculate how much of the element is visible
          const visibleTop = Math.max(containerScrollTop, elementTop);
          const visibleBottom = Math.min(
            containerScrollTop + containerHeight,
            elementBottom
          );
          const visibleHeight = Math.max(0, visibleBottom - visibleTop);
          const visibility = visibleHeight / elementHeight;

          // If this element is more visible than the current best, update
          if (visibility > bestVisibility) {
            bestVisibility = visibility;
            bestIndex = i;
          }
        }

        // Only update if we found a significantly more visible item
        if (bestVisibility > 0.5 && bestIndex !== selectedIndex) {
          setSelectedIndex(bestIndex);
          setSelectedComponent(filteredComponents[bestIndex] || null);
        }
      }, 100); // 100ms debounce
    };

    const container = listRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        container.removeEventListener("scroll", handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, [filteredComponents, selectedIndex, isKeyboardNavigation]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Component Library
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="text-gray-500 text-xl leading-none">×</span>
          </button>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <SearchIcon
              size={18}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search components by name, category, or part number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0038DF]/50 focus:border-[#0038DF]"
            />
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-2/5 border-r border-gray-200 overflow-hidden">
            <div ref={listRef} className="h-full overflow-y-auto">
              {componentsLoading && filteredComponents.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0038DF] mx-auto mb-3"></div>
                    <p className="text-sm text-gray-500">
                      Loading components...
                    </p>
                  </div>
                </div>
              ) : componentsError ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3 mx-auto">
                      <span className="text-red-500 text-xl font-bold">!</span>
                    </div>
                    <p className="text-sm text-red-500">
                      Error loading components
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {componentsError}
                    </p>
                  </div>
                </div>
              ) : filteredComponents.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 mx-auto">
                      <SearchIcon size={24} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-500">
                      {searchQuery
                        ? componentsLoading
                          ? "Searching more components..."
                          : "No components found"
                        : "No components available"}
                    </p>
                    {searchQuery && (
                      <p className="text-xs text-gray-400 mt-1">
                        Try a different search term
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredComponents.map((component, index) => (
                    <div
                      key={component.id}
                      onClick={() => {
                        // Disable scroll sync temporarily when clicking
                        setIsKeyboardNavigation(true);
                        setSelectedIndex(index);
                        setSelectedComponent(component);
                        // Re-enable scroll sync after a delay
                        setTimeout(() => setIsKeyboardNavigation(false), 300);
                      }}
                      className={`p-3 cursor-pointer transition-colors ${
                        index === selectedIndex
                          ? "bg-[#0038DF]/5 border-r-2 border-[#0038DF]"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <LazyImage
                            src={component.image}
                            alt={component.package_id}
                            className="w-10 h-10 object-contain"
                            placeholder={
                              <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-sm font-medium text-gray-600">
                                {component.package_id.charAt(0)}
                              </div>
                            }
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {component.package_id}
                          </div>
                          <div className="text-xs text-gray-500 flex gap-2 mt-1">
                            <span className="bg-gray-100 px-2 py-0.5 rounded">
                              {component.category}
                            </span>
                            <span>{component.pinCount || 0} pins</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {hasMore && !componentsLoading && (
                    <div className="p-3 border-t border-gray-200 bg-gray-50 sticky bottom-0">
                      <button
                        onClick={loadMore}
                        className="w-full py-2 text-sm text-[#0038DF] hover:bg-[#0038DF]/10 rounded-lg transition-colors font-medium"
                      >
                        Load more components...
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-3/5 p-5 bg-gray-50">
            <ComponentPreview component={selectedComponent} onClose={onClose} />
          </div>
        </div>
      </div>
    </div>
  );
}
