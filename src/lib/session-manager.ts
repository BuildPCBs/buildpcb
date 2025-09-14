import { supabase } from "./supabase";
import { authStorage } from "./auth-storage";
import { logger } from "./logger";

/**
 * Session management utilities
 */
export const sessionManager = {
  /**
   * Manually refresh the current session
   */
  refreshSession: async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("Failed to refresh session:", error);
        authStorage.removeUser();
        return { success: false, error };
      }

      if (data.session) {
        logger.api("Session refreshed successfully");
        return { success: true, session: data.session };
      }

      return { success: false, error: "No session returned" };
    } catch (error) {
      console.error("Error refreshing session:", error);
      return { success: false, error };
    }
  },

  /**
   * Check if current session is valid
   */
  validateSession: async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Session validation error:", error);
        return { valid: false, error };
      }

      return {
        valid: !!session,
        session,
        expiresAt: session?.expires_at,
      };
    } catch (error) {
      console.error("Error validating session:", error);
      return { valid: false, error };
    }
  },

  /**
   * Check if session will expire soon (within 5 minutes)
   */
  isSessionExpiringSoon: async () => {
    const { valid, session } = await sessionManager.validateSession();

    if (!valid || !session?.expires_at) return false;

    const expiresAt = new Date(session.expires_at * 1000);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    return expiresAt <= fiveMinutesFromNow;
  },

  /**
   * Automatically refresh session if it's expiring soon
   */
  autoRefreshIfNeeded: async () => {
    const expiringSoon = await sessionManager.isSessionExpiringSoon();

    if (expiringSoon) {
      logger.api("Session expiring soon, auto-refreshing...");
      return await sessionManager.refreshSession();
    }

    return { success: true, message: "No refresh needed" };
  },
};

export default sessionManager;
