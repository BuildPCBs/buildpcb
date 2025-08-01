import { useEffect } from "react";
import * as fabric from "fabric";

export function useCanvasZoom(canvas: fabric.Canvas | null) {
  useEffect(() => {
    if (!canvas) return;

    const handleWheel = (opt: fabric.TEvent) => {
      // Prevent default browser zoom action FIRST
      opt.e.preventDefault();
      opt.e.stopPropagation();

      const delta = (opt.e as WheelEvent).deltaY;
      let zoom = canvas.getZoom();

      // Calculate new zoom level
      zoom *= 0.999 ** delta;

      // Apply zoom limits
      if (zoom > 20) zoom = 20;
      if (zoom < 0.1) zoom = 0.1;

      // Get mouse position for zoom center
      const pointer = canvas.getPointer(opt.e as MouseEvent);

      // Zoom to point (centered on mouse cursor)
      canvas.zoomToPoint(new fabric.Point(pointer.x, pointer.y), zoom);
    };

    // Add event listener
    canvas.on("mouse:wheel", handleWheel);

    // Cleanup function
    return () => {
      canvas.off("mouse:wheel", handleWheel);
    };
  }, [canvas]);
}
