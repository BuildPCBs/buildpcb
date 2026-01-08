import Konva from "konva";
import { parseSVGToKonva } from "./utils/konvaSvgParser";

// Intelligent SVG Component Factory - Reads pins from SVG data
export const createIntelligentComponent = async (
  stage: Konva.Stage,
  layer: Konva.Layer,
  componentInfo: {
    type: string;
    svgPath: string;
    name: string;
    x?: number;
    y?: number;
    rotation?: number;
  }
) => {
  if (!stage || !layer) return;

  console.log(
    `🧠 INTELLIGENT: Creating ${componentInfo.name} with intelligent SVG parsing (Konva)`
  );

  try {
    // Load SVG string
    const response = await fetch(componentInfo.svgPath);
    const svgString = await response.text();

    // Parse SVG to Konva Group using our utility
    const svgGroup = parseSVGToKonva(svgString);

    // Filter and process objects
    const pins: Konva.Node[] = [];
    const symbolParts: Konva.Node[] = [];

    // 1. Separate parts (pins vs symbol)
    // Note: parseSVGToKonva assigns 'id' from SVG to 'name' property of Konva nodes
    svgGroup.getChildren().forEach((node) => {
      if (node.name() === "pin") {
        console.log(`📍 Found PIN at x=${node.x()}, y=${node.y()}`);
        pins.push(node);
      } else {
        symbolParts.push(node);
      }
    });

    // 2. Create the visual symbol group
    // We create a new group for the symbol parts to isolate them
    const symbolGroup = new Konva.Group({
      name: "symbol_visuals",
    });
    symbolParts.forEach((part) => {
      // Clone to detach from original svgGroup without issues
      symbolGroup.add(part.clone());
    });

    // 3. Create interactive pins
    const interactivePins = pins.map((pin, index) => {
      // Create a hit area / visual pin
      const interactivePin = new Konva.Circle({
        radius: 4,
        fill: "rgba(0, 255, 0, 0.8)",
        stroke: "#059669",
        strokeWidth: 1,
        x: pin.x(),
        y: pin.y(),
        name: "pin", // Class name for easy finding
      });

      // Add metadata
      interactivePin.setAttrs({
        pinNumber: (index + 1).toString(),
        pinId: `pin${index + 1}`,
        isConnectable: true,
        type: "pin",
      });

      return interactivePin;
    });

    // 4. Add Label
    const displayText =
      (componentInfo as any).refDes || componentInfo.name.substring(0, 8);
    const label = new Konva.Text({
      text: displayText,
      fontSize: 10,
      fill: "#333333",
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      align: "center",
      y: (symbolGroup.getClientRect().height || 20) / 2 + 15,
      offsetX: (displayText.length * 5) / 2, // Approximate centering
    });

    // 5. Final Component Group
    const finalComponent = new Konva.Group({
      x: componentInfo.x || stage.width() / 2,
      y: componentInfo.y || stage.height() / 2,
      rotation: componentInfo.rotation || 0,
      draggable: true,
      name: "component", // Class name
    });

    // Add custom metadata
    finalComponent.setAttrs({
      id: `component_${Date.now()}`,
      componentType: componentInfo.type,
      componentName: componentInfo.name,
      componentMetadata: (componentInfo as any).componentMetadata, // Pass through if exists
    });

    finalComponent.add(symbolGroup);
    finalComponent.add(label);
    interactivePins.forEach((p) => finalComponent.add(p));

    // 6. Add to Layer
    layer.add(finalComponent);

    // Force redraw
    layer.batchDraw();

    console.log(
      `🎉 INTELLIGENT: Added ${componentInfo.name} with ${interactivePins.length} pins via Konva`
    );

    // Setup events for hover effects
    finalComponent.on("mouseenter", () => {
      document.body.style.cursor = "move";
      interactivePins.forEach((p) => p.opacity(1));
      layer.batchDraw();
    });

    finalComponent.on("mouseleave", () => {
      document.body.style.cursor = "default";
      interactivePins.forEach((p) => p.opacity(0.8)); // Keep slightly visible or hide? Fabric logic hid them.
      layer.batchDraw();
    });
  } catch (error) {
    console.error(
      `❌ INTELLIGENT: Error processing ${componentInfo.name}:`,
      error
    );
  }
};

// Recreate pins for an existing component group (if specialized logic needed)
export const recreateIntelligentComponentPins = (component: Konva.Group) => {
  // Stub or implement if needed for copy/paste
  console.log("recreateIntelligentComponentPins called (stub)");
  return component;
};
