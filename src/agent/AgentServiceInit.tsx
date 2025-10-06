"use client";

import { useEffect } from "react";

/**
 * AgentServiceInit - Ensures AgentService is loaded and window utilities are exposed
 * Must be included in the app for development testing access
 */
export function AgentServiceInit() {
  useEffect(() => {
    // Import AgentService to trigger window exposure
    import("./AgentService").then(({ agentService }) => {
      // Verify it's exposed
      if (
        typeof window !== "undefined" &&
        process.env.NODE_ENV === "development"
      ) {
        if ((window as any).agentService) {
          console.log("✅ AgentService ready for testing!");
          console.log(
            "📝 Try: await window.agentService.executeCapability('ADD_COMPONENT', 'Add a 555 timer')"
          );
        }
      }
    });
  }, []);

  return null; // This component renders nothing
}
