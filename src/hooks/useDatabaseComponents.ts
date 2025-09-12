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
}

export function useDatabaseComponents() {
  const [components, setComponents] = useState<ComponentDisplayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComponents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("components")
        .select("*")
        .order("name")
        .limit(1000); // Limit for performance, can be increased or paginated later

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
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
          })
        );

        setComponents(displayComponents);
      }
    } catch (err) {
      console.error("Error fetching components:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch components"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComponents();
  }, []); // Remove fetchComponents from dependencies since it doesn't depend on changing values

  // Helper function to determine component image
  const getComponentImage = (component: DatabaseComponent): string => {
    // If we have a symbol_svg, we could use it, but for now use category-based icons
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
    searchComponents,
    getComponentsByCategory,
    getCategories,
    refetch: fetchComponents,
  };
}
