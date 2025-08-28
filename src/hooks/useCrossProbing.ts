"use client";

import { useEffect, useCallback, useRef } from "react";
import * as fabric from "fabric";
import { SharedComponent } from "@/contexts/ViewContext";

export interface CrossProbingOptions {
  enabled: boolean;
  highlightColor: string;
  highlightDuration: number;
  zoomFactor: number;
  animationDuration: number;
}

export interface CrossProbingHooks {
  onComponentHover: (componentId: string | null) => void;
  onComponentClick: (componentId: string) => void;
  onConnectionHover: (connectionId: string | null) => void;
}

export function useCrossProbing(
  canvas: fabric.Canvas | null,
  components: SharedComponent[],
  options: Partial<CrossProbingOptions> = {},
  hooks: Partial<CrossProbingHooks> = {}
) {
  const highlightOverlay = useRef<fabric.Rect | null>(null);
  const animationFrame = useRef<number | null>(null);

  const defaultOptions: CrossProbingOptions = {
    enabled: true,
    highlightColor: "rgba(74, 144, 226, 0.3)",
    highlightDuration: 2000,
    zoomFactor: 1.5,
    animationDuration: 300,
    ...options,
  };

  // Create highlight overlay for component emphasis
  const createHighlightOverlay = useCallback(
    (bounds: fabric.TBBox) => {
      if (!canvas) return null;

      const overlay = new fabric.Rect({
        left: bounds.left - 10,
        top: bounds.top - 10,
        width: bounds.width + 20,
        height: bounds.height + 20,
        fill: defaultOptions.highlightColor,
        stroke: "#4A90E2",
        strokeWidth: 2,
        rx: 8,
        ry: 8,
        selectable: false,
        evented: false,
        opacity: 0,
      });

      return overlay;
    },
    [canvas, defaultOptions.highlightColor]
  );

  // Smooth animation for highlighting
  const animateHighlight = useCallback(
    (overlay: fabric.Rect, show: boolean) => {
      if (!canvas) return;

      const startOpacity = show ? 0 : 1;
      const endOpacity = show ? 1 : 0;
      const duration = defaultOptions.animationDuration;
      let startTime: number | null = null;

      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentOpacity =
          startOpacity + (endOpacity - startOpacity) * easeProgress;

        overlay.set("opacity", currentOpacity);
        canvas.renderAll();

        if (progress < 1) {
          animationFrame.current = requestAnimationFrame(animate);
        } else if (!show) {
          canvas.remove(overlay);
          canvas.renderAll();
        }
      };

      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      animationFrame.current = requestAnimationFrame(animate);
    },
    [canvas, defaultOptions.animationDuration]
  );

  // Highlight a component with visual feedback
  const highlightComponent = useCallback(
    (componentId: string) => {
      if (!canvas || !defaultOptions.enabled) return;

      // Find the component object on canvas
      const componentObject = canvas
        .getObjects()
        .find(
          (obj: any) =>
            obj.sharedComponentId === componentId ||
            obj.componentId === componentId
        );

      if (!componentObject) {
        console.warn(
          `Component ${componentId} not found on canvas for highlighting`
        );
        return;
      }

      // Remove previous highlight
      if (highlightOverlay.current) {
        canvas.remove(highlightOverlay.current);
      }

      // Create new highlight overlay
      const bounds = componentObject.getBoundingRect();
      const overlay = createHighlightOverlay(bounds);

      if (overlay) {
        highlightOverlay.current = overlay;
        canvas.add(overlay);
        animateHighlight(overlay, true);

        // Auto-remove highlight after duration
        setTimeout(() => {
          if (highlightOverlay.current === overlay) {
            animateHighlight(overlay, false);
            highlightOverlay.current = null;
          }
        }, defaultOptions.highlightDuration);
      }
    },
    [
      canvas,
      components,
      defaultOptions,
      createHighlightOverlay,
      animateHighlight,
    ]
  );

  // Smart zoom to component with padding
  const zoomToComponent = useCallback(
    (componentId: string) => {
      if (!canvas || !defaultOptions.enabled) return;

      const componentObject = canvas
        .getObjects()
        .find(
          (obj: any) =>
            obj.sharedComponentId === componentId ||
            obj.componentId === componentId
        );

      if (!componentObject) return;

      const bounds = componentObject.getBoundingRect();
      const padding = 100; // Padding around the component

      // Calculate zoom to fit component with padding
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const zoomX = canvasWidth / (bounds.width + padding * 2);
      const zoomY = canvasHeight / (bounds.height + padding * 2);
      const targetZoom = Math.min(zoomX, zoomY, defaultOptions.zoomFactor);

      // Calculate center point
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;

      // Animate zoom and pan
      const currentZoom = canvas.getZoom();
      const currentVpTransform = canvas.viewportTransform!;

      const targetVpTransform = [
        targetZoom,
        0,
        0,
        targetZoom,
        canvasWidth / 2 - centerX * targetZoom,
        canvasHeight / 2 - centerY * targetZoom,
      ];

      // Smooth zoom animation
      const duration = defaultOptions.animationDuration;
      let startTime: number | null = null;

      const animateZoom = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        // Interpolate zoom and transform
        const currentZoomInterp =
          currentZoom + (targetZoom - currentZoom) * easeProgress;
        const interpolatedTransform = currentVpTransform.map(
          (val, index) => val + (targetVpTransform[index] - val) * easeProgress
        );

        canvas.setZoom(currentZoomInterp);
        canvas.setViewportTransform(
          interpolatedTransform as [
            number,
            number,
            number,
            number,
            number,
            number
          ]
        );
        canvas.renderAll();

        if (progress < 1) {
          requestAnimationFrame(animateZoom);
        }
      };

      requestAnimationFrame(animateZoom);
    },
    [canvas, defaultOptions]
  );

  // Combined highlight and zoom for maximum visual impact
  const emphasizeComponent = useCallback(
    (componentId: string, includeZoom: boolean = false) => {
      highlightComponent(componentId);
      if (includeZoom) {
        setTimeout(() => zoomToComponent(componentId), 100);
      }
      hooks.onComponentClick?.(componentId);
    },
    [highlightComponent, zoomToComponent, hooks]
  );

  // Set up canvas event listeners for cross-probing
  useEffect(() => {
    if (!canvas || !defaultOptions.enabled) return;

    const handleMouseOver = (e: any) => {
      const target = e.target;
      if (!target) return;

      const componentId =
        (target as any).sharedComponentId || (target as any).componentId;
      if (componentId) {
        hooks.onComponentHover?.(componentId);
        canvas.defaultCursor = "pointer";
      }
    };

    const handleMouseOut = (e: any) => {
      hooks.onComponentHover?.(null);
      canvas.defaultCursor = "default";
    };

    const handleMouseDown = (e: any) => {
      const target = e.target;
      if (!target) return;

      const componentId =
        (target as any).sharedComponentId || (target as any).componentId;
      if (componentId) {
        emphasizeComponent(componentId, false);
      }
    };

    // Add event listeners
    canvas.on("mouse:over", handleMouseOver);
    canvas.on("mouse:out", handleMouseOut);
    canvas.on("mouse:down", handleMouseDown);

    // Cleanup
    return () => {
      canvas.off("mouse:over", handleMouseOver);
      canvas.off("mouse:out", handleMouseOut);
      canvas.off("mouse:down", handleMouseDown);
    };
  }, [canvas, defaultOptions.enabled, emphasizeComponent, hooks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (highlightOverlay.current && canvas) {
        canvas.remove(highlightOverlay.current);
      }
    };
  }, [canvas]);

  return {
    highlightComponent,
    zoomToComponent,
    emphasizeComponent,
    isEnabled: defaultOptions.enabled,
  };
}
