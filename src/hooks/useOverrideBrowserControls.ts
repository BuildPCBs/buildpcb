import { useEffect } from "react";

export function useOverrideBrowserControls() {
  useEffect(() => {
    // Prevent all default browser behaviors
    const preventDefaults = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Disable context menu globally
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable drag and drop
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable text selection on drag
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // Disable browser zoom/pan gestures
    const handleTouchStart = (e: TouchEvent) => {
      // Allow single touch, prevent multi-touch browser gestures
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Prevent browser pull-to-refresh and other gestures
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Disable keyboard shortcuts that interfere
    const handleKeyDown = (e: KeyboardEvent) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey;

      // Prevent browser zoom
      if (
        cmdOrCtrl &&
        (e.key === "+" || e.key === "-" || e.key === "=" || e.key === "0")
      ) {
        e.preventDefault();
      }

      // Prevent browser refresh
      if (cmdOrCtrl && e.key === "r") {
        e.preventDefault();
      }

      // Prevent browser back/forward
      if (
        e.key === "Backspace" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
      }

      // Prevent F5 refresh
      if (e.key === "F5") {
        e.preventDefault();
      }

      // Prevent space bar scrolling
      if (
        e.key === " " &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
      }
    };

    // Disable mouse wheel default behaviors - but allow canvas components to handle their own
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;

      // Allow canvas elements and their containers to handle their own wheel events
      if (
        target.tagName === "CANVAS" ||
        target.closest(".canvas-container") ||
        target.closest('[data-scrollable="false"]')
      ) {
        return; // Don't interfere with canvas wheel events
      }

      // Prevent browser zoom with Ctrl/Cmd + wheel on non-canvas elements
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }

      // Prevent page scrolling on non-scrollable elements
      const scrollableElement =
        target.closest('[data-scrollable="true"]') ||
        target.closest(".overflow-auto") ||
        target.closest(".overflow-y-auto") ||
        target.closest(".overflow-x-auto");

      if (!scrollableElement) {
        e.preventDefault();
      }
    };

    // Add all event listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("selectstart", handleSelectStart);
    document.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("wheel", handleWheel, { passive: false });

    // Prevent image dragging
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      img.draggable = false;
      img.addEventListener("dragstart", preventDefaults);
    });

    // Set CSS to disable selection and dragging
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    (document.body.style as any).webkitTouchCallout = "none";
    (document.body.style as any).webkitUserDrag = "none";

    // Cleanup
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("selectstart", handleSelectStart);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("wheel", handleWheel);

      // Reset CSS
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      (document.body.style as any).webkitTouchCallout = "";
      (document.body.style as any).webkitUserDrag = "";
    };
  }, []);
}
