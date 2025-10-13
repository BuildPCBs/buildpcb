import { useEffect } from "react";
import * as fabric from "fabric";

export function useCanvasZoom(canvas: fabric.Canvas | null) {
  useEffect(() => {
    if (!canvas) return;

    const handleWheel = (opt: fabric.TEvent) => {
      // Prevent default browser zoom action FIRST
      opt.e.preventDefault();
      opt.e.stopPropagation();

      const event = opt.e as WheelEvent;
      const delta = event.deltaY;
      let zoom = canvas.getZoom();

      // Calculate new zoom level
      zoom *= 0.999 ** delta;

      // Apply zoom limits
      if (zoom > 20) zoom = 20;
      if (zoom < 0.1) zoom = 0.1;

      // Get the point in canvas space (accounting for current viewport transform)
      // This ensures zoom happens at the cursor position, not the canvas center
      const point = new fabric.Point(event.offsetX, event.offsetY);

      // Zoom to the point where the cursor is
      canvas.zoomToPoint(point, zoom);
    };

    // Add event listener
    canvas.on("mouse:wheel", handleWheel);

    // Cleanup function
    return () => {
      canvas.off("mouse:wheel", handleWheel);
    };
  }, [canvas]);
}
