"use client";

import { useAuth } from "@/hooks/useAuth";
import { AuthOverlay } from "./AuthOverlay";

export function AuthOverlayWrapper() {
  const { isAuthOverlayOpen, hideAuthOverlay, login } = useAuth();

  return (
    <AuthOverlay
      isOpen={isAuthOverlayOpen}
      onClose={hideAuthOverlay}
      onSuccess={login}
    />
  );
}
