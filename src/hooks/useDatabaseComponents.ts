import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

export interface DatabaseComponent {
  idx?: number; // Keep for backward compatibility
  uid: string; // New primary identifier
  name: string;
  package_id: string;
  unit_id: string;
  symbol_svg: string;
  symbol_data: string; // JSON string containing pin data
  kicad_sym_raw: string;
  created_at: string;
  updated_at: string;
  is_graphical_symbol: boolean;
}

export interface ComponentDisplayData {
  id: string;
  name: string;
  package_id: string;
  category: string;
  image: string;
  type: string;
  description?: string;
  manufacturer?: string;
  partNumber?: string;
  pinCount?: number;
  symbol_svg?: string; // Add raw SVG for fallback rendering
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
          table: "components_v2",
          range: [currentOffset, currentOffset + PAGE_SIZE - 1],
          orderBy: "name",
        });

        const { data, error: fetchError } = await supabase
          .from("components_v2")
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
                idx: comp.idx,
                name: comp.name,
                package_id: comp.package_id,
                hasSvg: !!comp.symbol_svg,
                svgLength: comp.symbol_svg?.length || 0,
              });

              // Parse symbol_data to get pin information
              let pinCount = 0;
              let pins: any[] = [];
              try {
                if (comp.symbol_data) {
                  let symbolData;
                  if (typeof comp.symbol_data === "string") {
                    symbolData = JSON.parse(comp.symbol_data);
                  } else {
                    // symbol_data is already an object
                    symbolData = comp.symbol_data;
                  }
                  pins = symbolData.pins || [];
                  pinCount = pins.length;
                }
              } catch (error) {
                logger.api(
                  "Failed to parse symbol_data for component:",
                  comp.name,
                  error
                );
              }

              return {
                id:
                  comp.uid ||
                  comp.idx?.toString() ||
                  `temp_${Date.now()}_${tempIdCounter.current++}`, // Use uid as primary, fallback to idx, then temp
                name: comp.name,
                package_id: comp.package_id,
                category: comp.package_id || "unknown", // Use package_id as category
                image: getComponentImage(comp),
                type: comp.package_id || "component", // Use package_id as type
                description: `Package: ${comp.package_id}`, // Generate description from package_id
                manufacturer: "Unknown", // Default value
                partNumber: comp.name, // Use name as part number
                pinCount: pinCount,
                symbol_svg: comp.symbol_svg, // Include raw SVG for fallback
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
    // Use actual SVG from database if available
    if (component.symbol_svg) {
      // Memory optimization: Use a lightweight placeholder for large SVGs
      // Only convert to data URL when actually needed for display
      if (component.symbol_svg.length > 10000) {
        // For very large SVGs, use a placeholder and lazy load
        return `data:image/svg+xml;base64,${btoa(
          '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#e8e8e8"/><text x="50" y="55" text-anchor="middle" font-size="16" fill="#666">SVG</text></svg>'
        )}`;
      }

      // For smaller SVGs, still use memory-efficient encoding
      try {
        // Remove fixed width/height and ensure viewBox for proper scaling
        let processedSvg = component.symbol_svg;
        
        // Remove width and height attributes to allow CSS scaling
        processedSvg = processedSvg.replace(/\s*width\s*=\s*["'][^"']*["']/gi, '');
        processedSvg = processedSvg.replace(/\s*height\s*=\s*["'][^"']*["']/gi, '');
        
        // If there's no viewBox, try to add one based on removed dimensions
        if (!processedSvg.includes('viewBox')) {
          // Try to extract original dimensions to create viewBox
          const widthMatch = component.symbol_svg.match(/width\s*=\s*["']([^"']*)["']/i);
          const heightMatch = component.symbol_svg.match(/height\s*=\s*["']([^"']*)["']/i);
          
          if (widthMatch && heightMatch) {
            const width = parseFloat(widthMatch[1]);
            const height = parseFloat(heightMatch[1]);
            if (!isNaN(width) && !isNaN(height)) {
              processedSvg = processedSvg.replace(
                /<svg/,
                `<svg viewBox="0 0 ${width} ${height}"`
              );
            }
          }
        }
        
        // Use more memory-efficient base64 encoding
        const svgBytes = new TextEncoder().encode(processedSvg);
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
      } catch (error) {
        console.warn(
          `Failed to encode SVG for component ${component.name}:`,
          error
        );
        // Fallback to category icon
        return getCategoryIcon(component.package_id || "unknown");
      }
    }

    // Fallback to category icon
    return getCategoryIcon(component.package_id || "unknown");
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
        const packageIdMatch =
          component.package_id?.toLowerCase().includes(normalizedQuery) ??
          false;
        const categoryMatch = component.category
          .toLowerCase()
          .includes(normalizedQuery);
        const descriptionMatch =
          component.description?.toLowerCase().includes(normalizedQuery) ??
          false;
        const manufacturerMatch =
          component.manufacturer?.toLowerCase().includes(normalizedQuery) ??
          false;
        const partNumberMatch =
          component.partNumber?.toLowerCase().includes(normalizedQuery) ??
          false;
        const typeMatch = component.type
          .toLowerCase()
          .includes(normalizedQuery);

        return (
          nameMatch ||
          packageIdMatch ||
          categoryMatch ||
          descriptionMatch ||
          manufacturerMatch ||
          partNumberMatch ||
          typeMatch
        );
      });

      // Debug: Show what components we're searching through
      if (normalizedQuery.includes("74au")) {
        const sample74Components = components
          .filter(
            (c) =>
              c.name.toLowerCase().includes("74") ||
              c.package_id?.toLowerCase().includes("74")
          )
          .slice(0, 5)
          .map((c) => ({ name: c.name, package_id: c.package_id }));

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
          .map((r) => ({ name: r.name, package_id: r.package_id })),
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
      (component) => component.category.toLowerCase() === category.toLowerCase()
    );
  };

  const getCategories = (): string[] => {
    const categories = [...new Set(components.map((comp) => comp.category))];
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
          (comp.symbol_svg?.length || 0) +
          (comp.image?.length || 0) +
          1000
        ); // Rough estimate
      }, 0),
    },
  };
}
