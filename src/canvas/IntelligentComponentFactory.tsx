import * as fabric from "fabric";

// Intelligent SVG Component Factory - Reads pins from SVG data
export const createIntelligentComponent = (
  fabricCanvas: fabric.Canvas,
  componentInfo: {
    type: string;
    svgPath: string;
    name: string;
    x?: number;
    y?: number;
  }
) => {
  if (!fabricCanvas) return;

  console.log(
    `🧠 INTELLIGENT: Creating ${componentInfo.name} with intelligent SVG parsing`
  );

  // Load SVG with Fabric.js 6.0.0+ syntax
  fetch(componentInfo.svgPath)
    .then((response) => response.text())
    .then((svgString) => {
      return fabric.loadSVGFromString(svgString);
    })
    .then((result) => {
      try {
        // Filter out null/undefined objects
        const objects = result.objects.filter((obj) => !!obj);

        if (!objects || objects.length === 0) {
          console.error(
            `❌ INTELLIGENT: No valid objects in ${componentInfo.svgPath}`
          );
          return;
        }

        console.log(
          `✅ INTELLIGENT: Loaded ${objects.length} SVG objects for ${componentInfo.name}`
        );

        const pins: fabric.FabricObject[] = [];
        const symbolParts: fabric.FabricObject[] = [];

        // 1. Separate the loaded parts into PINS and SYMBOL pieces
        objects.forEach((obj) => {
          console.log(
            `🔍 Examining object: type=${obj.type}, id=${(obj as any).id}`
          );

          if ((obj as any).id === "pin") {
            // This is a connection point
            console.log(`📍 Found PIN at x=${obj.left}, y=${obj.top}`);
            pins.push(obj);
          } else {
            // This is part of the visual symbol
            symbolParts.push(obj);
          }
        });

        console.log(
          `🔌 Found ${pins.length} pins and ${symbolParts.length} symbol parts`
        );

        // 2. Group the visual parts into a single symbol
        const svgSymbol = new fabric.Group(symbolParts, {
          originX: "center",
          originY: "center",
        });

        // 3. Create interactive pins using the EXACT positions from the SVG
        const interactivePins = pins.map((pin, index) => {
          const interactivePin = new fabric.Circle({
            radius: 4, // Make them slightly bigger and easier to click
            fill: "rgba(0, 255, 0, 0.8)", // Bright green for visibility
            stroke: "#059669",
            strokeWidth: 1,
            left: pin.left || 0,
            top: pin.top || 0,
            originX: "center",
            originY: "center",
          });

          // Add the pin metadata that the wiring tool expects
          interactivePin.set("pin", true);
          interactivePin.set("data", {
            type: "pin",
            componentId: `component_${Date.now()}`,
            pinId: `pin${index + 1}`,
            pinNumber: index + 1,
            isConnectable: true,
          });

          console.log(
            `✅ Created interactive pin ${index + 1} at position (${
              pin.left
            }, ${pin.top})`
          );
          return interactivePin;
        });

        // 4. Add component label
        const label = new fabric.Text(componentInfo.name.substring(0, 8), {
          fontSize: 8,
          fill: "#333333",
          fontFamily: "Arial, sans-serif",
          fontWeight: "bold",
          originX: "center",
          originY: "center",
          top: (svgSymbol.height || 20) / 2 + 15, // Position below component
        });

        // 5. Create the final group with the symbol and the REAL pins
        const finalComponent = new fabric.Group(
          [svgSymbol, label, ...interactivePins],
          {
            left: componentInfo.x || fabricCanvas.getVpCenter().x,
            top: componentInfo.y || fabricCanvas.getVpCenter().y,
            originX: "center",
            originY: "center",
          }
        );

        // Add component metadata that the wiring tool expects
        finalComponent.set("componentType", componentInfo.type);
        finalComponent.set("data", {
          type: "component",
          componentType: componentInfo.type,
          componentName: componentInfo.name,
          pins: interactivePins.map((_, index) => `pin${index + 1}`),
        });

        // Make component selectable and rotatable
        finalComponent.set({
          selectable: true,
          evented: true,
          lockUniScaling: true,
          hasControls: true,
          hasBorders: true,
          centeredRotation: true,
        });

        // 6. Add the final, perfect component to the canvas
        fabricCanvas.add(finalComponent);
        fabricCanvas.renderAll();

        console.log(
          `🎉 INTELLIGENT: Added ${componentInfo.name} with ${interactivePins.length} intelligent pins!`
        );
      } catch (error) {
        console.error(
          `❌ INTELLIGENT: Error processing ${componentInfo.name}:`,
          error
        );
      }
    })
    .catch((error) => {
      console.error(
        `❌ INTELLIGENT: Failed to load ${componentInfo.svgPath}:`,
        error
      );
    });
};
