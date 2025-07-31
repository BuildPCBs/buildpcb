"use client";

import { useState, createContext, useContext, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthOverlayOpen: boolean;
  showAuthOverlay: () => void;
  hideAuthOverlay: () => void;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthOverlayOpen, setIsAuthOverlayOpen] = useState(false);

  const showAuthOverlay = () => {
    setIsAuthOverlayOpen(true);
  };

  const hideAuthOverlay = () => {
    setIsAuthOverlayOpen(false);
  };

  const login = () => {
    setIsAuthenticated(true);
    setIsAuthOverlayOpen(false);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAuthOverlayOpen,
        showAuthOverlay,
        hideAuthOverlay,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
