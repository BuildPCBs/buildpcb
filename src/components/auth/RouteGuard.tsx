"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

// List of public routes that don't require auth (everything else is protected)
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/about",
  "/contact",
  "/forgot-password",
  "/reset-password",
];

export function RouteGuard({
  children,
  requireAuth = true,
  redirectTo,
}: RouteGuardProps) {
  const { isAuthenticated, isLoading, showAuthOverlay } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    // Don't check auth while still loading
    if (isLoading) return;

    // Check if current route is explicitly public
    const isPublicRoute = PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route)
    );

    // Skip auth check for public routes only
    if (isPublicRoute) return;

    // ALL other routes require authentication (this is an IDE)
    if (!isAuthenticated) {
      console.log("Protected IDE route accessed without auth:", pathname);
      showAuthOverlay();
    }
  }, [isAuthenticated, isLoading, pathname, requireAuth, showAuthOverlay]);

  // Always render children - auth overlay will handle blocking
  return <>{children}</>;
}

export default RouteGuard;
