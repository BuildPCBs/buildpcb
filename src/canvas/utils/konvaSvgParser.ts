import Konva from "konva";

/**
 * Parses an SVG string and returns a Konva.Group containing the SVG elements.
 * This is a lightweight replacement for fabric.loadSVGFromString.
 */
export const parseSVGToKonva = (
  svgString: string,
  options: {
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
  } = {}
): Konva.Group => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svgElement = doc.documentElement;

  const group = new Konva.Group({
    x: options.x || 0,
    y: options.y || 0,
    scaleX: options.scaleX || 1,
    scaleY: options.scaleY || 1,
    rotation: options.rotation || 0,
  });

  // Helper to parse transform attributes (basic support)
  const parseTransform = (el: Element) => {
    // TODO: Implement robust transform parsing if needed
    return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  };

  const processNode = (node: Element, parent: Konva.Group) => {
    const tagName = node.tagName.toLowerCase();

    // Common attributes
    const stroke = node.getAttribute("stroke") || undefined;
    const strokeWidth = parseFloat(node.getAttribute("stroke-width") || "1");
    const fill = node.getAttribute("fill") || undefined;
    const id = node.getAttribute("id") || "";

    if (tagName === "g") {
      const g = new Konva.Group({ name: id });
      parent.add(g);
      Array.from(node.children).forEach((child) => processNode(child, g));
    } else if (tagName === "path") {
      const d = node.getAttribute("d");
      if (d) {
        const path = new Konva.Path({
          data: d,
          fill: fill,
          stroke: stroke,
          strokeWidth: strokeWidth,
          name: id,
        });
        parent.add(path);
      }
    } else if (tagName === "circle") {
      const cx = parseFloat(node.getAttribute("cx") || "0");
      const cy = parseFloat(node.getAttribute("cy") || "0");
      const r = parseFloat(node.getAttribute("r") || "0");
      const circle = new Konva.Circle({
        x: cx,
        y: cy,
        radius: r,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        name: id,
      });
      parent.add(circle);
    } else if (tagName === "rect") {
      const x = parseFloat(node.getAttribute("x") || "0");
      const y = parseFloat(node.getAttribute("y") || "0");
      const w = parseFloat(node.getAttribute("width") || "0");
      const h = parseFloat(node.getAttribute("height") || "0");
      const rect = new Konva.Rect({
        x: x,
        y: y,
        width: w,
        height: h,
        fill: fill,
        stroke: stroke,
        strokeWidth: strokeWidth,
        name: id,
      });
      parent.add(rect);
    } else if (tagName === "line") {
      const x1 = parseFloat(node.getAttribute("x1") || "0");
      const y1 = parseFloat(node.getAttribute("y1") || "0");
      const x2 = parseFloat(node.getAttribute("x2") || "0");
      const y2 = parseFloat(node.getAttribute("y2") || "0");
      const line = new Konva.Line({
        points: [x1, y1, x2, y2],
        stroke: stroke,
        strokeWidth: strokeWidth,
        name: id,
      });
      parent.add(line);
    }
  };

  Array.from(svgElement.children).forEach((child) => processNode(child, group));

  return group;
};
