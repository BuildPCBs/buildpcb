import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface DatabaseComponent {
  id: string;
  name: string;
  type: string;
  category: string;
  description?: string;
  pin_configuration: any;
  kicad_sym_raw: any;
  kicad_library_source?: string;
  symbol_svg?: string;
  manufacturer?: string;
  part_number?: string;
  keywords?: string[];
  datasheet_url?: string;
}

export interface ComponentDisplayData {
  id: string;
  name: string;
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
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const PAGE_SIZE = 100; // Reduced from 1000 to 100 for better memory management

  const fetchComponents = useCallback(
    async (loadMore = false) => {
      try {
        console.log("🔍 Fetching components from database...", {
          loadMore,
          offset,
          PAGE_SIZE,
        });

        if (!loadMore) {
          setLoading(true);
          setOffset(0);
        }
        setError(null);

        const currentOffset = loadMore ? offset : 0;
        console.log("📡 Making Supabase query:", {
          table: "components",
          range: [currentOffset, currentOffset + PAGE_SIZE - 1],
          orderBy: "name",
        });

        const { data, error: fetchError } = await supabase
          .from("components")
          .select("*")
          .order("name")
          .range(currentOffset, currentOffset + PAGE_SIZE - 1);

        console.log("📊 Supabase response:", {
          dataLength: data?.length || 0,
          error: fetchError,
          hasMore: data ? data.length === PAGE_SIZE : false,
        });

        if (fetchError) {
          console.error("❌ Supabase fetch error:", fetchError);
          throw fetchError;
        }

        if (data) {
          console.log("✅ Processing", data.length, "components from database");

          // Check if we have more data
          setHasMore(data.length === PAGE_SIZE);

          // Transform database components to display format
          const displayComponents: ComponentDisplayData[] = data.map(
            (comp: DatabaseComponent) => {
              console.log("🔄 Processing component:", {
                id: comp.id,
                name: comp.name,
                category: comp.category,
                hasSvg: !!comp.symbol_svg,
                svgLength: comp.symbol_svg?.length || 0,
              });

              return {
                id: comp.id,
                name: comp.name,
                category: comp.category,
                image: getComponentImage(comp),
                type: comp.type,
                description: comp.description,
                manufacturer: comp.manufacturer,
                partNumber: comp.part_number,
                pinCount:
                  comp.pin_configuration?.total_pins ||
                  comp.pin_configuration?.pins?.length ||
                  0,
                symbol_svg: comp.symbol_svg, // Include raw SVG for fallback
              };
            }
          );

          console.log(
            "🎯 Setting",
            displayComponents.length,
            "display components"
          );

          if (loadMore) {
            setComponents((prev) => {
              const newComponents = [...prev, ...displayComponents];
              console.log(
                "📦 Total components after load more:",
                newComponents.length
              );
              return newComponents;
            });
            setOffset((prev) => prev + PAGE_SIZE);
          } else {
            setComponents(displayComponents);
            setOffset(PAGE_SIZE);
            console.log("📦 Set initial components:", displayComponents.length);
          }
        } else {
          console.warn("⚠️ No data returned from Supabase");
        }
      } catch (err) {
        console.error("❌ Error fetching components:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch components"
        );
      } finally {
        setLoading(false);
        console.log("🏁 Component fetch completed");
      }
    },
    [offset]
  );

  const loadMoreComponents = useCallback(() => {
    if (hasMore && !loading) {
      fetchComponents(true);
    }
  }, [hasMore, loading, fetchComponents]);

  // Memory cleanup function
  const cleanupMemory = useCallback(() => {
    console.log("🧹 Cleaning up component memory...");
    setComponents([]);
    setOffset(0);
    setHasMore(true);
    setError(null);
  }, []);

  // Auto-cleanup when component unmounts or when memory usage gets high
  useEffect(() => {
    const handleMemoryPressure = () => {
      console.log("⚠️ Memory pressure detected, cleaning up components...");
      cleanupMemory();
    };

    // Listen for memory pressure events (if supported)
    if ("memory" in performance) {
      const memoryInfo = (performance as any).memory;
      if (memoryInfo.usedJSHeapSize > memoryInfo.totalJSHeapSize * 0.8) {
        console.log("⚠️ High memory usage detected, triggering cleanup...");
        cleanupMemory();
      }
    }

    return () => {
      // Cleanup on unmount
      cleanupMemory();
    };
  }, [cleanupMemory]);

  // Initial component fetch
  useEffect(() => {
    console.log("🚀 Initial component fetch triggered");
    fetchComponents(false);
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
          '<svg width="60" height="30" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="30" fill="#e8e8e8"/><text x="30" y="18" text-anchor="middle" font-size="10" fill="#666">SVG</text></svg>'
        )}`;
      }

      // For smaller SVGs, still use memory-efficient encoding
      try {
        // Use more memory-efficient base64 encoding
        const svgBytes = new TextEncoder().encode(component.symbol_svg);
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
        return getCategoryIcon(component.category);
      }
    }

    // Fallback to category icon
    return getCategoryIcon(component.category);
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
      `<svg width="60" height="30" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="30" fill="#e8e8e8"/><text x="30" y="20" text-anchor="middle" font-size="12" fill="#666" font-family="monospace">${icon}</text></svg>`
    )}`;
  };

  const searchComponents = (query: string): ComponentDisplayData[] => {
    if (!query.trim()) return components;

    const searchTerm = query.toLowerCase();
    return components.filter(
      (component) =>
        component.name.toLowerCase().includes(searchTerm) ||
        component.category.toLowerCase().includes(searchTerm) ||
        component.description?.toLowerCase().includes(searchTerm) ||
        component.manufacturer?.toLowerCase().includes(searchTerm) ||
        component.partNumber?.toLowerCase().includes(searchTerm) ||
        component.type.toLowerCase().includes(searchTerm)
    );
  };

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
