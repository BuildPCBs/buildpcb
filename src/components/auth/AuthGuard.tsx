"use client";

import { useAuth } from "@/hooks/useAuth";
import { AuthOverlay } from "./AuthOverlay";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthOverlayOpen, hideAuthOverlay } = useAuth();

  const handleAuthSuccess = () => {
    // Authentication success is automatically handled by the auth context
    hideAuthOverlay();
  };

  return (
    <>
      {children}
      <AuthOverlay
        isOpen={isAuthOverlayOpen}
        onClose={hideAuthOverlay}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}

interface AuthButtonProps {
  children: React.ReactNode;
  className?: string;
  requireAuth?: boolean;
  onClick?: () => void;
}

export function AuthButton({
  children,
  className = "",
  requireAuth = true,
  onClick,
}: AuthButtonProps) {
  const { isAuthenticated, showAuthOverlay } = useAuth();

  const handleClick = () => {
    if (requireAuth && !isAuthenticated) {
      showAuthOverlay();
    } else {
      onClick?.();
    }
  };

  return (
    <button className={className} onClick={handleClick}>
      {children}
    </button>
  );
}
