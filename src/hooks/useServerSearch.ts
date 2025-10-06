import { useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import {
  ComponentDisplayData,
  DatabaseComponent,
} from "./useDatabaseComponents";

/**
 * Server-side component search hook
 * Searches directly in Supabase instead of loading all components locally
 */
export function useServerSearch() {
  const searchCacheRef = useRef<Map<string, ComponentDisplayData[]>>(new Map());

  const getComponentImage = (component: DatabaseComponent): string => {
    if (component.symbol_svg) {
      try {
        return `data:image/svg+xml;base64,${btoa(component.symbol_svg)}`;
      } catch (error) {
        logger.component("Failed to encode SVG for component", component.name);
      }
    }

    // Fallback placeholder
    const icon = component.package_id?.charAt(0) || "C";
    return `data:image/svg+xml;base64,${btoa(
      `<svg width="60" height="30" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="30" fill="#e8e8e8"/><text x="30" y="20" text-anchor="middle" font-size="12" fill="#666" font-family="monospace">${icon}</text></svg>`
    )}`;
  };

  const searchComponents = useCallback(
    async (query: string): Promise<ComponentDisplayData[]> => {
      const normalizedQuery = query.trim().toLowerCase();

      if (!normalizedQuery) {
        return []; // Return empty for server search - use regular load for browsing
      }

      // Check cache first
      const cached = searchCacheRef.current.get(normalizedQuery);
      if (cached) {
        logger.component("🔍 Server search cache hit", {
          query: normalizedQuery,
          resultCount: cached.length,
        });
        return cached;
      }

      logger.component("🔍 Server search starting", {
        query: normalizedQuery,
      });

      try {
        logger.component("🔍 Making Supabase query", {
          query: normalizedQuery,
          table: "components_v2",
        });

        // Server-side search with Supabase - searches all 18k components instantly!
        const searchPattern = `%${normalizedQuery}%`;
        
        logger.component("🔍 Executing Supabase query", {
          pattern: searchPattern,
        });

        // Test with simple ilike first to see if .or() is the issue
        const { data, error } = await supabase
          .from("components_v2")
          .select("*")
          .ilike("name", searchPattern)
          .order("name")
          .limit(200);
        
        logger.component("🔍 Query returned from Supabase", {
          dataCount: data?.length,
          errorExists: !!error,
        });

        logger.component("🔍 Supabase query completed", {
          query: normalizedQuery,
          searchPattern,
          dataLength: data?.length || 0,
          hasError: !!error,
          errorMessage: error?.message,
        });

        if (error) {
          logger.component("❌ Server search error:", {
            error: error.message || error,
            code: error.code,
            details: error.details,
          });
          return [];
        }

        logger.component("✅ Server search completed", {
          query: normalizedQuery,
          resultCount: data?.length || 0,
        });

        // Transform results to ComponentDisplayData format
        const results: ComponentDisplayData[] = (data || []).map(
          (comp: DatabaseComponent) => {
            let pinCount = 0;
            try {
              if (comp.symbol_data) {
                const symbolData =
                  typeof comp.symbol_data === "string"
                    ? JSON.parse(comp.symbol_data)
                    : comp.symbol_data;
                pinCount = symbolData.pins?.length || 0;
              }
            } catch (error) {
              logger.component(
                "Failed to parse symbol_data for search result:",
                comp.name
              );
            }

            return {
              id: comp.uid || `search_${Date.now()}_${Math.random()}`,
              name: comp.name,
              package_id: comp.package_id,
              category: comp.package_id || "unknown",
              image: getComponentImage(comp),
              type: comp.package_id || "component",
              description: `Package: ${comp.package_id}`,
              manufacturer: "Unknown",
              partNumber: comp.name,
              pinCount: pinCount,
              symbol_svg: comp.symbol_svg,
            };
          }
        );

        // Cache the results
        searchCacheRef.current.set(normalizedQuery, results);

        return results;
      } catch (err) {
        logger.component("❌ Server search failed:", err);
        return [];
      }
    },
    []
  );

  const clearCache = useCallback(() => {
    searchCacheRef.current.clear();
    logger.component("🔍 Server search cache cleared");
  }, []);

  return {
    searchComponents,
    clearCache,
  };
}
