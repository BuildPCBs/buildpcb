"use client";

import { useAuth } from "@/hooks/useAuth";
import { AuthOverlay } from "./AuthOverlay";

export function AuthOverlayWrapper() {
  const { isAuthOverlayOpen, hideAuthOverlay } = useAuth();

  const handleAuthSuccess = () => {
    // Authentication success is automatically handled by the auth context
    hideAuthOverlay();
  };

  return (
    <AuthOverlay
      isOpen={isAuthOverlayOpen}
      onClose={hideAuthOverlay}
      onSuccess={handleAuthSuccess}
    />
  );
}
