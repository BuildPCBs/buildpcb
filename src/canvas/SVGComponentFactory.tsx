import * as fabric from "fabric";

// SVG Component Factory - Loads actual SVG graphics with functional pins
const componentSVGPaths = {
  resistor: "/components/resistor.svg",
  capacitor: "/components/capacitor.svg",
  led: "/components/led.svg",
  diode: "/components/diode.svg",
  transistor: "/components/transistor.svg",
  inductor: "/components/inductor.svg",
  battery: "/components/battery.svg",
  switch: "/components/switch.svg",
  connector: "/components/connector.svg",
  pushbutton: "/components/pushbutton.svg",
  crystal: "/components/crystal.svg",
  opamp: "/components/opamp.svg",
  sensor: "/components/sensor.svg",
  motor: "/components/motor.svg",
  voltage_regulator: "/components/voltage_regulator.svg",
  arduino: "/components/arduino.svg",
};

// Component configuration for pin placement and sizing
const componentConfig = {
  resistor: { width: 80, height: 30, pinDistance: 45, pinCount: 2 },
  capacitor: { width: 50, height: 60, pinDistance: 30, pinCount: 2 },
  led: { width: 40, height: 40, pinDistance: 25, pinCount: 2 },
  diode: { width: 60, height: 30, pinDistance: 35, pinCount: 2 },
  transistor: { width: 50, height: 50, pinDistance: 30, pinCount: 3 },
  inductor: { width: 70, height: 30, pinDistance: 40, pinCount: 2 },
  battery: { width: 40, height: 60, pinDistance: 25, pinCount: 2 },
  switch: { width: 60, height: 30, pinDistance: 35, pinCount: 2 },
  connector: { width: 50, height: 40, pinDistance: 30, pinCount: 2 },
  pushbutton: { width: 40, height: 40, pinDistance: 25, pinCount: 2 },
  crystal: { width: 50, height: 30, pinDistance: 30, pinCount: 2 },
  opamp: { width: 70, height: 50, pinDistance: 40, pinCount: 8 },
  sensor: { width: 50, height: 40, pinDistance: 30, pinCount: 3 },
  motor: { width: 60, height: 60, pinDistance: 35, pinCount: 2 },
  voltage_regulator: { width: 60, height: 40, pinDistance: 35, pinCount: 3 },
  arduino: { width: 120, height: 80, pinDistance: 65, pinCount: 20 },
};

// Create functional pins for the component
function createComponentPins(config: any, componentId: string) {
  const pins: fabric.Circle[] = [];

  if (config.pinCount === 2) {
    // Two pins: left and right
    const pin1 = new fabric.Circle({
      radius: 4,
      fill: "#10B981",
      stroke: "#059669",
      strokeWidth: 1,
      originX: "center",
      originY: "center",
      left: -config.pinDistance,
      top: 0,
    });
    pin1.set("pin", true);
    pin1.set("data", { type: "pin", componentId, pinId: "pin1", pinNumber: 1 });

    const pin2 = new fabric.Circle({
      radius: 4,
      fill: "#10B981",
      stroke: "#059669",
      strokeWidth: 1,
      originX: "center",
      originY: "center",
      left: config.pinDistance,
      top: 0,
    });
    pin2.set("pin", true);
    pin2.set("data", { type: "pin", componentId, pinId: "pin2", pinNumber: 2 });

    pins.push(pin1, pin2);
  } else if (config.pinCount === 3) {
    // Three pins: left, right, bottom
    const pin1 = new fabric.Circle({
      radius: 4,
      fill: "#10B981",
      stroke: "#059669",
      strokeWidth: 1,
      originX: "center",
      originY: "center",
      left: -config.pinDistance / 2,
      top: 0,
    });
    pin1.set("pin", true);
    pin1.set("data", { type: "pin", componentId, pinId: "pin1", pinNumber: 1 });

    const pin2 = new fabric.Circle({
      radius: 4,
      fill: "#10B981",
      stroke: "#059669",
      strokeWidth: 1,
      originX: "center",
      originY: "center",
      left: config.pinDistance / 2,
      top: 0,
    });
    pin2.set("pin", true);
    pin2.set("data", { type: "pin", componentId, pinId: "pin2", pinNumber: 2 });

    const pin3 = new fabric.Circle({
      radius: 4,
      fill: "#10B981",
      stroke: "#059669",
      strokeWidth: 1,
      originX: "center",
      originY: "center",
      left: 0,
      top: config.pinDistance / 2,
    });
    pin3.set("pin", true);
    pin3.set("data", { type: "pin", componentId, pinId: "pin3", pinNumber: 3 });

    pins.push(pin1, pin2, pin3);
  }
  // Add more pin configurations as needed for multi-pin components

  return pins;
}

// Enhanced SVG Component Factory
export const createSVGComponent = (
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

  console.log(`🎨 SVG: Creating ${componentInfo.name} with real SVG`);

  const componentType = componentInfo.type as keyof typeof componentSVGPaths;
  const svgPath = componentSVGPaths[componentType] || componentInfo.svgPath;
  const config = componentConfig[componentType] || componentConfig.resistor;
  const componentId = `component_${Date.now()}`;

  console.log(
    `🎨 SVG: Attempting to load ${svgPath} for ${componentInfo.name}`
  );

  // Load SVG with proper error handling
  fabric.loadSVGFromURL(svgPath, (objects: any, options: any) => {
    try {
      // Handle SVG loading result
      if (!objects || (Array.isArray(objects) && objects.length === 0)) {
        console.error(
          `❌ SVG: Failed to load ${svgPath}, falling back to simple component`
        );
        createFallbackComponent(
          fabricCanvas,
          componentInfo,
          config,
          componentId
        );
        return;
      }

      console.log(`✅ SVG: Loaded SVG for ${componentInfo.name}`);

      // Create SVG group - cast to any to avoid TypeScript issues
      const svgGroup = (fabric.util as any).groupSVGElements(objects, options);

      // Scale SVG to desired size
      const scaleX = config.width / (svgGroup.width || 1);
      const scaleY = config.height / (svgGroup.height || 1);
      const scale = Math.min(scaleX, scaleY);

      svgGroup.set({
        scaleX: scale,
        scaleY: scale,
        originX: "center",
        originY: "center",
      });

      // Create functional pins
      const pins = createComponentPins(config, componentId);

      // Add component label
      const label = new fabric.Text(componentInfo.name.substring(0, 8), {
        fontSize: 8,
        fill: "#333333",
        fontFamily: "Arial, sans-serif",
        fontWeight: "bold",
        originX: "center",
        originY: "center",
        top: config.height / 2 + 10, // Position below component
      });

      // Group everything together
      const component = new fabric.Group([svgGroup, label, ...pins], {
        left: componentInfo.x || fabricCanvas.getVpCenter().x,
        top: componentInfo.y || fabricCanvas.getVpCenter().y,
      });

      // Add component metadata
      component.set("componentType", componentInfo.type);
      component.set("data", {
        type: "component",
        componentType: componentInfo.type,
        componentName: componentInfo.name,
        pins: pins.map((_, index) => `pin${index + 1}`),
      });

      // Make component selectable and rotatable
      component.set({
        selectable: true,
        evented: true,
        lockUniScaling: true,
        hasControls: true,
        hasBorders: true,
        centeredRotation: true,
      });

      // Add to canvas
      fabricCanvas.add(component);
      fabricCanvas.renderAll();

      console.log(
        `✅ SVG: Added ${componentInfo.name} with SVG graphics and ${pins.length} pins!`
      );
    } catch (error) {
      console.error(`❌ SVG: Error processing ${componentInfo.name}:`, error);
      createFallbackComponent(fabricCanvas, componentInfo, config, componentId);
    }
  });
};

// Fallback to simple component if SVG loading fails
function createFallbackComponent(
  fabricCanvas: fabric.Canvas,
  componentInfo: any,
  config: any,
  componentId: string
) {
  console.log(`🔄 SVG: Creating fallback component for ${componentInfo.name}`);

  // Simple rectangle fallback
  const rect = new fabric.Rect({
    width: config.width,
    height: config.height,
    fill: "#E5E7EB",
    stroke: "#6B7280",
    strokeWidth: 2,
    rx: 4,
    ry: 4,
    originX: "center",
    originY: "center",
  });

  const label = new fabric.Text(componentInfo.name.substring(0, 6), {
    fontSize: 9,
    fill: "#374151",
    fontFamily: "Arial, sans-serif",
    fontWeight: "bold",
    originX: "center",
    originY: "center",
  });

  const pins = createComponentPins(config, componentId);

  const component = new fabric.Group([rect, label, ...pins], {
    left: componentInfo.x || fabricCanvas.getVpCenter().x,
    top: componentInfo.y || fabricCanvas.getVpCenter().y,
  });

  component.set("componentType", componentInfo.type);
  component.set("data", {
    type: "component",
    componentType: componentInfo.type,
    componentName: componentInfo.name,
    pins: pins.map((_, index) => `pin${index + 1}`),
  });

  component.set({
    selectable: true,
    evented: true,
    lockUniScaling: true,
    hasControls: true,
    hasBorders: true,
    centeredRotation: true,
  });

  fabricCanvas.add(component);
  fabricCanvas.renderAll();
}
