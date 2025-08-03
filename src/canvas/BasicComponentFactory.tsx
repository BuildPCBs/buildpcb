import * as fabric from "fabric";

// BASIC COMPONENT FACTORY - Goes back to the simple "Add Resistor" logic that worked
export const createBasicComponent = (
  fabricCanvas: fabric.Canvas,
  payload: {
    svgPath: string;
    componentType: string;
    type?: string;
    name?: string;
  }
) => {
  if (!fabricCanvas) {
    console.error("❌ BASIC: No canvas available");
    return;
  }

  const componentType = payload.componentType || payload.type || "unknown";
  console.log(
    `🔧 BASIC: Canvas received command. Loading SVG from: ${payload.svgPath}`
  );

  // Use the simple SVG loading logic that worked before
  fabric.loadSVGFromURL(payload.svgPath, (objects: any, options: any) => {
    try {
      console.log("🔧 BASIC: SVG loaded, creating component...");

      // This is the logic that worked before - simple and reliable
      const svgSymbol = (fabric.util as any).groupSVGElements(objects, options);

      if (!svgSymbol) {
        console.error("❌ BASIC: Failed to create SVG group");
        return;
      }

      // Scale the SVG to a reasonable size
      svgSymbol.set({
        scaleX: 0.5,
        scaleY: 0.5,
        originX: "center",
        originY: "center",
      });

      // Create simple functional pins (left and right)
      const leftPin = new fabric.Circle({
        radius: 4,
        fill: "#10B981",
        stroke: "#059669",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        left: -40,
        top: 0,
      });
      leftPin.set("pin", true);
      leftPin.set("data", { type: "pin", pinId: "pin1", pinNumber: 1 });

      const rightPin = new fabric.Circle({
        radius: 4,
        fill: "#10B981",
        stroke: "#059669",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        left: 40,
        top: 0,
      });
      rightPin.set("pin", true);
      rightPin.set("data", { type: "pin", pinId: "pin2", pinNumber: 2 });

      // Group everything together - the simple way
      const finalComponent = new fabric.Group([svgSymbol, leftPin, rightPin], {
        left: fabricCanvas.getVpCenter().x,
        top: fabricCanvas.getVpCenter().y,
      });

      // Add component metadata
      finalComponent.set("componentType", componentType);
      finalComponent.set("data", {
        type: "component",
        componentType: componentType,
      });

      // Make it selectable and rotatable
      finalComponent.set({
        selectable: true,
        evented: true,
        hasControls: true,
        hasBorders: true,
        centeredRotation: true,
      });

      // Add to canvas - the simple way
      fabricCanvas.add(finalComponent);
      fabricCanvas.renderAll();

      console.log(`✅ BASIC: ${componentType} should now be on the canvas.`);
    } catch (error) {
      console.error(`❌ BASIC: Error creating ${componentType}:`, error);
    }
  });
};
