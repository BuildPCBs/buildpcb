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
        if (!loadMore) {
          setLoading(true);
          setOffset(0);
        }
        setError(null);

        const currentOffset = loadMore ? offset : 0;
        const { data, error: fetchError } = await supabase
          .from("components")
          .select("*")
          .order("name")
          .range(currentOffset, currentOffset + PAGE_SIZE - 1);

        if (fetchError) {
          throw fetchError;
        }

        if (data) {
          // Check if we have more data
          setHasMore(data.length === PAGE_SIZE);

          // Transform database components to display format
          const displayComponents: ComponentDisplayData[] = data.map(
            (comp: DatabaseComponent) => ({
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
            })
          );

          if (loadMore) {
            setComponents((prev) => [...prev, ...displayComponents]);
            setOffset((prev) => prev + PAGE_SIZE);
          } else {
            setComponents(displayComponents);
            setOffset(PAGE_SIZE);
          }
        }
      } catch (err) {
        console.error("Error fetching components:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch components"
        );
      } finally {
        setLoading(false);
      }
    },
    [offset]
  );

  const loadMoreComponents = useCallback(() => {
    if (hasMore && !loading) {
      fetchComponents(true);
    }
  }, [hasMore, loading, fetchComponents]);

  useEffect(() => {
    fetchComponents();
  }, []); // Remove fetchComponents from dependencies since it doesn't depend on changing values

  // Helper function to determine component image
  const getComponentImage = (component: DatabaseComponent): string => {
    // Use actual SVG from database if available
    if (component.symbol_svg) {
      // Convert SVG string to data URL with proper Unicode handling
      try {
        // Try URL encoding first (more compatible with SVG)
        const urlEncodedSvg = encodeURIComponent(component.symbol_svg);
        const svgDataUrl = `data:image/svg+xml;charset=utf-8,${urlEncodedSvg}`;
        return svgDataUrl;
      } catch (error) {
        console.warn(
          `Failed to URL encode SVG for component ${component.name}:`,
          error
        );
        // Fall back to base64 encoding
        try {
          // More memory-efficient Unicode-safe base64 encoding
          const encoder = new TextEncoder();
          const utf8Bytes = encoder.encode(component.symbol_svg);

          // Use Uint8Array to avoid creating intermediate arrays
          let binaryString = "";
          for (let i = 0; i < utf8Bytes.length; i++) {
            binaryString += String.fromCharCode(utf8Bytes[i]);
          }

          const svgDataUrl = `data:image/svg+xml;base64,${btoa(binaryString)}`;
          return svgDataUrl;
        } catch (base64Error) {
          console.warn(
            `Failed to base64 encode SVG for component ${component.name}:`,
            base64Error
          );
          // Fall back to category icon if encoding fails
        }
      }
    }

    // Fallback to category-based icons if no SVG available or encoding failed
    const categoryIcons: Record<string, string> = {
      Resistor: "/components/resistor.svg",
      Capacitor: "/components/capacitor.svg",
      Diode: "/components/diode.svg",
      Transistor: "/components/transistor.svg",
      IC: "/components/ic.svg",
      Connector: "/components/connector.svg",
      Switch: "/components/switch.svg",
      LED: "/components/led.svg",
      Inductor: "/components/inductor.svg",
      Sensor: "/components/sensor.svg",
      Power: "/components/power.svg",
      MCU: "/components/mcu.svg",
      OpAmp: "/components/opamp.svg",
    };

    return categoryIcons[component.category] || "/components/component.svg";
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
  };
}
