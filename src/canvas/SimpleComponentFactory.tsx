import * as fabric from "fabric";

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
