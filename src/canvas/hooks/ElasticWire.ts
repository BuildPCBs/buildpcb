/**
 * Elastic Wire System for BuildPCBs
 *
 * This system provides elastic wire behavior for PCB schematic design,
 * featuring smooth animations, tension visualization, and proper net integration.
 *
 * Key Features:
 * - Elastic wire preview with smooth stretching animation
 * - Tension visualization with color and thickness changes
 * - Net-based electrical connectivity management
 * - Database persistence and retrieval
 * - Professional KiCad-style orthogonal routing
 */

import * as fabric from "fabric";

/**
 * Elastic Wire Configuration
 */
export interface ElasticWireConfig {
  /** Base stroke color for the wire */
  strokeColor: string;
  /** Stroke width at rest */
  baseStrokeWidth: number;
  /** Maximum stroke width when stretched */
  maxStrokeWidth: number;
  /** Animation duration in milliseconds */
  animationDuration: number;
  /** Tension threshold for visual feedback */
  tensionThreshold: number;
  /** Elastic damping factor (0-1) */
  damping: number;
  /** Spring constant for elastic behavior */
  springConstant: number;
}

/**
 * Default configuration for elastic wires
 */
export const DEFAULT_ELASTIC_CONFIG: ElasticWireConfig = {
  strokeColor: "#0038DF",
  baseStrokeWidth: 1,
  maxStrokeWidth: 3,
  animationDuration: 300,
  tensionThreshold: 50,
  damping: 0.8,
  springConstant: 0.1,
};

/**
 * Elastic Wire State
 */
export interface ElasticWireState {
  /** Start point of the wire */
  startPoint: fabric.Point;
  /** End point of the wire */
  endPoint: fabric.Point;
  /** Current tension level (0-1) */
  tension: number;
  /** Whether the wire is animating */
  isAnimating: boolean;
  /** Bend points for multi-segment wires */
  bendPoints: fabric.Point[];
  /** Connection data for net management */
  connectionData?: {
    fromComponentId: string;
    fromPinNumber: string;
    toComponentId?: string;
    toPinNumber?: string;
  };
}

/**
 * Elastic Wire Class
 *
 * Provides elastic behavior for wires in PCB schematic design.
 * Features smooth animations, tension visualization, and net integration.
 */
export class ElasticWire {
  private config: ElasticWireConfig;
  private state: ElasticWireState;
  private fabricObject: fabric.Path | null = null;
  private animationFrame: number | null = null;
  private canvas: fabric.Canvas | null = null;

  constructor(
    startPoint: fabric.Point,
    endPoint: fabric.Point,
    config: Partial<ElasticWireConfig> = {},
    canvas?: fabric.Canvas
  ) {
    this.config = { ...DEFAULT_ELASTIC_CONFIG, ...config };
    this.canvas = canvas || null;

    this.state = {
      startPoint: startPoint.clone(),
      endPoint: endPoint.clone(),
      tension: 0,
      isAnimating: false,
      bendPoints: [],
    };

    this.createFabricObject();
  }

  /**
   * Create the Fabric.js object for this elastic wire
   */
  private createFabricObject(): void {
    const pathData = this.generatePathData();
    const strokeWidth = this.calculateStrokeWidth();

    this.fabricObject = new fabric.Path(pathData, {
      stroke: this.config.strokeColor,
      strokeWidth: strokeWidth,
      fill: "",
      selectable: false,
      hasControls: false,
      hasBorders: false,
      evented: false,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      opacity: 0.8, // Slightly transparent for preview effect
    });

    // Add elastic wire metadata
    (this.fabricObject as any).elasticWireData = {
      type: "elasticWire",
      tension: this.state.tension,
      isPreview: true,
    };
  }

  /**
   * Generate SVG path data for the wire
   */
  private generatePathData(): string {
    const { startPoint, endPoint, bendPoints } = this.state;

    // If we have bend points, create a multi-segment path
    if (bendPoints.length > 0) {
      return this.generateMultiSegmentPath();
    }

    // Generate orthogonal path (L-shaped)
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;

    // Decide direction based on which distance is larger
    const goHorizontalFirst = Math.abs(dx) > Math.abs(dy);

    let pathData = `M ${startPoint.x} ${startPoint.y}`;

    if (goHorizontalFirst) {
      // Horizontal first, then vertical
      if (Math.abs(dx) > 0.1) {
        // Changed from 1 to 0.1 to handle small movements
        pathData += ` L ${endPoint.x} ${startPoint.y}`;
      }
      if (Math.abs(dy) > 0.1) {
        // Changed from 1 to 0.1 to handle small movements
        pathData += ` L ${endPoint.x} ${endPoint.y}`;
      } else if (Math.abs(dx) <= 0.1) {
        // If both distances are very small, add a minimal line to end point
        pathData += ` L ${endPoint.x} ${endPoint.y}`;
      }
    } else {
      // Vertical first, then horizontal
      if (Math.abs(dy) > 0.1) {
        // Changed from 1 to 0.1 to handle small movements
        pathData += ` L ${startPoint.x} ${endPoint.y}`;
      }
      if (Math.abs(dx) > 0.1) {
        // Changed from 1 to 0.1 to handle small movements
        pathData += ` L ${endPoint.x} ${endPoint.y}`;
      } else if (Math.abs(dy) <= 0.1) {
        // If both distances are very small, add a minimal line to end point
        pathData += ` L ${endPoint.x} ${endPoint.y}`;
      }
    }

    // Ensure we always have a valid path with at least a move command
    if (pathData === `M ${startPoint.x} ${startPoint.y}`) {
      // If no line commands were added, add a minimal line to make the path valid
      pathData += ` L ${endPoint.x} ${endPoint.y}`;
    }

    return pathData;
  }

  /**
   * Generate multi-segment path for wires with bend points
   */
  private generateMultiSegmentPath(): string {
    const { startPoint, endPoint, bendPoints } = this.state;
    const allPoints = [startPoint, ...bendPoints, endPoint];

    let pathData = `M ${startPoint.x} ${startPoint.y}`;

    for (let i = 1; i < allPoints.length; i++) {
      const current = allPoints[i - 1];
      const next = allPoints[i];

      const dx = next.x - current.x;
      const dy = next.y - current.y;

      // Decide direction based on which distance is larger
      const goHorizontalFirst = Math.abs(dx) > Math.abs(dy);

      if (goHorizontalFirst) {
        // Horizontal first, then vertical
        if (Math.abs(dx) > 0.1) {
          // Changed from 1 to 0.1
          pathData += ` L ${next.x} ${current.y}`;
        }
        if (Math.abs(dy) > 0.1) {
          // Changed from 1 to 0.1
          pathData += ` L ${next.x} ${next.y}`;
        } else if (Math.abs(dx) <= 0.1) {
          // If both distances are very small, add a minimal line to next point
          pathData += ` L ${next.x} ${next.y}`;
        }
      } else {
        // Vertical first, then horizontal
        if (Math.abs(dy) > 0.1) {
          // Changed from 1 to 0.1
          pathData += ` L ${current.x} ${next.y}`;
        }
        if (Math.abs(dx) > 0.1) {
          // Changed from 1 to 0.1
          pathData += ` L ${next.x} ${next.y}`;
        } else if (Math.abs(dy) <= 0.1) {
          // If both distances are very small, add a minimal line to next point
          pathData += ` L ${next.x} ${next.y}`;
        }
      }
    }

    // Ensure we always have a valid path with at least one line command
    if (pathData === `M ${startPoint.x} ${startPoint.y}`) {
      // If no line commands were added, add a minimal line to end point
      pathData += ` L ${endPoint.x} ${endPoint.y}`;
    }

    return pathData;
  }

  /**
   * Calculate stroke width based on tension
   */
  private calculateStrokeWidth(): number {
    const { baseStrokeWidth, maxStrokeWidth } = this.config;
    return (
      baseStrokeWidth + (maxStrokeWidth - baseStrokeWidth) * this.state.tension
    );
  }

  /**
   * Calculate tension based on wire length and configuration
   */
  private calculateTension(): number {
    const distance = Math.sqrt(
      Math.pow(this.state.endPoint.x - this.state.startPoint.x, 2) +
        Math.pow(this.state.endPoint.y - this.state.startPoint.y, 2)
    );

    // Tension increases with distance, but caps at 1.0
    const tension = Math.min(distance / this.config.tensionThreshold, 1.0);
    return tension;
  }

  /**
   * Update the wire's end point with elastic animation
   */
  public updateEndPoint(newEndPoint: fabric.Point): void {
    this.state.endPoint = newEndPoint.clone();
    this.state.tension = this.calculateTension();

    if (this.fabricObject) {
      // Update path data using the correct Fabric.js method
      const newPathData = this.generatePathData();

      // Validate path data before parsing
      if (!newPathData || newPathData.trim() === "") {
        console.warn("ElasticWire: Empty path data generated, skipping update");
        return;
      }

      try {
        // Parse the SVG path string into Fabric.js path commands
        const parsedPath = fabric.util.parsePath(newPathData);
        if (!parsedPath || !Array.isArray(parsedPath)) {
          console.warn("ElasticWire: Invalid parsed path, skipping update");
          return;
        }
        this.fabricObject.set({ path: parsedPath });
      } catch (error) {
        console.error(
          "ElasticWire: Error parsing path data:",
          error,
          "Path:",
          newPathData
        );
        return;
      }

      // Update stroke width based on tension
      const newStrokeWidth = this.calculateStrokeWidth();
      this.fabricObject.set({ strokeWidth: newStrokeWidth });

      // Update color based on tension (more red when stretched)
      const tensionColor = this.getTensionColor();
      this.fabricObject.set({ stroke: tensionColor });

      if (this.canvas) {
        this.canvas.renderAll();
      }
    }
  }

  /**
   * Get color based on tension level
   */
  private getTensionColor(): string {
    const tension = this.state.tension;
    const baseColor = this.config.strokeColor;

    if (tension < 0.3) {
      return baseColor; // Normal blue
    } else if (tension < 0.7) {
      // Interpolate to orange
      return "#FF8C00";
    } else {
      // High tension - red
      return "#FF4444";
    }
  }

  /**
   * Add a bend point to the wire
   */
  public addBendPoint(point: fabric.Point): void {
    this.state.bendPoints.push(point.clone());
    this.updateFabricObject();
  }

  /**
   * Clear all bend points
   */
  public clearBendPoints(): void {
    this.state.bendPoints = [];
    this.updateFabricObject();
  }

  /**
   * Set connection data for net management
   */
  public setConnectionData(data: ElasticWireState["connectionData"]): void {
    this.state.connectionData = data;
    if (this.fabricObject) {
      (this.fabricObject as any).connectionData = data;
    }
  }

  /**
   * Update the fabric object with current state
   */
  private updateFabricObject(): void {
    if (this.fabricObject) {
      const pathData = this.generatePathData();
      const strokeWidth = this.calculateStrokeWidth();
      const strokeColor = this.getTensionColor();

      this.fabricObject.set({
        path: pathData,
        strokeWidth: strokeWidth,
        stroke: strokeColor,
      });

      if (this.canvas) {
        this.canvas.renderAll();
      }
    }
  }

  /**
   * Convert to regular wire (remove elastic properties)
   */
  public convertToRegularWire(): fabric.Path | null {
    if (!this.fabricObject) return null;

    // Create a regular wire object
    const regularWire = new fabric.Path(this.fabricObject.path as any, {
      stroke: this.config.strokeColor,
      strokeWidth: this.config.baseStrokeWidth,
      fill: "",
      selectable: false,
      hasControls: false,
      hasBorders: false,
      evented: false,
      strokeLineCap: "round",
      strokeLineJoin: "round",
      opacity: 1.0, // Full opacity for regular wires
    });

    // Copy connection data
    if (this.state.connectionData) {
      (regularWire as any).connectionData = this.state.connectionData;
    }

    // Mark as regular wire
    (regularWire as any).elasticWireData = {
      type: "regularWire",
      tension: 0,
      isPreview: false,
    };

    return regularWire;
  }

  /**
   * Get the current fabric object
   */
  public getFabricObject(): fabric.Path | null {
    return this.fabricObject;
  }

  /**
   * Get the current state
   */
  public getState(): ElasticWireState {
    return { ...this.state };
  }

  /**
   * Get the current tension
   */
  public getTension(): number {
    return this.state.tension;
  }

  /**
   * Check if wire is under high tension
   */
  public isHighTension(): boolean {
    return this.state.tension > 0.7;
  }

  /**
   * Destroy the elastic wire and clean up resources
   */
  public destroy(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.fabricObject && this.canvas) {
      this.canvas.remove(this.fabricObject);
    }

    this.fabricObject = null;
    this.canvas = null;
  }

  /**
   * Serialize the elastic wire for database storage
   */
  public serialize(): any {
    return {
      type: "elasticWire",
      startPoint: {
        x: this.state.startPoint.x,
        y: this.state.startPoint.y,
      },
      endPoint: {
        x: this.state.endPoint.x,
        y: this.state.endPoint.y,
      },
      bendPoints: this.state.bendPoints.map((point) => ({
        x: point.x,
        y: point.y,
      })),
      connectionData: this.state.connectionData,
      config: this.config,
    };
  }

  /**
   * Deserialize an elastic wire from database data
   */
  public static deserialize(data: any, canvas?: fabric.Canvas): ElasticWire {
    const startPoint = new fabric.Point(data.startPoint.x, data.startPoint.y);
    const endPoint = new fabric.Point(data.endPoint.x, data.endPoint.y);
    const bendPoints = data.bendPoints.map(
      (point: any) => new fabric.Point(point.x, point.y)
    );

    const wire = new ElasticWire(startPoint, endPoint, data.config, canvas);
    wire.state.bendPoints = bendPoints;

    if (data.connectionData) {
      wire.setConnectionData(data.connectionData);
    }

    wire.updateFabricObject();
    return wire;
  }
}
