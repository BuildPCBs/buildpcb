/**
 * Elastic Wire Usage Example for BuildPCBs
 *
 * This file demonstrates how to use the elastic wire system
 * in your PCB schematic editor.
 */

import React, { useRef } from "react";
import * as fabric from "fabric";
import { useElasticWire } from "@/canvas/hooks/useElasticWire";
import {
  ElasticWire,
  DEFAULT_ELASTIC_CONFIG,
} from "@/canvas/hooks/ElasticWire";

interface ElasticWireCanvasProps {
  width?: number;
  height?: number;
}

export function ElasticWireCanvas({
  width = 800,
  height = 600,
}: ElasticWireCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

  // Initialize elastic wire system
  const elasticWire = useElasticWire({
    canvas: fabricCanvasRef.current,
    enabled: true,
    config: {
      ...DEFAULT_ELASTIC_CONFIG,
      strokeColor: "#0066CC",
      tensionThreshold: 100,
    },
    onNetlistChange: (nets) => {
      console.log("Netlist updated:", nets);
      // Save to database here
      saveNetlistToDatabase(nets);
    },
  });

  // Initialize canvas
  React.useEffect(() => {
    if (canvasRef.current && !fabricCanvasRef.current) {
      fabricCanvasRef.current = new fabric.Canvas(canvasRef.current, {
        width,
        height,
        backgroundColor: "#f5f5f5",
      });

      // Update elastic wire with canvas reference
      // Note: In a real implementation, you'd need to handle this properly
      // with the hook's internal canvas reference
    }

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [width, height]);

  // Handle canvas clicks for elastic wire
  const handleCanvasClick = (event: React.MouseEvent) => {
    if (!fabricCanvasRef.current) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const pointer = new fabric.Point(
      event.clientX - rect.left,
      event.clientY - rect.top
    );

    // Find pin at click location
    const objects = fabricCanvasRef.current.getObjects();
    const clickedPin = objects.find((obj) => {
      if ((obj as any).data?.type === "pin") {
        const distance = Math.sqrt(
          Math.pow(obj.left! - pointer.x, 2) + Math.pow(obj.top! - pointer.y, 2)
        );
        return distance <= 6; // 6px detection radius
      }
      return false;
    });

    if (clickedPin) {
      if (!elasticWire.isDrawing) {
        // Start elastic wire
        const startPoint = new fabric.Point(clickedPin.left!, clickedPin.top!);
        elasticWire.startElasticWire(startPoint, clickedPin as fabric.Object);
      } else {
        // Finish elastic wire
        elasticWire.finishElasticWire(clickedPin as fabric.Object);
      }
    }
  };

  // Handle mouse move for elastic wire preview
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!elasticWire.isDrawing || !fabricCanvasRef.current) return;

    const rect = canvasRef.current!.getBoundingClientRect();
    const pointer = new fabric.Point(
      event.clientX - rect.left,
      event.clientY - rect.top
    );

    // Find target pin for snapping
    const objects = fabricCanvasRef.current.getObjects();
    const targetPin = objects.find((obj) => {
      if ((obj as any).data?.type === "pin") {
        const distance = Math.sqrt(
          Math.pow(obj.left! - pointer.x, 2) + Math.pow(obj.top! - pointer.y, 2)
        );
        return distance <= 6;
      }
      return false;
    });

    elasticWire.updateElasticWire(pointer, targetPin as fabric.Object);
  };

  return (
    <div className="elastic-wire-canvas">
      <div className="toolbar">
        <button
          onClick={elasticWire.toggleElasticMode}
          className={elasticWire.isElasticMode ? "active" : ""}
        >
          {elasticWire.isElasticMode
            ? "Exit Elastic Mode"
            : "Enter Elastic Mode"}
        </button>
        <button onClick={elasticWire.clearAllElasticWires}>
          Clear All Wires
        </button>
        <span>
          Status: {elasticWire.isDrawing ? "Drawing" : "Ready"} | Nets:{" "}
          {elasticWire.nets.length}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        style={{
          border: "1px solid #ccc",
          cursor: elasticWire.isElasticMode ? "crosshair" : "default",
        }}
      />

      <div className="instructions">
        <h3>Elastic Wire Instructions:</h3>
        <ul>
          <li>Click &quot;Enter Elastic Mode&quot; to start</li>
          <li>Click on a component pin to start drawing</li>
          <li>Move mouse to see elastic wire preview</li>
          <li>Click on another pin to finish the wire</li>
          <li>Press ESC to cancel current wire</li>
          <li>Wires automatically create/manage electrical nets</li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Database integration functions
 */
function saveNetlistToDatabase(nets: any[]) {
  // Example implementation
  console.log("Saving netlist to database:", nets);

  // In a real implementation, you would:
  // 1. Serialize the nets data
  // 2. Send to your backend API
  // 3. Store in database with proper relationships

  const serializedData = {
    schematicId: "current-schematic-id",
    nets: nets,
    timestamp: new Date().toISOString(),
  };

  // Example API call
  // fetch('/api/schematics/netlist', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(serializedData),
  // });
}

function loadNetlistFromDatabase(schematicId: string): Promise<any[]> {
  // Example implementation
  console.log("Loading netlist from database for schematic:", schematicId);

  // In a real implementation, you would:
  // 1. Fetch from your backend API
  // 2. Deserialize the data
  // 3. Return the nets array

  return new Promise((resolve) => {
    // Example API call
    // fetch(`/api/schematics/${schematicId}/netlist`)
    //   .then(response => response.json())
    //   .then(data => resolve(data.nets))
    //   .catch(error => {
    //     console.error("Failed to load netlist:", error);
    //     resolve([]);
    //   });

    // Mock data for demonstration
    resolve([]);
  });
}

/**
 * Advanced Usage Example with Custom Configuration
 */
export function AdvancedElasticWireCanvas() {
  const elasticWire = useElasticWire({
    canvas: null, // Will be set when canvas initializes
    config: {
      strokeColor: "#FF6B35",
      baseStrokeWidth: 2,
      maxStrokeWidth: 5,
      animationDuration: 150,
      tensionThreshold: 80,
      damping: 0.9,
      springConstant: 0.2,
    },
  });

  // Custom tension-based color logic
  const getCustomTensionColor = (tension: number): string => {
    if (tension < 0.2) return "#00AA00"; // Green for low tension
    if (tension < 0.5) return "#FFA500"; // Orange for medium tension
    if (tension < 0.8) return "#FF6B35"; // Red-orange for high tension
    return "#FF0000"; // Bright red for very high tension
  };

  return (
    <div>
      <h2>Advanced Elastic Wire Canvas</h2>
      <p>
        Current tension:{" "}
        {elasticWire.currentElasticWire?.getTension().toFixed(2) || "N/A"}
      </p>
      <p>Active nets: {elasticWire.nets.length}</p>
      <p>Wire connections: {elasticWire.elasticConnections.length}</p>
    </div>
  );
}

export default ElasticWireCanvas;
