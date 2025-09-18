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
  buzzer: "/components/buzzer.svg",
  "display-lcd": "/components/display-lcd.svg",
  fuse: "/components/fuse.svg",
  microcontroller: "/components/microcontroller.svg",
  "photo-resistor": "/components/photo-resistor.svg",
  potentiometer: "/components/potentiometer.svg",
  relay: "/components/relay.svg",
  "servo-motor": "/components/servo-motor.svg",
  "temperature-sensor": "/components/temperature-sensor.svg",
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
  buzzer: { width: 45, height: 45, pinDistance: 25, pinCount: 2 },
  "display-lcd": { width: 80, height: 60, pinDistance: 45, pinCount: 16 },
  fuse: { width: 50, height: 20, pinDistance: 30, pinCount: 2 },
  microcontroller: { width: 100, height: 70, pinDistance: 55, pinCount: 16 },
  "photo-resistor": { width: 60, height: 40, pinDistance: 35, pinCount: 2 },
  potentiometer: { width: 50, height: 50, pinDistance: 30, pinCount: 3 },
  relay: { width: 70, height: 50, pinDistance: 40, pinCount: 8 },
  "servo-motor": { width: 70, height: 50, pinDistance: 40, pinCount: 3 },
  "temperature-sensor": { width: 45, height: 40, pinDistance: 28, pinCount: 3 },
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
  } else if (config.pinCount === 8) {
    // Eight pins: 4 on each side (for op-amps, relays)
    for (let i = 0; i < 4; i++) {
      // Left side pins
      const leftPin = new fabric.Circle({
        radius: 3,
        fill: "#10B981",
        stroke: "#059669",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        left: -config.width / 2 - 5,
        top: -config.height / 3 + (i * config.height) / 4,
      });
      leftPin.set("pin", true);
      leftPin.set("data", {
        type: "pin",
        componentId,
        pinId: `pin${i + 1}`,
        pinNumber: i + 1,
      });

      // Right side pins
      const rightPin = new fabric.Circle({
        radius: 3,
        fill: "#10B981",
        stroke: "#059669",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        left: config.width / 2 + 5,
        top: -config.height / 3 + (i * config.height) / 4,
      });
      rightPin.set("pin", true);
      rightPin.set("data", {
        type: "pin",
        componentId,
        pinId: `pin${i + 5}`,
        pinNumber: i + 5,
      });

      pins.push(leftPin, rightPin);
    }
  } else if (config.pinCount === 16) {
    // Sixteen pins: 8 on each side (for microcontrollers, LCD displays)
    for (let i = 0; i < 8; i++) {
      // Left side pins
      const leftPin = new fabric.Circle({
        radius: 2.5,
        fill: "#10B981",
        stroke: "#059669",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        left: -config.width / 2 - 5,
        top: -config.height / 2 + 5 + (i * (config.height - 10)) / 7,
      });
      leftPin.set("pin", true);
      leftPin.set("data", {
        type: "pin",
        componentId,
        pinId: `pin${i + 1}`,
        pinNumber: i + 1,
      });

      // Right side pins
      const rightPin = new fabric.Circle({
        radius: 2.5,
        fill: "#10B981",
        stroke: "#059669",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        left: config.width / 2 + 5,
        top: -config.height / 2 + 5 + (i * (config.height - 10)) / 7,
      });
      rightPin.set("pin", true);
      rightPin.set("data", {
        type: "pin",
        componentId,
        pinId: `pin${i + 9}`,
        pinNumber: i + 9,
      });

      pins.push(leftPin, rightPin);
    }
  } else if (config.pinCount === 20) {
    // Twenty pins: Arduino-style layout with pins around the perimeter
    for (let i = 0; i < 10; i++) {
      // Left side pins
      const leftPin = new fabric.Circle({
        radius: 2,
        fill: "#10B981",
        stroke: "#059669",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        left: -config.width / 2 - 5,
        top: -config.height / 2 + 5 + (i * (config.height - 10)) / 9,
      });
      leftPin.set("pin", true);
      leftPin.set("data", {
        type: "pin",
        componentId,
        pinId: `pin${i + 1}`,
        pinNumber: i + 1,
      });

      // Right side pins
      const rightPin = new fabric.Circle({
        radius: 2,
        fill: "#10B981",
        stroke: "#059669",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        left: config.width / 2 + 5,
        top: -config.height / 2 + 5 + (i * (config.height - 10)) / 9,
      });
      rightPin.set("pin", true);
      rightPin.set("data", {
        type: "pin",
        componentId,
        pinId: `pin${i + 11}`,
        pinNumber: i + 11,
      });

      pins.push(leftPin, rightPin);
    }
  }
  // Default fallback for other pin counts - create pins in a grid pattern
  else if (config.pinCount > 3) {
    const pinsPerSide = Math.ceil(config.pinCount / 2);
    for (let i = 0; i < config.pinCount; i++) {
      const isLeftSide = i < pinsPerSide;
      const sideIndex = isLeftSide ? i : i - pinsPerSide;

      const pin = new fabric.Circle({
        radius: 3,
        fill: "#10B981",
        stroke: "#059669",
        strokeWidth: 1,
        originX: "center",
        originY: "center",
        left: isLeftSide ? -config.width / 2 - 5 : config.width / 2 + 5,
        top:
          -config.height / 2 +
          10 +
          (sideIndex * (config.height - 20)) / (pinsPerSide - 1),
      });
      pin.set("pin", true);
      pin.set("data", {
        type: "pin",
        componentId,
        pinId: `pin${i + 1}`,
        pinNumber: i + 1,
      });
      pins.push(pin);
    }
  }

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

  // Load SVG with Fabric.js 6.0.0+ syntax
  fetch(svgPath)
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
            `❌ SVG: No valid objects in ${svgPath}, falling back to simple component`
          );
          createFallbackComponent(
            fabricCanvas,
            componentInfo,
            config,
            componentId
          );
          return;
        }

        console.log(
          `✅ SVG: Loaded ${objects.length} SVG objects for ${componentInfo.name}`
        );

        // Restore proper SVG styling that may have been stripped
        objects.forEach((obj, index) => {
          console.log(
            `🎨 Processing SVG object ${index}: type=${obj.type}, fill=${obj.fill}, stroke=${obj.stroke}`
          );

          // For path elements, preserve fill: 'none' if it should be transparent
          if (obj.type === "path") {
            obj.set("fill", "none");
            obj.set("stroke", obj.stroke || "#000000");
            obj.set("strokeWidth", obj.strokeWidth || 1.5);
          }
          // For line elements, ensure they have proper stroke
          else if (obj.type === "line") {
            obj.set("fill", "none");
            obj.set("stroke", obj.stroke || "#000000");
            obj.set("strokeWidth", obj.strokeWidth || 1.5);
          }
          // For circle elements (connection points), keep fill
          else if (obj.type === "circle") {
            obj.set("fill", obj.fill || "#000000");
            obj.set("stroke", obj.stroke || "#000000");
          }
          // For text elements, ensure they are visible
          else if (obj.type === "text") {
            obj.set("fill", obj.fill || "#000000");
          }
          // For rect elements, set appropriate styling
          else if (obj.type === "rect") {
            if (!obj.fill || obj.fill === "none") {
              obj.set("fill", "none");
              obj.set("stroke", obj.stroke || "#000000");
              obj.set("strokeWidth", obj.strokeWidth || 1);
            }
          }

          console.log(
            `✅ After processing: fill=${obj.fill}, stroke=${obj.stroke}, strokeWidth=${obj.strokeWidth}`
          );
        });

        // Create SVG group from the loaded objects
        const svgGroup = new fabric.Group(objects, {
          originX: "center",
          originY: "center",
        });

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
        createFallbackComponent(
          fabricCanvas,
          componentInfo,
          config,
          componentId
        );
      }
    })
    .catch((error) => {
      console.error(`❌ SVG: Failed to load ${svgPath}:`, error);
      createFallbackComponent(fabricCanvas, componentInfo, config, componentId);
    });
};

// Function to recreate pins for pasted components
export const recreateComponentPins = (
  component: fabric.Group,
  fabricCanvas: fabric.Canvas
): fabric.Group => {
  if (!component || !fabricCanvas) return component;

  const componentData = (component as any).data;
  const componentType = (component as any).componentType;

  if (!componentData || componentData.type !== "component" || !componentType) {
    console.log("🔄 Not a component, skipping pin recreation");
    return component;
  }

  console.log(
    `🔄 Recreating pins for ${componentData.componentName || componentType}`
  );

  const config =
    componentConfig[componentType as keyof typeof componentConfig] ||
    componentConfig.resistor;

  // CRITICAL FIX: Preserve original component ID for pin consistency
  // This ensures electrical connections are maintained during copy/paste
  const originalComponentId =
    (component as any).id || componentData.componentId;
  const newComponentId =
    originalComponentId ||
    `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Get existing objects from the component (excluding old pins)
  const existingObjects = component.getObjects().filter((obj: any) => {
    // Keep everything except old pins
    return !obj.pin && !(obj.data && obj.data.type === "pin");
  });

  // Create new functional pins with preserved metadata
  const newPins = createComponentPins(config, newComponentId);

  // Create new component group with existing objects + new pins
  const newComponent = new fabric.Group([...existingObjects, ...newPins], {
    left: component.left,
    top: component.top,
    angle: component.angle,
    scaleX: component.scaleX,
    scaleY: component.scaleY,
  });

  // Restore component metadata with preserved ID
  newComponent.set("componentType", componentType);
  newComponent.set("id", newComponentId); // Preserve original ID
  newComponent.set("data", {
    type: "component",
    componentType: componentType,
    componentName: componentData.componentName,
    componentId: newComponentId, // Preserve original ID
    pins: newPins.map((_, index) => `pin${index + 1}`),
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

  // Add hover event handlers to show/hide pins
  console.log(`🎯 Setting up pin hover handlers for SVG component`);

  // Function to show pins on component hover
  const showPins = () => {
    newPins.forEach((pin) => {
      pin.set({
        visible: true,
        opacity: 1,
        evented: true,
      });
    });
    fabricCanvas.renderAll();
  };

  // Function to hide pins when not hovering
  const hidePins = () => {
    newPins.forEach((pin) => {
      pin.set({
        visible: false,
        opacity: 0,
        evented: false,
      });
    });
    fabricCanvas.renderAll();
  };

  // Add hover event handlers to the component group
  newComponent.on("mouseover", showPins);
  newComponent.on("mouseout", hidePins);

  // Also add hover handlers to individual pins
  newPins.forEach((pin) => {
    pin.on("mouseover", showPins);
    pin.on("mouseout", (e: any) => {
      const pointer = fabricCanvas.getPointer(e.e);
      const componentBounds = newComponent.getBoundingRect();
      const isOverComponent =
        pointer.x >= componentBounds.left &&
        pointer.x <= componentBounds.left + componentBounds.width &&
        pointer.y >= componentBounds.top &&
        pointer.y <= componentBounds.top + componentBounds.height;

      if (!isOverComponent) {
        hidePins();
      }
    });
  });

  console.log(
    `✅ Pin recreation: Added ${newPins.length} functional pins to pasted component (ID preserved: ${newComponentId})`
  );
  return newComponent;
}; // Fallback to simple component if SVG loading fails
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
