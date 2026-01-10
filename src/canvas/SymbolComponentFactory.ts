import Konva from "konva";

// Helper function matching SimpleComponentFactory
const getGraphicsColor = (stroke: any, fill: any, elementType: string) => {
  const defaults = {
    stroke: "black",
    fill: elementType === "rectangle" ? "#FFFFE0" : "transparent",
  };

  if (fill && fill.type === "background") {
    return {
      stroke: stroke ? "black" : defaults.stroke,
      fill: elementType === "polyline" ? "transparent" : "#FFFFE0",
    };
  }

  if (fill && fill.type === "none") {
    return {
      stroke: stroke ? "black" : defaults.stroke,
      fill: "transparent",
    };
  }

  return {
    stroke: defaults.stroke,
    fill: defaults.fill,
  };
};

export const createSymbolComponent = async (
  stage: Konva.Stage,
  layer: Konva.Layer,
  componentInfo: {
    id?: string;
    type: string;
    name: string;
    symbol_data: any; // The JSON object or string
    x?: number;
    y?: number;
    rotation?: number;
    componentMetadata?: any;
  }
) => {
  if (!stage || !layer || !componentInfo.symbol_data) {
    console.error("Missing stage, layer or symbol_data", componentInfo);
    return;
  }

  const scale = 10;
  const toKonva = (x: number, y: number) => ({
    x: x * scale,
    y: y * scale,
  });

  // Parse symbol_data if needed
  let symbolData = componentInfo.symbol_data;
  if (typeof symbolData === "string") {
    try {
      symbolData = JSON.parse(symbolData);
    } catch (e) {
      console.error("Failed to parse symbol_data", e);
      return;
    }
  }

  const graphics = symbolData.graphics || {};
  const group = new Konva.Group({
    x: componentInfo.x || stage.width() / 2,
    y: componentInfo.y || stage.height() / 2,
    rotation: componentInfo.rotation || 0,
    draggable: true,
    name: "component",
    id: componentInfo.id,
  });

  // Attach metadata
  group.setAttrs({
    componentType: componentInfo.type,
    componentMetadata: componentInfo.componentMetadata,
    data: componentInfo.componentMetadata,
  });

  // 1. Render Graphics
  const visualsGroup = new Konva.Group({ name: "visuals" });

  // Rectangles
  if (graphics.rectangles) {
    graphics.rectangles.forEach((rect: any) => {
      if (!rect.start || !rect.end) return;
      const width = Math.abs(rect.end.x - rect.start.x);
      const height = Math.abs(rect.end.y - rect.start.y);
      if (width <= 10.16 && height <= 10.16) return;

      const x = rect.start.x;
      const y = rect.start.y;
      const drawHeight = rect.end.y - rect.start.y;
      const colors = getGraphicsColor(rect.stroke, rect.fill, "rectangle");
      const start = toKonva(x, y);
      const strokeWidth = rect.stroke ? rect.stroke.width || 0.254 : 0.254;

      const kRect = new Konva.Rect({
        x: start.x,
        y: start.y,
        width: width * scale,
        height: drawHeight * scale,
        fill: colors.fill,
        stroke: colors.stroke,
        strokeWidth: strokeWidth * scale,
        cornerRadius: 1.0 * scale,
      });
      visualsGroup.add(kRect);
    });
  }

  // Polylines
  if (graphics.polylines) {
    graphics.polylines.forEach((polyline: any) => {
      if (!polyline.points || polyline.points.length < 2) return;
      const colors = getGraphicsColor(
        polyline.stroke,
        polyline.fill,
        "polyline"
      );
      const strokeWidth = polyline.stroke
        ? polyline.stroke.width || 0.254
        : 0.254;

      const points = polyline.points.flatMap((point: any) => {
        const kPoint = toKonva(point.x, point.y);
        return [kPoint.x, kPoint.y];
      });

      const kLine = new Konva.Line({
        points: points,
        stroke: colors.stroke,
        strokeWidth: strokeWidth * scale,
        closed: false,
      });
      visualsGroup.add(kLine);
    });
  }

  // Circles
  if (graphics.circles) {
    graphics.circles.forEach((circle: any) => {
      if (!circle.center || !circle.radius) return;
      const colors = getGraphicsColor(circle.stroke, circle.fill, "circle");
      const center = toKonva(circle.center.x, circle.center.y);
      const strokeWidth = circle.stroke ? circle.stroke.width || 0.254 : 0.254;

      const kCircle = new Konva.Circle({
        x: center.x,
        y: center.y,
        radius: circle.radius * scale,
        fill: colors.fill !== "transparent" ? colors.fill : undefined,
        stroke: colors.stroke,
        strokeWidth: strokeWidth * scale,
      });
      visualsGroup.add(kCircle);
    });
  }

  // Arcs
  if (graphics.arcs) {
    graphics.arcs.forEach((arc: any) => {
      if (arc.start && arc.mid && arc.end) {
        const colors = getGraphicsColor(arc.stroke, arc.fill, "arc");
        const strokeWidth = arc.stroke ? arc.stroke.width || 0.254 : 0.254;
        const start = toKonva(arc.start.x, arc.start.y);
        const mid = toKonva(arc.mid.x, arc.mid.y);
        const end = toKonva(arc.end.x, arc.end.y);

        // Bezier approximation (using react-konva example logic)
        // Konva.Line with tension=0.5 and bezier=true expects [x1, y1, x2, y2, x3, y3]
        const kArc = new Konva.Line({
          points: [start.x, start.y, mid.x, mid.y, end.x, end.y],
          stroke: colors.stroke,
          strokeWidth: strokeWidth * scale,
          tension: 0.5,
          bezier: true,
        });
        visualsGroup.add(kArc);
      } else if (arc.center && arc.radius) {
        // Approximate circle segment
        const colors = getGraphicsColor(arc.stroke, arc.fill, "arc");
        const strokeWidth = arc.stroke ? arc.stroke.width || 0.254 : 0.254;
        const center = toKonva(arc.center.x, arc.center.y);
        const points: number[] = [];
        const steps = 20;
        const startAngle = arc.startAngle || 0;
        const endAngle = arc.endAngle || 360;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const angle = startAngle + (endAngle - startAngle) * t;
          const radians = (angle * Math.PI) / 180;
          const px = center.x + arc.radius * scale * Math.cos(radians);
          const py = center.y + arc.radius * scale * Math.sin(radians);
          points.push(px, py);
        }
        const kArc = new Konva.Line({
          points: points,
          stroke: colors.stroke,
          strokeWidth: strokeWidth * scale,
        });
        visualsGroup.add(kArc);
      }
    });
  }

  // Text
  if (graphics.text) {
    graphics.text.forEach((textElement: any) => {
      const content = textElement.content || textElement.text;
      if (!content || !textElement.position) return;
      const pos = textElement.position;
      const angle = pos.angle || textElement.rotation || 0;
      const position = toKonva(pos.x, pos.y);

      let align = "center";
      let verticalAlign = "middle";
      if (textElement.effects?.justify) {
        const justify = textElement.effects.justify.toLowerCase();
        if (justify.includes("left")) align = "left";
        else if (justify.includes("right")) align = "right";

        if (justify.includes("top")) verticalAlign = "top";
        else if (justify.includes("bottom")) verticalAlign = "bottom";
      }

      const kText = new Konva.Text({
        x: position.x,
        y: position.y,
        text: content,
        fontSize: (textElement.size || 2.0) * scale,
        rotation: angle,
        fontFamily: "sans-serif",
        fill: "black",
        align: align,
        verticalAlign: verticalAlign,
        scaleY: -1, // KiCad Y-flip
      });
      visualsGroup.add(kText);
    });
  }

  group.add(visualsGroup);

  // 2. Render Pins
  const pins = symbolData.pins || [];
  pins.forEach((pin: any, index: number) => {
    // Determine Pin Type Color
    let pinColor = "#EC2F4B";
    if (pin.type === "power_in") pinColor = "#D0021B";
    else if (pin.type === "input") pinColor = "#F5A623";
    else if (pin.type === "output") pinColor = "#417505";

    // Pin Line
    const pos = pin.position || { x: 0, y: 0, angle: 0 };
    const start = toKonva(pos.x, pos.y);
    const length = (pin.length || 3.81) * scale;
    // Calculate end point based on angle
    const angleRad = (pos.angle || 0) * (Math.PI / 180);
    const endX = start.x + length * Math.cos(angleRad);
    const endY = start.y + length * Math.sin(angleRad); // + because Y is flipped via scale? No, verify standard Konva

    // Wait, simple component handles scaleY differently?
    // In SimpleComponent, Y coords from KiCad are used directly in 'toKonva' then passed to props.
    // Text has scaleY: -1.
    // Let's assume standard coord system for now.
    // KiCad: Y is up?
    // In SimpleComponentFactory, `toKonva` = x*scale, y*scale.
    // If we need Y flip, usually group.scaleY(-1).
    // Let's stick to simple logic:

    // Pin Line
    const pinLine = new Konva.Line({
      points: [start.x, start.y, endX, endY],
      stroke: pinColor,
      strokeWidth: 2, // Thinner
    });
    group.add(pinLine);

    // Interactive Hit Area (Circle at connection point)
    // The connection point is usually (startX, startY) in KiCad for pins?
    // No, usually connection point is the end of the pin line that is NOT on the body.
    // But in KiCad pin definition, the position is the connection point.
    // SimpleComponentFactory uses onPinClick with pin.position.

    const pinHit = new Konva.Circle({
      x: start.x,
      y: start.y,
      radius: 5,
      fill: "transparent",
      stroke: "transparent",
      name: "pin",
    });

    pinHit.setAttrs({
      pinNumber: pin.number,
      pinId: `pin_${pin.number}`,
      type: "pin",
      isConnectable: true,
    });

    group.add(pinHit);

    // Pin visuals (circles/decorations) - simplified here
    const dot = new Konva.Circle({
      x: start.x,
      y: start.y,
      radius: 3,
      fill: "white",
      stroke: pinColor,
      strokeWidth: 1,
      listening: false,
    });
    group.add(dot);

    // Pin Text (Number and Name)
    // Simplified placement logic
    const kText = new Konva.Text({
      x: endX,
      y: endY,
      text: pin.number,
      fontSize: 10,
      fill: pinColor,
    });
    group.add(kText);
  });

  layer.add(group);
  layer.batchDraw();

  return group;
};
