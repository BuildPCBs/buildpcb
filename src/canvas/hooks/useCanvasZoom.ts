import { useEffect } from "react";
import Konva from "konva";

export function useCanvasZoom(stage: Konva.Stage | null) {
  useEffect(() => {
    if (!stage) return;

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
      // Prevent default browser zoom action FIRST
      e.evt.preventDefault();
      e.evt.stopPropagation();

      const event = e.evt;
      const delta = event.deltaY;
      let zoom = stage.scaleX(); // Use scaleX as zoom level

      // Calculate new zoom level
      zoom *= 0.999 ** delta;

      // Apply zoom limits
      if (zoom > 20) zoom = 20;
      if (zoom < 0.1) zoom = 0.1;

      // Get the point in stage space (accounting for current position)
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Zoom to the point where the cursor is
      const oldScale = stage.scaleX();
      const newScale = zoom;

      // Calculate the new position to zoom towards the pointer
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      stage.scale({ x: newScale, y: newScale });

      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };

      stage.position(newPos);
      stage.batchDraw();
    };

    // Add event listener
    stage.on("wheel", handleWheel);

    // Cleanup function
    return () => {
      stage.off("wheel", handleWheel);
    };
  }, [stage]);
}
