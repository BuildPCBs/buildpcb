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
    const bounds = calculateBounds(symbolData.graphics);
    const viewBox = `${bounds.minX - 2} ${bounds.minY - 2} ${
      bounds.width + 4
    } ${bounds.height + 4}`;

    return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">${svgElements}</svg>`;
  };

  // Calculate bounds of graphics elements
  const calculateBounds = (graphics: any) => {
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

    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  };

  const getComponentImage = (component: DatabaseComponent): string => {
    // Generate SVG from symbol_data if available
    if (component.symbol_data) {
      const svgContent = generateSvgFromSymbolData(component.symbol_data);
      if (svgContent) {
        try {
          return `data:image/svg+xml;base64,${btoa(svgContent)}`;
        } catch (error) {
          logger.component(
            "Failed to encode SVG for component",
            component.name
          );
        }
      }
    }

    // Fallback placeholder
    const icon = component.library?.charAt(0) || "C";
    return `data:image/svg+xml;base64,${btoa(
      `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#e8e8e8"/><text x="50" y="55" text-anchor="middle" font-size="16" fill="#666" font-family="monospace">${icon}</text></svg>`
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
          .from("components")
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
          (comp: any) => {
            const pinCount = comp.symbol_data?.pins?.length || 0;

            return {
              id: comp.id,
              name: comp.name,
              library: comp.library,
              description: comp.description,
              pin_count: comp.pin_count || pinCount,
              keywords: comp.keywords,
              datasheet: comp.datasheet,
              image: getComponentImage(comp),
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
