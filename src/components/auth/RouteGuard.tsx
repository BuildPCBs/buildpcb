"use client";

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePathname } from 'next/navigation';

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

// List of routes that require authentication
const PROTECTED_ROUTES = [
  '/', // IDE route - main application
  '/dashboard',
  '/profile', 
  '/projects',
  '/settings',
  '/test', // Test pages require auth
  '/fabric-test' // Development test pages require auth
];

// List of public routes that don't require auth
const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/about',
  '/contact',
  '/forgot-password',
  '/reset-password'
];

export function RouteGuard({ 
  children, 
  requireAuth = true,
  redirectTo 
}: RouteGuardProps) {
  const { isAuthenticated, isLoading, showAuthOverlay } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    // Don't wait for loading to complete - check auth in the background
    const checkAuth = () => {
      // Check if current route requires authentication
      const isProtectedRoute = PROTECTED_ROUTES.some(route => 
        pathname.startsWith(route)
      );
      
      // Check if it's the IDE route (any path that's not explicitly public)
      const isIDERoute = !PUBLIC_ROUTES.some(route => 
        pathname === route || pathname.startsWith(route)
      );

      const isPublicRoute = PUBLIC_ROUTES.some(route => 
        pathname === route || pathname.startsWith(route)
      );

      // If it's a protected route or IDE route and user is not authenticated
      if ((requireAuth || isProtectedRoute || isIDERoute) && !isPublicRoute && !isAuthenticated && !isLoading) {
        console.log('Protected/IDE route accessed without auth:', pathname);
        showAuthOverlay();
      }
    };

    // Check immediately if not loading, or after a short delay if loading
    if (!isLoading) {
      checkAuth();
    } else {
      const timer = setTimeout(checkAuth, 1000); // Check after 1 second even if still loading
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, pathname, requireAuth, showAuthOverlay]);

  // Always render children - don't block on loading
  return <>{children}</>;
}

export default RouteGuard;
