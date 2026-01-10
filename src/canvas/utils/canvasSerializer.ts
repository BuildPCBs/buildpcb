import Konva from "konva";
import { Circuit, ConnectionModel } from "@/lib/schemas/circuit";
import { canvasCommandManager } from "../canvas-command-manager";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

/**
 * Serialize Konva Stage to Circuit format
 */
export function serializeCanvasToCircuit(
  stage: Konva.Stage | null
): Partial<Circuit> | null {
  if (!stage) return null;

  try {
    const components: any[] = [];
    const connections: any[] = [];

    // 1. Serialize Components (find nodes with name 'component')
    const componentNodes = stage.find(".component");

    componentNodes.forEach((node) => {
      const attrs = node.attrs;
      // Check if it has essential data
      if (!attrs.id) return;

      // CRITICAL FIX: Store the FULL component data including symbol_data
      // The node renders a component, but the full data might be stored elsewhere
      // We need to preserve symbol_data, pins, graphics, everything
      components.push({
        id: attrs.id,
        databaseId: attrs.uid || attrs.dbId,
        name: attrs.name || attrs.componentName || "Unknown",
        type: attrs.componentType || attrs.type || "generic",
        value: attrs.value || "",
        explanation: attrs.explanation || "User added component",
        position: {
          x: node.x(),
          y: node.y(),
        },
        rotation: node.rotation(),
        // PRESERVE ALL PROPERTIES including symbol_data
        ...attrs,
        // Ensure critical rendering data is preserved
        symbol_data: attrs.symbol_data,
        pinConfiguration: attrs.pinConfiguration,
      });
    });

    // 2. Serialize Wires (find Lines with connectionData)
    // We look for all lines, check if they have connectionData
    const lines = stage.find("Line");
    lines.forEach((line) => {
      const connData = line.getAttr("connectionData");
      if (connData) {
        connections.push({
          id: line.id() || `wire_${Date.now()}_${Math.random()}`,
          from: {
            componentId: connData.fromComponentId,
            pin: connData.fromPinNumber,
          },
          to: {
            componentId: connData.toComponentId,
            pin: connData.toPinNumber,
          },
          type: "wire",
          properties: {
            netId: connData.netId,
            points: (line as Konva.Line).points(),
          },
        });
      }
    });

    // Cast to any to include layout and other non-Circuit fields
    return {
      mode: "full",
      components,
      connections,
      layout: {
        layers: [],
        dimensions: {
          width: stage.width(),
          height: stage.height(),
        },
        grid: { size: 10, visible: true },
        zoom: stage.scaleX(),
        viewBox: {
          x: stage.x(),
          y: stage.y(),
          width: stage.width(),
          height: stage.height(),
        },
      },
    } as any;
  } catch (error) {
    logger.error("Failed to serialize Konva stage:", error);
    return null;
  }
}

/**
 * Serialize Konva Stage to raw canvas data format
 */
export function serializeCanvasData(
  stage: Konva.Stage | null,
  netlist?: any[] | (() => any[])
): Record<string, any> {
  if (!stage) return {};

  try {
    const canvasData = stage.toJSON();

    return {
      konvaData: canvasData,
      netlist: typeof netlist === "function" ? netlist() : netlist,
    };
  } catch (error) {
    console.error("❌ Failed to serialize canvas data:", error);
    return {};
  }
}

import { refDesService } from "@/lib/refdes-service";

/**
 * Load canvas from circuit data
 */
export async function loadCanvasFromCircuit(
  stage: Konva.Stage,
  circuit: Partial<Circuit>,
  netlistData?: any[], // retained for compatibility but unused
  refDesAssignments?: any[]
): Promise<void> {
  if (refDesAssignments && Array.isArray(refDesAssignments)) {
    refDesService.loadAssignments(refDesAssignments);
    logger.canvas(`Restored ${refDesAssignments.length} RefDes assignments`);
  }

  if (!circuit.components) {
    logger.warn("No components to load in circuit");
    return;
  }

  // Clear stage
  const layers = stage.getLayers();
  layers.forEach((l) => l.destroyChildren());
  stage.batchDraw();

  logger.canvas(
    `Loading ${circuit.components.length} components to Konva stage...`
  );

  // Load components
  for (const comp of circuit.components as any[]) {
    try {
      // Need to fetch full component data if essential parts are missing?
      // Or assume circuit.components has enough.
      // ComponentFactory needs 'svgPath', 'type', 'name' etc.
      // If the circuit only has 'databaseId', we might need to fetch.

      let fullCompData = comp;
      // Support both databaseId and uid
      const dbId = comp.databaseId || comp.uid;

      if (dbId) {
        const { data, error } = await supabase
          .from("components_v2")
          .select("*")
          .eq("uid", dbId)
          .single();
        if (data) {
          fullCompData = { ...fullCompData, ...data };
        }
      }

      await canvasCommandManager.executeCommand("component:add", {
        id: comp.id,
        uid: dbId, // pass uid
        type: fullCompData.type || fullCompData.component_type || "generic",
        svgPath: fullCompData.symbol_svg || fullCompData.properties?.svgPath,
        name: fullCompData.name || fullCompData.properties?.name,
        x: comp.position?.x || 0,
        y: comp.position?.y || 0,
        rotation: comp.rotation || 0,
        pins:
          fullCompData.pinConfiguration?.pins || fullCompData.properties?.pins,
        componentMetadata: fullCompData,
      });
    } catch (err) {
      logger.error(`Failed to load component ${comp.id}`, err);
    }
  }

  // Load connections
  if (circuit.connections) {
    logger.canvas(`Loading ${circuit.connections.length} connections...`);
    for (const conn of circuit.connections) {
      try {
        // @ts-ignore
        const points = conn.properties?.points;
        await canvasCommandManager.executeCommand("wire:add", {
          fromComponentId: conn.from.componentId,
          fromPinNumber: conn.from.pin,
          toComponentId: conn.to.componentId,
          toPinNumber: conn.to.pin,
          points: points, // optional custom path
        });
      } catch (err) {
        logger.error(`Failed to load connection ${(conn as any).id}`, err);
      }
    }
  }

  stage.batchDraw();
  logger.canvas("Canvas loaded from circuit.");
}

/**
 * Create a thumbnail image of the canvas
 */
export function generateCanvasThumbnail(
  stage: Konva.Stage | null,
  width = 200,
  height = 150
): string | null {
  if (!stage) return null;

  try {
    return stage.toDataURL({
      mimeType: "image/jpeg",
      quality: 0.8,
      pixelRatio: Math.min(width / stage.width(), height / stage.height()),
    });
  } catch (error) {
    console.error("Failed to generate thumbnail:", error);
    return null;
  }
}
