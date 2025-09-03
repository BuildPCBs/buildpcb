import * as fabric from "fabric";

// Helper function to determine component category
function getCategoryForComponent(componentType: string): string {
  const categoryMap: Record<string, string> = {
    resistor: "passive",
    capacitor: "passive",
    inductor: "passive",
    led: "semiconductor",
    diode: "semiconductor",
    transistor: "semiconductor",
    battery: "power",
    switch: "control",
    connector: "connector",
    pushbutton: "control",
    crystal: "timing",
    opamp: "analog-ic",
    sensor: "sensor",
    motor: "actuator",
    voltage_regulator: "power",
    arduino: "microcontroller",
    buzzer: "actuator",
    "display-lcd": "display",
    fuse: "protection",
    microcontroller: "microcontroller",
    "photo-resistor": "sensor",
    potentiometer: "passive",
    relay: "control",
    "servo-motor": "actuator",
    "temperature-sensor": "sensor",
  };
  return categoryMap[componentType] || "general";
}

// Helper function to generate default specifications
function getDefaultSpecifications(componentType: string): Record<string, any> {
  const specMap: Record<string, Record<string, any>> = {
    resistor: { resistance: "1kΩ", tolerance: "5%", power: "0.25W" },
    capacitor: { capacitance: "10µF", voltage: "16V", type: "ceramic" },
    led: { color: "red", voltage: "2.0V", current: "20mA" },
    diode: { voltage: "0.7V", current: "1A", type: "silicon" },
    transistor: { type: "NPN", voltage: "40V", current: "200mA" },
    inductor: { inductance: "1mH", current: "1A", tolerance: "10%" },
    battery: { voltage: "9V", type: "alkaline", capacity: "500mAh" },
    switch: { type: "SPST", voltage: "250V", current: "1A" },
    connector: { pins: 2, spacing: "2.54mm", type: "header" },
    pushbutton: { type: "momentary", voltage: "12V", current: "50mA" },
    crystal: { frequency: "16MHz", tolerance: "20ppm", type: "quartz" },
    opamp: { type: "general-purpose", voltage: "±15V", bandwidth: "1MHz" },
    sensor: { type: "digital", voltage: "3.3V", interface: "I2C" },
    motor: { voltage: "12V", current: "500mA", type: "DC" },
    voltage_regulator: { input: "12V", output: "5V", current: "1A" },
    arduino: { microcontroller: "ATmega328P", voltage: "5V", pins: 20 },
    buzzer: { voltage: "5V", frequency: "2kHz", type: "piezo" },
    "display-lcd": { size: "16x2", voltage: "5V", interface: "parallel" },
    fuse: { rating: "1A", voltage: "250V", type: "fast-blow" },
    microcontroller: { architecture: "ARM", voltage: "3.3V", pins: 16 },
    "photo-resistor": {
      resistance: "10kΩ",
      sensitivity: "visible",
      type: "CdS",
    },
    potentiometer: { resistance: "10kΩ", taper: "linear", power: "0.5W" },
    relay: { voltage: "12V", current: "10A", type: "SPDT" },
    "servo-motor": { voltage: "6V", torque: "1.5kg-cm", angle: "180°" },
    "temperature-sensor": {
      range: "-40°C to 125°C",
      accuracy: "±0.5°C",
      interface: "analog",
    },
  };
  return specMap[componentType] || { type: "generic", voltage: "5V" };
}

// Component styling configuration
const componentStyles = {
  resistor: {
    width: 60,
    height: 20,
    fill: "#F59E0B",
    stroke: "#D97706",
    shape: "rect",
    pinDistance: 35,
  },
  capacitor: {
    width: 40,
    height: 35,
    fill: "#6366F1",
    stroke: "#4F46E5",
    shape: "rect",
    pinDistance: 25,
  },
  led: {
    width: 30,
    height: 30,
    fill: "#EF4444",
    stroke: "#DC2626",
    shape: "circle",
    pinDistance: 20,
  },
  transistor: {
    width: 45,
    height: 35,
    fill: "#8B5CF6",
    stroke: "#7C3AED",
    shape: "rect",
    pinDistance: 25,
  },
  diode: {
    width: 50,
    height: 25,
    fill: "#10B981",
    stroke: "#059669",
    shape: "rect",
    pinDistance: 30,
  },
  default: {
    width: 60,
    height: 30,
    fill: "#2563EB",
    stroke: "#1E40AF",
    shape: "rect",
    pinDistance: 35,
  },
};

// ENHANCED COMPONENT FACTORY WITH FUNCTIONAL PINS
export const createSimpleComponent = (
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

  console.log(`🏭 ENHANCED: Creating ${componentInfo.name}`);

  // Get component-specific styling
  const style =
    componentStyles[componentInfo.type as keyof typeof componentStyles] ||
    componentStyles.default;

  // Create component shape based on type
  let componentShape: fabric.Object;

  if (style.shape === "circle") {
    componentShape = new fabric.Circle({
      radius: style.width / 2,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: 2,
      originX: "center",
      originY: "center",
    });
  } else {
    componentShape = new fabric.Rect({
      width: style.width,
      height: style.height,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: 2,
      rx: 4, // Rounded corners
      ry: 4,
      originX: "center",
      originY: "center",
    });
  }

  // Add component label with better styling
  const label = new fabric.Text(componentInfo.name.substring(0, 6), {
    fontSize: 9,
    fill: "white",
    fontFamily: "Arial, sans-serif",
    fontWeight: "bold",
    originX: "center",
    originY: "center",
  });

  // Create FUNCTIONAL connection pins with metadata
  const pin1 = new fabric.Circle({
    radius: 4,
    fill: "#10B981", // Green pins
    stroke: "#059669",
    strokeWidth: 1,
    originX: "center",
    originY: "center",
    left: -style.pinDistance,
    top: 0,
  });

  // Add pin metadata that the wiring tool expects
  pin1.set("pin", true); // This is what the wiring tool looks for!
  pin1.set("data", {
    type: "pin",
    componentId: `component_${Date.now()}`,
    pinId: "pin1",
    pinNumber: 1,
    isConnectable: true,
  });
  console.log("🔌 Pin1 created with pin=true and metadata");

  const pin2 = new fabric.Circle({
    radius: 4,
    fill: "#10B981", // Green pins
    stroke: "#059669",
    strokeWidth: 1,
    originX: "center",
    originY: "center",
    left: style.pinDistance,
    top: 0,
  });

  // Add pin metadata that the wiring tool expects
  pin2.set("pin", true); // This is what the wiring tool looks for!
  pin2.set("data", {
    type: "pin",
    componentId: `component_${Date.now()}`,
    pinId: "pin2",
    pinNumber: 2,
    isConnectable: true,
  });
  console.log("🔌 Pin2 created with pin=true and metadata");

  // Group all parts with component metadata
  const component = new fabric.Group([componentShape, label, pin1, pin2], {
    left: componentInfo.x || fabricCanvas.getVpCenter().x,
    top: componentInfo.y || fabricCanvas.getVpCenter().y,
  });

  // Add component metadata that the wiring tool expects
  component.set("componentType", componentInfo.type); // This is what the wiring tool looks for!

  const componentId = `component_${Date.now()}`;
  component.set("componentData", {
    id: componentId,
    name: componentInfo.name,
    type: componentInfo.type,
    category: getCategoryForComponent(componentInfo.type),
    specifications: getDefaultSpecifications(componentInfo.type),
    availability: "in-stock" as const,
    properties: {
      manufacturer: "Generic",
      part_number: `${componentInfo.type.toUpperCase()}-001`,
      datasheet_url: null,
    },
    pins: [
      { id: "pin1", pinNumber: 1, name: "Pin 1", type: "generic" },
      { id: "pin2", pinNumber: 2, name: "Pin 2", type: "generic" },
    ],
  });

  // Legacy data field for backward compatibility
  component.set("data", {
    type: "component",
    componentType: componentInfo.type,
    componentName: componentInfo.name,
    pins: ["pin1", "pin2"],
  });

  // Make component selectable and movable
  component.set({
    selectable: true,
    evented: true,
    lockUniScaling: true,
    hasControls: true,
    hasBorders: true,
    centeredRotation: true, // Enable smooth rotation around center
  });

  // Add to canvas
  fabricCanvas.add(component);
  fabricCanvas.renderAll();

  console.log(`✅ ENHANCED: Added ${componentInfo.name} with functional pins!`);
};

// Function to recreate pins for pasted simple components
export const recreateSimpleComponentPins = (
  component: fabric.Group,
  fabricCanvas: fabric.Canvas
): fabric.Group => {
  if (!component || !fabricCanvas) return component;

  const componentData = (component as any).data;
  const componentType = (component as any).componentType;

  if (!componentData || componentData.type !== "component" || !componentType) {
    console.log("🔄 Not a simple component, skipping pin recreation");
    return component;
  }

  console.log(
    `🔄 Recreating simple pins for ${
      componentData.componentName || componentType
    }`
  );

  const style =
    componentStyles[componentType as keyof typeof componentStyles] ||
    componentStyles.resistor;
  const newComponentId = `component_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Get existing objects from the component (excluding old pins)
  const existingObjects = component.getObjects().filter((obj: any) => {
    // Keep everything except old pins
    return !obj.pin && !(obj.data && obj.data.type === "pin");
  });

  // Create new functional pins
  const pin1 = new fabric.Circle({
    radius: 5,
    fill: "#10B981",
    stroke: "#059669",
    strokeWidth: 2,
    originX: "center",
    originY: "center",
    left: -style.pinDistance,
    top: 0,
  });

  pin1.set("pin", true);
  pin1.set("data", {
    type: "pin",
    componentId: newComponentId,
    pinId: "pin1",
    pinNumber: 1,
    isConnectable: true,
  });

  const pin2 = new fabric.Circle({
    radius: 5,
    fill: "#10B981",
    stroke: "#059669",
    strokeWidth: 2,
    originX: "center",
    originY: "center",
    left: style.pinDistance,
    top: 0,
  });

  pin2.set("pin", true);
  pin2.set("data", {
    type: "pin",
    componentId: newComponentId,
    pinId: "pin2",
    pinNumber: 2,
    isConnectable: true,
  });

  // Create new component group with existing objects + new pins
  const newComponent = new fabric.Group([...existingObjects, pin1, pin2], {
    left: component.left,
    top: component.top,
    angle: component.angle,
    scaleX: component.scaleX,
    scaleY: component.scaleY,
  });

  // Restore component metadata with new ID
  newComponent.set("componentType", componentType);

  newComponent.set("componentData", {
    id: newComponentId,
    name: componentData.componentName || componentType,
    type: componentType,
    category: getCategoryForComponent(componentType),
    specifications: getDefaultSpecifications(componentType),
    availability: "in-stock" as const,
    properties: {
      manufacturer: "Generic",
      part_number: `${componentType.toUpperCase()}-001`,
      datasheet_url: null,
    },
    pins: [
      { id: "pin1", pinNumber: 1, name: "Pin 1", type: "generic" },
      { id: "pin2", pinNumber: 2, name: "Pin 2", type: "generic" },
    ],
  });

  // Legacy data field for backward compatibility
  newComponent.set("data", {
    type: "component",
    componentType: componentType,
    componentName: componentData.componentName,
    pins: ["pin1", "pin2"],
  });

  // Restore component properties
  newComponent.set({
    selectable: true,
    evented: true,
    lockUniScaling: true,
    hasControls: true,
    hasBorders: true,
    centeredRotation: true,
  });

  console.log(
    `✅ Simple pin recreation: Added functional pins to pasted component`
  );
  return newComponent;
};
