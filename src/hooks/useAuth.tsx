"use client";

import {
  useState,
  createContext,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { authStorage } from "@/lib/auth-storage";
import { logger } from "@/lib/logger";
import { AuthContextType, AuthUser } from "@/types/auth";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthOverlayOpen, setIsAuthOverlayOpen] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const getSession = async () => {
      try {
        // Set a timeout to prevent infinite loading
        const authTimeout = setTimeout(() => {
          console.warn("Auth loading timeout - proceeding without auth check");
          setIsLoading(false);
        }, 3000); // 3 second timeout

        // First check if we have a session in localStorage
        const hasStoredSession = authStorage.hasStoredSession();
        if (hasStoredSession) {
          logger.auth("Found stored session data");
          const userData = authStorage.getUser();
          logger.auth("Last login:", authStorage.getLastLogin());
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        clearTimeout(authTimeout); // Clear timeout if we get a response

        if (error) {
          console.error("Error getting session:", error);
          // Clear any invalid session data
          authStorage.removeUser();
        } else {
          setSession(session);
          setUser(session?.user || null);

          // Save additional user data to localStorage for quick access
          if (session?.user) {
            authStorage.setUser({
              id: session.user.id,
              email: session.user.email!,
              lastLogin: new Date().toISOString(),
            });
          }
        }
      } catch (error) {
        console.error("Error getting session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    getSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.auth("Auth state changed:", event, session?.user?.email);

      setSession(session);
      setUser(session?.user || null);
      setIsLoading(false);

      // Handle different auth events
      if (event === "SIGNED_IN" && session) {
        // Save user data to localStorage
        authStorage.setUser({
          id: session.user.id,
          email: session.user.email!,
          lastLogin: new Date().toISOString(),
        });

        // Close auth overlay on successful auth
        setIsAuthOverlayOpen(false);
        logger.auth("User signed in:", session.user.email);
      } else if (event === "SIGNED_OUT") {
        // Clear user data from localStorage
        authStorage.removeUser();
        logger.auth("User signed out");
      } else if (event === "TOKEN_REFRESHED") {
        logger.auth("Token refreshed for user:", session?.user?.email);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const showAuthOverlay = () => {
    setIsAuthOverlayOpen(true);
  };

  const hideAuthOverlay = () => {
    setIsAuthOverlayOpen(false);
  };

  const signInWithOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    return { error };
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    return { error };
  };

  const signOut = async () => {
    try {
      // Clear user data from localStorage first
      authStorage.removeUser();

      const { error } = await supabase.auth.signOut();

      if (!error) {
        // Ensure local state is cleared
        setUser(null);
        setSession(null);
        setIsAuthOverlayOpen(false);
      }

      return { error };
    } catch (error: any) {
      console.error("Error signing out:", error);
      return { error };
    }
  };

  // Legacy methods for backward compatibility
  const login = () => {
    // This is now handled by signInWithOtp + verifyOtp
    setIsAuthOverlayOpen(false);
  };

  const logout = async () => {
    const { error } = await signOut();
    return { error };
  };

  const isAuthenticated = !!user;

  // Get access token for API calls
  const getToken = async (): Promise<string | null> => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error || !session) {
        console.error("Error getting session for token:", error);
        return null;
      }
      return session.access_token;
    } catch (error) {
      console.error("Error getting access token:", error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated,
        isAuthOverlayOpen,
        isLoading,
        showAuthOverlay,
        hideAuthOverlay,
        signInWithOtp,
        verifyOtp,
        signOut,
        getToken,
        // Legacy methods for backward compatibility
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
