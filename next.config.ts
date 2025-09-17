import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Remove console.log in production, keep console.warn and console.error
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },
  // Ensure proper handling of client components in Next.js 15
  serverExternalPackages: [],
  // Ensure proper handling of client reference manifests
  transpilePackages: [],
};

export default nextConfig;
