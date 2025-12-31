import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import { Component } from "@/types";

export interface DatabaseComponent extends Component {
  created_at?: string;
  updated_at?: string;
}

export interface ComponentDisplayData {
  id: string;
  name: string;
  library: string;
  description?: string;
  pin_count: number;
  keywords?: string;
  datasheet?: string;
  image?: string; // Generated SVG data URL
}

export function useDatabaseComponents() {
  const [components, setComponents] = useState<ComponentDisplayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const searchCacheRef = useRef<
    Map<string, { generation: number; results: ComponentDisplayData[] }>
  >(new Map());
  const cacheGenerationRef = useRef(0);

  const invalidateSearchCache = useCallback(() => {
    cacheGenerationRef.current += 1;
    searchCacheRef.current.clear();
    logger.component("Component search cache invalidated", {
      generation: cacheGenerationRef.current,
    });
  }, []);

  const PAGE_SIZE = 100; // Reduced from 1000 to 100 for better memory management

  // Counter for generating unique temporary IDs
  const tempIdCounter = useRef(0);

  const fetchComponents = useCallback(
    async (loadMore = false) => {
      logger.api("🚀 fetchComponents started", {
        loadMore,
        offset,
        PAGE_SIZE,
        currentComponentsCount: components.length,
      });

      try {
        logger.api("Fetching components from database...", {
          loadMore,
          offset,
          PAGE_SIZE,
        });

        if (!loadMore) {
          setLoading(true);
          setOffset(0);
        } else {
          setIsLoadingMore(true);
        }
        setError(null);

        const currentOffset = loadMore ? offset : 0;
        logger.api("Making Supabase query:", {
          table: "components",
          range: [currentOffset, currentOffset + PAGE_SIZE - 1],
          orderBy: "name",
        });

        const { data, error: fetchError } = await supabase
          .from("components")
          .select("*")
          .order("name")
          .range(currentOffset, currentOffset + PAGE_SIZE - 1);

        logger.api("Supabase response:", {
          dataLength: data?.length || 0,
          error: fetchError,
          hasMore: data ? data.length === PAGE_SIZE : false,
        });

        if (fetchError) {
          console.error("❌ Supabase fetch error:", fetchError);
          throw fetchError;
        }

        if (data) {
          logger.api("Processing", data.length, "components from database");

          // Check if we have more data
          setHasMore(data.length === PAGE_SIZE);

          // Transform database components to display format
          const displayComponents: ComponentDisplayData[] = data.map(
            (comp: DatabaseComponent) => {
              logger.api("Processing component:", {
                id: comp.id,
                name: comp.name,
                library: comp.library,
                pin_count: comp.pin_count,
              });

              return {
                id: comp.id,
                name: comp.name,
                library: comp.library,
                description: comp.description,
                pin_count: comp.pin_count,
                keywords: comp.keywords,
                datasheet: comp.datasheet,
                image: getComponentImage(comp),
              };
            }
          );

          logger.api("Setting", displayComponents.length, "display components");

          // Invalidate cached search results before updating component state
          cacheGenerationRef.current += 1;
          searchCacheRef.current.clear();

          if (loadMore) {
            setComponents((prev) => {
              const newComponents = [...prev, ...displayComponents];
              logger.api(
                "Total components after load more:",
                newComponents.length
              );
              return newComponents;
            });
            setOffset((prev) => prev + PAGE_SIZE);
          } else {
            setComponents(displayComponents);
            setOffset(PAGE_SIZE);
            logger.api("Set initial components:", displayComponents.length);
          }
        } else {
          logger.api("No data returned from Supabase");
        }
      } catch (err) {
        logger.api("❌ Error fetching components:", {
          error: err,
          errorMessage: err instanceof Error ? err.message : String(err),
          loadMore,
          offset,
        });
        console.error("❌ Full error details:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch components"
        );
      } finally {
        setLoading(false);
        setIsLoadingMore(false);
        logger.api("✅ Component fetch completed", {
          finalComponentCount: components.length,
          loadMore,
        });
      }
    },
    [offset] // Remove invalidateSearchCache to prevent infinite re-renders
  );

  const loadMoreComponents = useCallback(() => {
    if (hasMore && !loading) {
      fetchComponents(true);
    }
  }, [hasMore, loading, fetchComponents]);

  // Memory cleanup function
  const cleanupMemory = useCallback(() => {
    logger.api("Cleaning up component memory...");
    invalidateSearchCache();
    setComponents([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
  }, [invalidateSearchCache]);

  // Auto-cleanup when component unmounts or when memory usage gets high
  useEffect(() => {
    const handleMemoryPressure = () => {
      logger.api("Memory pressure detected, cleaning up components...");
      cleanupMemory();
    };

    // Listen for memory pressure events (if supported)
    if ("memory" in performance) {
      const memoryInfo = (performance as any).memory;
      if (memoryInfo.usedJSHeapSize > memoryInfo.totalJSHeapSize * 0.8) {
        logger.api("High memory usage detected, triggering cleanup...");
        cleanupMemory();
      }
    }

    return () => {
      // Cleanup function for useEffect
    };
  }, [cleanupMemory]);

  // Initial component fetch
  useEffect(() => {
    logger.api("🚀 Initial component fetch triggered", {
      currentComponentCount: components.length,
      loading,
      hasMore,
    });

    // Fetch immediately without delay
    fetchComponents(false).catch((err) => {
      logger.api("❌ Initial fetch failed:", err);
      // Set loading to false even on error so UI isn't stuck
      setLoading(false);
      setError("Failed to load components");
    });
  }, []); // Empty dependency array to run only once on mount

  // Helper function to determine component image with memory optimization
  const getComponentImage = (component: DatabaseComponent): string => {
    // Generate SVG from symbol_data graphics
    try {
      const svgContent = generateSvgFromSymbolData(component.symbol_data);
      if (svgContent) {
        // Use memory-efficient base64 encoding
        const svgBytes = new TextEncoder().encode(svgContent);
        let binaryString = "";
        const chunkSize = 1024;

        // Process in chunks to avoid large string allocations
        for (let i = 0; i < svgBytes.length; i += chunkSize) {
          const chunk = svgBytes.slice(i, i + chunkSize);
          for (let j = 0; j < chunk.length; j++) {
            binaryString += String.fromCharCode(chunk[j]);
          }
        }

        const base64Data = btoa(binaryString);
        return `data:image/svg+xml;base64,${base64Data}`;
      }
    } catch (error) {
      console.warn(
        `Failed to generate SVG for component ${component.name}:`,
        error
      );
    }

    // Fallback to category icon
    return getCategoryIcon(component.library || "unknown");
  };

  // Generate SVG from symbol_data
  const generateSvgFromSymbolData = (symbolData: any): string | null => {
    if (!symbolData || !symbolData.graphics) return null;

    const graphics = symbolData.graphics;
    let svgElements = "";

    // Add rectangles
    if (graphics.rectangles) {
      graphics.rectangles.forEach((rect: any) => {
        const width = Math.abs(rect.end.x - rect.start.x);
        const height = Math.abs(rect.end.y - rect.start.y);
        const x = Math.min(rect.start.x, rect.end.x);
        const y = Math.min(rect.start.y, rect.end.y);
        const fill = rect.fill?.type === "background" ? "#f0f0f0" : "none";
        const stroke = rect.stroke?.type === "default" ? "#000" : "#000";
        const strokeWidth = rect.stroke?.width || 0.254;

        svgElements += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
      });
    }

    // Add circles
    if (graphics.circles) {
      graphics.circles.forEach((circle: any) => {
        const fill = circle.fill?.type === "background" ? "#f0f0f0" : "none";
        const stroke = circle.stroke?.type === "default" ? "#000" : "#000";
        const strokeWidth = circle.stroke?.width || 0.254;

        svgElements += `<circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
      });
    }

    // Add polylines
    if (graphics.polylines) {
      graphics.polylines.forEach((polyline: any) => {
        const points = polyline.points
          .map((p: any) => `${p.x},${p.y}`)
          .join(" ");
        const fill = polyline.fill?.type === "none" ? "none" : "#000";
        const stroke = polyline.stroke?.type === "default" ? "#000" : "#000";
        const strokeWidth = polyline.stroke?.width || 0.254;

        svgElements += `<polyline points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
      });
    }

    if (!svgElements) return null;

    // Calculate viewBox
    const bounds = calculateBounds(
      symbolData.graphics,
      symbolData.pins,
      symbolData.graphics?.text
    );
    const viewBox = `${bounds.minX - 2} ${bounds.minY - 2} ${
      bounds.width + 4
    } ${bounds.height + 4}`;

    return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`;
  };

  const calculateBounds = (
    graphics: any,
    pins?: any[],
    textElements?: any[]
  ) => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    // Check rectangles
    if (graphics.rectangles) {
      graphics.rectangles.forEach((rect: any) => {
        minX = Math.min(minX, rect.start.x, rect.end.x);
        minY = Math.min(minY, rect.start.y, rect.end.y);
        maxX = Math.max(maxX, rect.start.x, rect.end.x);
        maxY = Math.max(maxY, rect.start.y, rect.end.y);
      });
    }

    // Check circles
    if (graphics.circles) {
      graphics.circles.forEach((circle: any) => {
        minX = Math.min(minX, circle.center.x - circle.radius);
        minY = Math.min(minY, circle.center.y - circle.radius);
        maxX = Math.max(maxX, circle.center.x + circle.radius);
        maxY = Math.max(maxY, circle.center.y + circle.radius);
      });
    }

    // Check polylines
    if (graphics.polylines) {
      graphics.polylines.forEach((polyline: any) => {
        polyline.points.forEach((point: any) => {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
        });
      });
    }

    // Check pins - include pin line endpoints based on position and angle
    if (pins && Array.isArray(pins)) {
      pins.forEach((pin: any) => {
        if (!pin.position) return;

        // Skip unused pins from bounds calculation
        if (pin.name === "Unused") return;

        const pos = pin.position;
        const length = pin.length || 2.54;

        // Calculate pin endpoint based on angle
        const endX =
          pos.x +
          (pin.position.angle === 0
            ? length
            : pin.position.angle === 180
            ? -length
            : 0);
        const endY =
          pos.y +
          (pin.position.angle === 90
            ? length
            : pin.position.angle === 270
            ? -length
            : 0);

        minX = Math.min(minX, pos.x, endX);
        minY = Math.min(minY, pos.y, endY);
        maxX = Math.max(maxX, pos.x, endX);
        maxY = Math.max(maxY, pos.y, endY);
      });
    }

    // Check text elements - estimate bounds and account for rotation
    if (textElements && Array.isArray(textElements)) {
      textElements.forEach((textElement: any) => {
        if (textElement.position && textElement.content) {
          // Estimate text bounds (rough approximation)
          const textWidth = textElement.content.length * 1.5; // Rough character width estimate
          const textHeight = 2.5; // Text height estimate

          // Account for rotation by expanding bounds
          const pos = textElement.position;
          const angle = pos.angle || 0;
          const angleRad = (angle * Math.PI) / 180;

          // Calculate corners of text bounding box
          const corners = [
            { x: -textWidth / 2, y: -textHeight / 2 },
            { x: textWidth / 2, y: -textHeight / 2 },
            { x: textWidth / 2, y: textHeight / 2 },
            { x: -textWidth / 2, y: textHeight / 2 },
          ];

          corners.forEach((corner) => {
            // Rotate corner around origin
            const rotatedX =
              corner.x * Math.cos(angleRad) - corner.y * Math.sin(angleRad);
            const rotatedY =
              corner.x * Math.sin(angleRad) + corner.y * Math.cos(angleRad);

            // Translate to text position
            const worldX = pos.x + rotatedX;
            const worldY = pos.y + rotatedY;

            minX = Math.min(minX, worldX);
            minY = Math.min(minY, worldY);
            maxX = Math.max(maxX, worldX);
            maxY = Math.max(maxY, worldY);
          });
        }
      });
    }

    return {
      minX: minX === Infinity ? -10 : minX,
      minY: minY === Infinity ? -10 : minY,
      maxX: maxX === -Infinity ? 10 : maxX,
      maxY: maxY === -Infinity ? 10 : maxY,
      width:
        (maxX === -Infinity ? 10 : maxX) - (minX === Infinity ? -10 : minX),
      height:
        (maxY === -Infinity ? 10 : maxY) - (minY === Infinity ? -10 : minY),
    };
  };

  // Memory-efficient category icon generator
  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      resistor: "R",
      capacitor: "C",
      led: "LED",
      diode: "D",
      transistor: "Q",
      inductor: "L",
      battery: "BAT",
      switch: "SW",
      connector: "CONN",
      pushbutton: "BTN",
      crystal: "XTAL",
      opamp: "OP",
      sensor: "SEN",
      motor: "MOT",
      voltage_regulator: "REG",
      arduino: "ARD",
      buzzer: "BUZ",
      "display-lcd": "LCD",
      fuse: "FUSE",
      microcontroller: "MCU",
      "photo-resistor": "LDR",
      potentiometer: "POT",
      relay: "RLY",
      "servo-motor": "SERVO",
      "temperature-sensor": "TEMP",
    };

    const icon = icons[category] || category.charAt(0).toUpperCase();
    return `data:image/svg+xml;base64,${btoa(
      `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#e8e8e8"/><text x="50" y="55" text-anchor="middle" font-size="16" fill="#666" font-family="monospace">${icon}</text></svg>`
    )}`;
  };

  const searchComponents = useCallback(
    (query: string): ComponentDisplayData[] => {
      const normalizedQuery = query.trim().toLowerCase();

      if (!normalizedQuery) {
        return components;
      }

      const cachedEntry = searchCacheRef.current.get(normalizedQuery);
      if (
        cachedEntry &&
        cachedEntry.generation === cacheGenerationRef.current
      ) {
        logger.component("Component search cache hit", {
          query: normalizedQuery,
          resultCount: cachedEntry.results.length,
          generation: cacheGenerationRef.current,
        });
        return cachedEntry.results;
      }

      logger.component("Component search cache miss", {
        query: normalizedQuery,
        componentCount: components.length,
        generation: cacheGenerationRef.current,
      });

      const results = components.filter((component) => {
        const nameMatch = component.name
          .toLowerCase()
          .includes(normalizedQuery);
        const libraryMatch = component.library
          .toLowerCase()
          .includes(normalizedQuery);
        const descriptionMatch =
          component.description?.toLowerCase().includes(normalizedQuery) ??
          false;
        const keywordsMatch =
          component.keywords?.toLowerCase().includes(normalizedQuery) ?? false;

        return nameMatch || libraryMatch || descriptionMatch || keywordsMatch;
      });

      // Debug: Show what components we're searching through
      if (normalizedQuery.includes("74au")) {
        const sample74Components = components
          .filter(
            (c) =>
              c.name.toLowerCase().includes("74") ||
              c.library?.toLowerCase().includes("74")
          )
          .slice(0, 5)
          .map((c) => ({ name: c.name, library: c.library }));

        logger.component("Debug 74au search", {
          query: normalizedQuery,
          total74Components: sample74Components.length,
          sample74Components,
          totalLoadedComponents: components.length,
        });
      }

      logger.component("Search completed", {
        query: normalizedQuery,
        resultCount: results.length,
        totalComponents: components.length,
        sampleResults: results
          .slice(0, 3)
          .map((r) => ({ name: r.name, library: r.library })),
      });

      searchCacheRef.current.set(normalizedQuery, {
        generation: cacheGenerationRef.current,
        results,
      });
      return results;
    },
    [components]
  );

  const getComponentsByCategory = (
    category: string
  ): ComponentDisplayData[] => {
    if (!category) return components;
    return components.filter(
      (component) => component.library.toLowerCase() === category.toLowerCase()
    );
  };

  const getCategories = (): string[] => {
    const categories = [...new Set(components.map((comp) => comp.library))];
    return categories.sort();
  };

  return {
    components,
    loading,
    isLoadingMore,
    error,
    hasMore,
    searchComponents,
    getComponentsByCategory,
    getCategories,
    refetch: fetchComponents,
    loadMore: loadMoreComponents,
    cleanupMemory,
    // Memory usage info
    memoryInfo: {
      componentCount: components.length,
      estimatedMemoryUsage: components.reduce((total, comp) => {
        return (
          total +
          (comp.name?.length || 0) +
          (comp.description?.length || 0) +
          (comp.keywords?.length || 0) +
          JSON.stringify(comp).length +
          1000
        ); // Rough estimate
      }, 0),
    },
  };
}
