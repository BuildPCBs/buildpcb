"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import Konva from "konva";

export interface SelectedComponent {
  id: string;
  name: string;
  type: string;
  uid?: string;
  pins?: Array<{ number: string; name: string }>;
}

interface CanvasContextType {
  canvas: Konva.Stage | null;
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
  canvas: Konva.Stage | null;
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
      node: Konva.Node
    ): SelectedComponent | null => {
      // Traverse up to find the component group
      let current: Konva.Node | null = node;
      let componentGroup: Konva.Group | null = null;

      while (current) {
        if ((current as any).data && (current as any).data.componentId) {
          componentGroup = current as Konva.Group;
          break;
        }
        current = current.getParent();
      }

      if (!componentGroup) {
        return null;
      }

      const data = (componentGroup as any).data;
      // In Konva implementation, we might need to fetch more data or store it on the node
      // For now, we extract what we can from the node's custom data
      console.log(
        "🔍 Extracting component data from node:",
        componentGroup,
        "data:",
        data
      );

      return {
        id: data.componentId,
        name: data.componentName || "Unknown Component",
        type: data.componentType || "generic",
        uid: data.uid,
        pins: [], // function to extract pins if needed
      };
    };

    const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
      // If clicked on empty stage (target is stage or layer), clear selection
      if (
        e.target === canvas ||
        (e.target instanceof Konva.Layer &&
          e.target === canvas.getLayers()[0]) ||
        e.target.name() === "grid-background"
      ) {
        console.log("🎯 Selection cleared");
        setSelectedComponents([]);
        return;
      }

      // Try to find component
      const component = extractComponentData(e.target);
      if (component) {
        console.log("🎯 Selected component:", component);
        setSelectedComponents([component]);
      } else {
        console.log("🎯 Clicked on non-component object");
        setSelectedComponents([]);
      }
    };

    canvas.on("click tap", handleStageClick);

    console.log("✅ Selection event listeners registered");

    return () => {
      console.log("🧹 Cleaning up selection listeners");
      canvas.off("click tap", handleStageClick);
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
