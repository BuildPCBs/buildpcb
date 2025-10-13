"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import * as fabric from "fabric";

export interface SelectedComponent {
  id: string;
  name: string;
  type: string;
  uid?: string;
  pins?: Array<{ number: string; name: string }>;
}

interface CanvasContextType {
  canvas: fabric.Canvas | null;
  isCanvasReady: boolean;
  selectedComponents: SelectedComponent[];
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    // Return safe defaults during SSR instead of throwing
    return {
      canvas: null,
      isCanvasReady: false,
      selectedComponents: [],
    };
  }
  return context;
}

interface CanvasProviderProps {
  children: ReactNode;
  canvas: fabric.Canvas | null;
  isReady?: boolean;
}

export function CanvasProvider({
  children,
  canvas,
  isReady = false,
}: CanvasProviderProps) {
  const [selectedComponents, setSelectedComponents] = useState<
    SelectedComponent[]
  >([]);

  // Listen to canvas selection events
  useEffect(() => {
    if (!canvas) {
      console.log(
        "⚠️ CanvasContext: No canvas available for selection tracking"
      );
      return;
    }

    console.log(
      "✅ CanvasContext: Setting up selection listeners on canvas",
      canvas
    );

    const extractComponentData = (
      obj: fabric.Object
    ): SelectedComponent | null => {
      const data = (obj as any).data;
      console.log(
        "🔍 Extracting component data from object:",
        obj,
        "data:",
        data
      );
      if (!data || data.type !== "component") {
        console.log("❌ Not a component, skipping");
        return null;
      }

      // Clean up component name by removing suffixes like _unit1, _unit2, etc.
      const rawName = data.componentName || data.name || "Unknown Component";
      const cleanName = rawName.replace(/_unit\d+$/i, "").replace(/_\d+$/i, "");

      const component = {
        id: (obj as any).id || "",
        name: cleanName,
        type: data.componentType || "generic",
        uid: data.componentMetadata?.uid,
        pins: data.pins || [],
      };
      console.log("✅ Extracted component:", component);
      return component;
    };

    const handleSelectionCreated = (e: any) => {
      console.log("🎯 Selection created event:", e);
      const selected = e.selected || [];
      console.log("🎯 Selected objects:", selected);
      const components = selected
        .map(extractComponentData)
        .filter(
          (comp: SelectedComponent | null): comp is SelectedComponent =>
            comp !== null
        );
      console.log("🎯 Extracted components:", components);
      setSelectedComponents(components);
    };

    const handleSelectionUpdated = (e: any) => {
      console.log("🎯 Selection updated event:", e);
      const selected = e.selected || [];
      console.log("🎯 Selected objects:", selected);
      const components = selected
        .map(extractComponentData)
        .filter(
          (comp: SelectedComponent | null): comp is SelectedComponent =>
            comp !== null
        );
      console.log("🎯 Extracted components:", components);
      setSelectedComponents(components);
    };

    const handleSelectionCleared = () => {
      console.log("🎯 Selection cleared");
      setSelectedComponents([]);
    };

    canvas.on("selection:created", handleSelectionCreated);
    canvas.on("selection:updated", handleSelectionUpdated);
    canvas.on("selection:cleared", handleSelectionCleared);

    console.log("✅ Selection event listeners registered");

    // Test if events are working by adding a simple mouse:down listener
    const testMouseDown = () => {
      console.log("🖱️ Mouse down on canvas");
    };
    canvas.on("mouse:down", testMouseDown);

    return () => {
      console.log("🧹 Cleaning up selection listeners");
      canvas.off("selection:created", handleSelectionCreated);
      canvas.off("selection:updated", handleSelectionUpdated);
      canvas.off("selection:cleared", handleSelectionCleared);
      canvas.off("mouse:down", testMouseDown);
    };
  }, [canvas]);

  const value: CanvasContextType = {
    canvas,
    isCanvasReady: isReady && canvas !== null,
    selectedComponents,
  };

  return (
    <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>
  );
}
