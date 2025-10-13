"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthOverlay } from "@/components/auth/AuthOverlay";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
      return;
    }

    // If not loading and not authenticated, show auth overlay
    if (!isLoading && !isAuthenticated) {
      setIsAuthOpen(true);
    }
  }, [isAuthenticated, isLoading, router]);

  const handleAuthSuccess = () => {
    // Redirect to dashboard or intended page after successful auth
    router.push("/dashboard");
  };

  const handleAuthClose = () => {
    // If user closes auth without completing, redirect to home
    router.push("/");
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-gray-900 mb-4">BuildPCBs</h1>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center">
      {/* The auth overlay will appear centered on this white background */}
      <AuthOverlay
        isOpen={isAuthOpen}
        onClose={handleAuthClose}
        onSuccess={handleAuthSuccess}
      />

      {/* Optional: Add some branding or loading state when auth is not open */}
      {!isAuthOpen && (
        <div className="text-center">
          <h1 className="text-2xl text-gray-900 mb-4">BuildPCBs</h1>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      )}
    </div>
  );
}
