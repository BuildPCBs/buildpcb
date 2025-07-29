import { useCallback, useRef } from "react";

export interface MouseState {
  x: number;
  y: number;
  isDragging: boolean;
  isMiddleClick: boolean;
  isRightClick: boolean;
}

export interface CanvasInteraction {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function useCanvasInteraction(
  onPan?: (deltaX: number, deltaY: number) => void,
  onZoom?: (delta: number, x: number, y: number) => void,
  onSelect?: (x: number, y: number) => void
): CanvasInteraction {
  const mouseState = useRef<MouseState>({
    x: 0,
    y: 0,
    isDragging: false,
    isMiddleClick: false,
    isRightClick: false,
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    mouseState.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      isDragging: true,
      isMiddleClick: e.button === 1,
      isRightClick: e.button === 2,
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      if (!mouseState.current.isDragging) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;

      const deltaX = newX - mouseState.current.x;
      const deltaY = newY - mouseState.current.y;

      // Pan with middle mouse or right mouse
      if (mouseState.current.isMiddleClick || mouseState.current.isRightClick) {
        onPan?.(deltaX, deltaY);
      }

      mouseState.current.x = newX;
      mouseState.current.y = newY;
    },
    [onPan]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      // Handle selection on left click (not drag)
      if (
        !mouseState.current.isMiddleClick &&
        !mouseState.current.isRightClick
      ) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Only select if mouse didn't move much (not a drag)
        const deltaX = Math.abs(x - mouseState.current.x);
        const deltaY = Math.abs(y - mouseState.current.y);

        if (deltaX < 5 && deltaY < 5) {
          onSelect?.(x, y);
        }
      }

      mouseState.current.isDragging = false;
    },
    [onSelect]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      onZoom?.(-e.deltaY / 1000, x, y);
    },
    [onZoom]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); // Disable right-click context menu
  }, []);

  return {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onWheel: handleWheel,
    onContextMenu: handleContextMenu,
  };
}
