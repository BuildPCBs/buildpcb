import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create Supabase client with anon key for user token verification
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AuthenticatedUser {
  id: string;
  email: string;
  aud: string;
  role?: string;
}

/**
 * Authenticate API request using Authorization header
 * Returns user data if authenticated, null if not
 */
export async function authenticateApiRequest(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  try {
    // Get Authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.api("Missing or invalid Authorization header");
      return null;
    }

    // Extract token
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      logger.api("No token provided");
      return null;
    }

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.api("Invalid token:", error?.message);
      return null;
    }

    logger.api("User authenticated:", user.email);

    return {
      id: user.id,
      email: user.email || "",
      aud: user.aud,
      role: user.role,
    };
  } catch (error) {
    logger.api("Authentication error:", error);
    return null;
  }
}

/**
 * Middleware wrapper for protected API routes
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>
) {
  return async (request: NextRequest): Promise<Response> => {
    const user = await authenticateApiRequest(request);

    if (!user) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Valid authentication token required",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return handler(request, user);
  };
}

/**
 * Helper to get user from client-side session
 */
export async function getUserFromSession(
  sessionToken: string
): Promise<AuthenticatedUser | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(sessionToken);

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || "",
      aud: user.aud,
      role: user.role,
    };
  } catch (error) {
    logger.api("Error getting user from session:", error);
    return null;
  }
}
