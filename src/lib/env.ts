// Environment variables with validation
export const env = {
  // App configuration
  NODE_ENV: process.env.NODE_ENV || "development",
  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",

  // API configuration
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "/api",
  API_SECRET: process.env.API_SECRET,

  // Database configuration (for future use)
  DATABASE_URL: process.env.DATABASE_URL,

  // Auth configuration (for future use)
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,

  // External services (for future use)
  UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET,
  UPLOADTHING_APP_ID: process.env.UPLOADTHING_APP_ID,

  // Feature flags
  ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "true",
  ENABLE_SENTRY: process.env.NEXT_PUBLIC_ENABLE_SENTRY === "true",
} as const;

// Validate required environment variables in production
if (env.NODE_ENV === "production") {
  const requiredEnvVars = [
    "NEXT_PUBLIC_APP_URL",
    // Add other required vars here
  ] as const;

  for (const envVar of requiredEnvVars) {
    if (!env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

export type Environment = typeof env;
