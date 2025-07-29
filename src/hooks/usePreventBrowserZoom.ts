import { useEffect } from "react";

export function usePreventBrowserZoom() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Cmd/Ctrl + Plus/Minus/0 (browser zoom)
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "+" ||
          e.key === "-" ||
          e.key === "=" ||
          e.key === "0" ||
          e.code === "Minus" ||
          e.code === "Equal" ||
          e.code === "Digit0")
      ) {
        e.preventDefault();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Prevent Ctrl/Cmd + Wheel (browser zoom)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("wheel", handleWheel, { passive: false });

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("wheel", handleWheel);
    };
  }, []);
}
